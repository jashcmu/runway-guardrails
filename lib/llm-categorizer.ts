/**
 * LLM-Powered Transaction Categorization Engine
 * Uses GPT-4o for intelligent transaction classification with structured output
 */

import { Category } from '@prisma/client'
import { chatCompletion } from './openai-client'
import { categorizeExpense, CATEGORY_DESCRIPTIONS, CATEGORY_DISPLAY_NAMES } from './categorize'

export interface LLMCategorizationResult {
  category: Category
  confidence: number // 0-100
  reasoning: string
  vendorName: string | null
  paymentMethod: string | null
  isRecurring: boolean
  suggestedFrequency: string | null // weekly, monthly, quarterly, yearly
  extractedInvoiceNumber: string | null
  extractedAmount: number | null
  flags: string[] // anomalies, warnings
}

export interface TransactionInput {
  description: string
  amount: number
  date?: Date
  type?: 'credit' | 'debit'
  previousTransactions?: Array<{
    description: string
    category: Category
    amount: number
  }>
}

/**
 * Build the system prompt for transaction categorization
 */
function buildCategorizationPrompt(): string {
  const categoryList = Object.entries(CATEGORY_DESCRIPTIONS)
    .map(([cat, desc]) => `- ${cat}: ${desc}`)
    .join('\n')
  
  return `You are an expert financial analyst specializing in transaction categorization for Indian startups and businesses.

Your task is to analyze bank transactions and categorize them accurately.

AVAILABLE CATEGORIES:
${categoryList}

IMPORTANT GUIDELINES:
1. For Indian payment patterns, recognize:
   - UPI transactions (GPAY, PHONEPE, PAYTM, BHIM, etc.)
   - NEFT/RTGS/IMPS bank transfers
   - Common Indian vendors and services
   - GST/TDS/tax payments to government

2. Extract the vendor/merchant name from the description

3. Identify if the transaction appears to be recurring (subscriptions, rent, salaries)

4. Extract invoice/reference numbers if present in the description

5. Flag any anomalies:
   - Unusually large amounts
   - Suspicious patterns
   - Potential duplicates

6. Payment methods to identify:
   - UPI
   - NEFT
   - RTGS
   - IMPS
   - Debit Card
   - Credit Card
   - Cheque
   - Cash

RESPONSE FORMAT (JSON):
{
  "category": "<exact category name from the list>",
  "confidence": <0-100>,
  "reasoning": "<brief explanation for the categorization>",
  "vendorName": "<extracted vendor/merchant name or null>",
  "paymentMethod": "<identified payment method or null>",
  "isRecurring": <true/false>,
  "suggestedFrequency": "<weekly/monthly/quarterly/yearly or null>",
  "extractedInvoiceNumber": "<any invoice/reference number found or null>",
  "flags": ["<any warnings or anomalies>"]
}

Be precise and consistent. Use the exact category names provided.`
}

/**
 * Parse LLM response into structured result
 */
function parseResponse(response: string, fallbackCategory: Category): LLMCategorizationResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // Validate category
    const validCategories = Object.values(Category)
    let category: Category = fallbackCategory
    
    if (parsed.category && validCategories.includes(parsed.category as Category)) {
      category = parsed.category as Category
    } else {
      // Try to find a matching category by name
      const categoryName = String(parsed.category || '').toLowerCase()
      const matchedCategory = validCategories.find(
        cat => cat.toLowerCase() === categoryName || 
               CATEGORY_DISPLAY_NAMES[cat]?.toLowerCase().includes(categoryName)
      )
      if (matchedCategory) {
        category = matchedCategory
      }
    }
    
    return {
      category,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 70)),
      reasoning: String(parsed.reasoning || 'LLM categorization'),
      vendorName: parsed.vendorName || null,
      paymentMethod: parsed.paymentMethod || null,
      isRecurring: Boolean(parsed.isRecurring),
      suggestedFrequency: parsed.suggestedFrequency || null,
      extractedInvoiceNumber: parsed.extractedInvoiceNumber || null,
      extractedAmount: null,
      flags: Array.isArray(parsed.flags) ? parsed.flags : []
    }
  } catch (error) {
    console.warn('Failed to parse LLM response:', error)
    return {
      category: fallbackCategory,
      confidence: 50,
      reasoning: 'Fallback to rule-based categorization',
      vendorName: null,
      paymentMethod: null,
      isRecurring: false,
      suggestedFrequency: null,
      extractedInvoiceNumber: null,
      extractedAmount: null,
      flags: ['parse_error']
    }
  }
}

/**
 * Categorize a single transaction using LLM
 */
export async function categorizeWithLLM(
  transaction: TransactionInput
): Promise<LLMCategorizationResult> {
  // Get fallback category first
  const fallbackCategory = categorizeExpense(transaction.description)
  
  try {
    const userPrompt = buildTransactionPrompt(transaction)
    
    const response = await chatCompletion([
      { role: 'system', content: buildCategorizationPrompt() },
      { role: 'user', content: userPrompt }
    ])
    
    return parseResponse(response, fallbackCategory)
  } catch (error) {
    console.error('LLM categorization failed:', error)
    return {
      category: fallbackCategory,
      confidence: 50,
      reasoning: 'Rule-based fallback due to LLM error',
      vendorName: extractVendorName(transaction.description),
      paymentMethod: detectPaymentMethod(transaction.description),
      isRecurring: false,
      suggestedFrequency: null,
      extractedInvoiceNumber: null,
      extractedAmount: transaction.amount,
      flags: ['llm_error']
    }
  }
}

/**
 * Build the user prompt for a transaction
 */
function buildTransactionPrompt(transaction: TransactionInput): string {
  let prompt = `Categorize this transaction:

Description: "${transaction.description}"
Amount: ₹${Math.abs(transaction.amount).toLocaleString('en-IN')}`

  if (transaction.date) {
    prompt += `\nDate: ${transaction.date.toLocaleDateString('en-IN')}`
  }
  
  if (transaction.type) {
    prompt += `\nType: ${transaction.type === 'credit' ? 'Incoming (Credit)' : 'Outgoing (Debit)'}`
  }
  
  if (transaction.previousTransactions && transaction.previousTransactions.length > 0) {
    prompt += `\n\nRecent similar transactions for context:`
    for (const prev of transaction.previousTransactions.slice(0, 3)) {
      prompt += `\n- "${prev.description}" → ${prev.category} (₹${Math.abs(prev.amount).toLocaleString('en-IN')})`
    }
  }
  
  prompt += '\n\nProvide your analysis in JSON format.'
  
  return prompt
}

/**
 * Batch categorize multiple transactions
 */
export async function categorizeTransactionsBatch(
  transactions: TransactionInput[]
): Promise<LLMCategorizationResult[]> {
  // For efficiency, batch up to 10 transactions per API call
  const BATCH_SIZE = 10
  const results: LLMCategorizationResult[] = []
  
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE)
    
    try {
      const batchResults = await categorizeTransactionBatch(batch)
      results.push(...batchResults)
    } catch (error) {
      // Fallback to individual categorization on batch error
      console.warn('Batch categorization failed, falling back to individual:', error)
      for (const txn of batch) {
        const result = await categorizeWithLLM(txn)
        results.push(result)
      }
    }
  }
  
  return results
}

/**
 * Categorize a batch of transactions in a single API call
 */
async function categorizeTransactionBatch(
  transactions: TransactionInput[]
): Promise<LLMCategorizationResult[]> {
  if (transactions.length === 0) return []
  
  const fallbackCategories = transactions.map(t => categorizeExpense(t.description))
  
  try {
    const transactionList = transactions.map((t, i) => ({
      id: i + 1,
      description: t.description,
      amount: Math.abs(t.amount),
      type: t.type || (t.amount < 0 ? 'debit' : 'credit'),
      date: t.date?.toLocaleDateString('en-IN')
    }))
    
    const userPrompt = `Categorize these ${transactions.length} transactions. Return a JSON array with one object per transaction.

Transactions:
${JSON.stringify(transactionList, null, 2)}

Return format: [{"id": 1, "category": "...", "confidence": 85, "reasoning": "...", "vendorName": "...", ...}, ...]`
    
    const response = await chatCompletion([
      { role: 'system', content: buildCategorizationPrompt() },
      { role: 'user', content: userPrompt }
    ])
    
    // Parse batch response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in batch response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    return transactions.map((txn, index) => {
      const item = parsed.find((p: any) => p.id === index + 1) || parsed[index] || {}
      return parseResponse(JSON.stringify(item), fallbackCategories[index])
    })
  } catch (error) {
    console.error('Batch categorization failed:', error)
    return transactions.map((t, i) => ({
      category: fallbackCategories[i],
      confidence: 50,
      reasoning: 'Rule-based fallback',
      vendorName: extractVendorName(t.description),
      paymentMethod: detectPaymentMethod(t.description),
      isRecurring: false,
      suggestedFrequency: null,
      extractedInvoiceNumber: null,
      extractedAmount: t.amount,
      flags: ['batch_error']
    }))
  }
}

/**
 * Extract vendor name from transaction description
 */
function extractVendorName(description: string): string | null {
  if (!description) return null
  
  const desc = description.toUpperCase()
  
  // Common patterns for vendor extraction
  const patterns = [
    /^(.*?)\s+(?:UPI|NEFT|RTGS|IMPS)/i,
    /(?:TO|FROM|BY)\s+(.+?)(?:\s+REF|\s+TXN|$)/i,
    /^([A-Z0-9\s]+?)(?:\s+\d{4}|\s+INR|\s+RS)/i,
  ]
  
  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match && match[1]) {
      const vendor = match[1].trim()
      if (vendor.length > 2 && vendor.length < 50) {
        return toTitleCase(vendor)
      }
    }
  }
  
  // Just clean up the description
  const cleaned = desc
    .replace(/UPI\/\d+\/.*$/i, '')
    .replace(/NEFT\/.*$/i, '')
    .replace(/\d{10,}/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .trim()
  
  if (cleaned.length > 2 && cleaned.length < 50) {
    return toTitleCase(cleaned.split(/\s+/).slice(0, 3).join(' '))
  }
  
  return null
}

/**
 * Detect payment method from description
 */
function detectPaymentMethod(description: string): string | null {
  const desc = description.toUpperCase()
  
  if (desc.includes('UPI') || desc.includes('GPAY') || desc.includes('PHONEPE') || desc.includes('PAYTM')) {
    return 'UPI'
  }
  if (desc.includes('NEFT')) return 'NEFT'
  if (desc.includes('RTGS')) return 'RTGS'
  if (desc.includes('IMPS')) return 'IMPS'
  if (desc.includes('CHEQUE') || desc.includes('CHQ')) return 'Cheque'
  if (desc.includes('ATM') || desc.includes('CASH')) return 'Cash'
  if (desc.includes('POS') || desc.includes('DEBIT CARD')) return 'Debit Card'
  if (desc.includes('CREDIT CARD') || desc.includes('CC')) return 'Credit Card'
  
  return null
}

/**
 * Convert string to title case
 */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Analyze transactions for insights using LLM
 */
export async function analyzeTransactionsWithLLM(
  transactions: Array<{
    description: string
    amount: number
    category: Category
    date: Date
    vendorName?: string
  }>,
  analysisType: 'spending_patterns' | 'anomalies' | 'recommendations'
): Promise<{
  insights: string[]
  recommendations: string[]
  flags: string[]
}> {
  try {
    // Group by category
    const byCategory: Record<string, { total: number; count: number }> = {}
    for (const txn of transactions) {
      if (!byCategory[txn.category]) {
        byCategory[txn.category] = { total: 0, count: 0 }
      }
      byCategory[txn.category].total += Math.abs(txn.amount)
      byCategory[txn.category].count++
    }
    
    const summary = Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, data]) => `${cat}: ₹${data.total.toLocaleString('en-IN')} (${data.count} transactions)`)
      .join('\n')
    
    const prompt = `Analyze these transaction patterns for an Indian startup:

SPENDING BY CATEGORY:
${summary}

TOTAL TRANSACTIONS: ${transactions.length}
TOTAL SPEND: ₹${transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString('en-IN')}

Analysis type: ${analysisType}

Provide:
1. Key insights (3-5 bullet points)
2. Actionable recommendations (2-3 suggestions)
3. Any red flags or concerns

Format as JSON:
{
  "insights": ["insight1", "insight2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "flags": ["flag1", ...]
}`
    
    const response = await chatCompletion([
      { role: 'system', content: 'You are a financial advisor for Indian startups. Provide practical, actionable advice based on transaction patterns.' },
      { role: 'user', content: prompt }
    ])
    
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        flags: Array.isArray(parsed.flags) ? parsed.flags : []
      }
    }
    
    throw new Error('Failed to parse analysis response')
  } catch (error) {
    console.error('Transaction analysis failed:', error)
    return {
      insights: ['Unable to generate insights at this time'],
      recommendations: ['Review your recent transactions manually'],
      flags: ['analysis_error']
    }
  }
}
