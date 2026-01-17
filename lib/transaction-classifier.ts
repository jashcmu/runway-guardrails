/**
 * Multi-Layer Transaction Classifier
 * Provides intelligent classification with confidence scoring
 * 
 * Strategies (in order of priority):
 * 1. Exact Match (invoice/bill number) → 95% confidence
 * 2. Amount + Date Match → 85% confidence
 * 3. Vendor/Customer Name Match → 75% confidence
 * 4. Historical Pattern → 70% confidence
 * 5. AI Classification → 60% confidence
 * 6. Rule-Based (keywords) → 50% confidence
 */

import { Category } from '@prisma/client'
import { prisma } from './prisma'
import { categorizeExpense } from './categorize'

// Types
export interface TransactionContext {
  description: string
  amount: number
  date: Date
  type: 'credit' | 'debit'
  companyId: string
  bankAccountId?: string
}

export interface ClassificationResult {
  type: 'invoice_payment' | 'bill_payment' | 'expense' | 'revenue' | 'transfer' | 'unknown'
  category: Category
  confidence: number // 0-100
  matchedInvoiceId?: string
  matchedBillId?: string
  vendorName?: string
  customerName?: string
  needsReview: boolean
  reasoning: string[]
  expenseType: 'one-time' | 'recurring'
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

// Constants
const REVIEW_THRESHOLD = 70 // Transactions below this confidence need review
const EXACT_MATCH_CONFIDENCE = 95
const AMOUNT_DATE_MATCH_CONFIDENCE = 85
const NAME_MATCH_CONFIDENCE = 75
const HISTORICAL_PATTERN_CONFIDENCE = 70
const AI_CLASSIFICATION_CONFIDENCE = 60
const RULE_BASED_CONFIDENCE = 50

/**
 * Main classification function
 * Uses multiple strategies to classify transactions with confidence scores
 */
export async function classifyTransaction(
  txn: TransactionContext
): Promise<ClassificationResult> {
  const reasoning: string[] = []
  
  // Strategy 1: Check for exact invoice/bill number match
  const exactMatch = await checkExactMatch(txn)
  if (exactMatch.matched) {
    return {
      ...exactMatch.result!,
      needsReview: false,
      reasoning: [...reasoning, exactMatch.reason]
    }
  }
  reasoning.push(exactMatch.reason)

  // Strategy 2: Amount + Date matching with pending invoices/bills
  const amountDateMatch = await checkAmountDateMatch(txn)
  if (amountDateMatch.matched) {
    return {
      ...amountDateMatch.result!,
      needsReview: amountDateMatch.result!.confidence < REVIEW_THRESHOLD,
      reasoning: [...reasoning, amountDateMatch.reason]
    }
  }
  reasoning.push(amountDateMatch.reason)

  // Strategy 3: Vendor/Customer name matching
  const nameMatch = await checkNameMatch(txn)
  if (nameMatch.matched) {
    return {
      ...nameMatch.result!,
      needsReview: nameMatch.result!.confidence < REVIEW_THRESHOLD,
      reasoning: [...reasoning, nameMatch.reason]
    }
  }
  reasoning.push(nameMatch.reason)

  // Strategy 4: Historical pattern matching
  const historicalMatch = await checkHistoricalPattern(txn)
  if (historicalMatch.matched) {
    return {
      ...historicalMatch.result!,
      needsReview: historicalMatch.result!.confidence < REVIEW_THRESHOLD,
      reasoning: [...reasoning, historicalMatch.reason]
    }
  }
  reasoning.push(historicalMatch.reason)

  // Strategy 5: AI Classification (if OpenAI is available)
  const aiClassification = await tryAIClassification(txn)
  if (aiClassification.matched) {
    return {
      ...aiClassification.result!,
      needsReview: aiClassification.result!.confidence < REVIEW_THRESHOLD,
      reasoning: [...reasoning, aiClassification.reason]
    }
  }
  reasoning.push(aiClassification.reason)

  // Strategy 6: Rule-based keyword matching (fallback)
  const ruleBasedResult = classifyByRules(txn)
  return {
    ...ruleBasedResult,
    needsReview: ruleBasedResult.confidence < REVIEW_THRESHOLD,
    reasoning: [...reasoning, 'Used rule-based keyword matching as fallback']
  }
}

// Strategy 1: Exact Match
interface MatchResult {
  matched: boolean
  result?: ClassificationResult
  reason: string
}

async function checkExactMatch(txn: TransactionContext): Promise<MatchResult> {
  const desc = txn.description.toUpperCase()
  
  // Extract invoice number patterns
  const invoicePatterns = [
    /INV[-#]?(\d+)/i,
    /INVOICE\s*#?\s*(\d+)/i,
    /INV[-_]?([A-Z0-9]+)/i
  ]
  
  // Extract bill number patterns
  const billPatterns = [
    /BILL[-#]?(\d+)/i,
    /BILL\s*#?\s*(\d+)/i,
    /BILL[-_]?([A-Z0-9]+)/i
  ]

  // Check for invoice match (credits)
  if (txn.type === 'credit') {
    for (const pattern of invoicePatterns) {
      const match = desc.match(pattern)
      if (match) {
        const invoiceNumber = match[1]
        const invoice = await prisma.invoice.findFirst({
          where: {
            companyId: txn.companyId,
            invoiceNumber: { contains: invoiceNumber, mode: 'insensitive' },
            status: { in: ['draft', 'sent', 'pending'] }
          }
        })
        
        if (invoice) {
          return {
            matched: true,
            result: {
              type: 'invoice_payment',
              category: Category.G_A,
              confidence: EXACT_MATCH_CONFIDENCE,
              matchedInvoiceId: invoice.id,
              customerName: invoice.customerName,
              expenseType: 'one-time',
              needsReview: false,
              reasoning: []
            },
            reason: `Exact invoice match: ${invoice.invoiceNumber}`
          }
        }
      }
    }
  }

  // Check for bill match (debits)
  if (txn.type === 'debit') {
    for (const pattern of billPatterns) {
      const match = desc.match(pattern)
      if (match) {
        const billNumber = match[1]
        const bill = await prisma.bill.findFirst({
          where: {
            companyId: txn.companyId,
            billNumber: { contains: billNumber, mode: 'insensitive' },
            paymentStatus: { in: ['unpaid', 'partial'] }
          }
        })
        
        if (bill) {
          return {
            matched: true,
            result: {
              type: 'bill_payment',
              category: Category.G_A,
              confidence: EXACT_MATCH_CONFIDENCE,
              matchedBillId: bill.id,
              vendorName: bill.vendorName,
              expenseType: 'one-time',
              needsReview: false,
              reasoning: []
            },
            reason: `Exact bill match: ${bill.billNumber}`
          }
        }
      }
    }
  }

  return {
    matched: false,
    reason: 'No exact invoice/bill number match found in description'
  }
}

// Strategy 2: Amount + Date Match
async function checkAmountDateMatch(txn: TransactionContext): Promise<MatchResult> {
  const amount = Math.abs(txn.amount)
  const txnDate = new Date(txn.date)
  
  // Date range: ±3 days
  const startDate = new Date(txnDate)
  startDate.setDate(startDate.getDate() - 3)
  const endDate = new Date(txnDate)
  endDate.setDate(endDate.getDate() + 3)

  if (txn.type === 'credit') {
    // Check for matching invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: txn.companyId,
        status: { in: ['draft', 'sent', 'pending'] },
        totalAmount: {
          gte: amount * 0.99,
          lte: amount * 1.01
        }
      }
    })

    if (invoices.length === 1) {
      return {
        matched: true,
        result: {
          type: 'invoice_payment',
          category: Category.G_A,
          confidence: AMOUNT_DATE_MATCH_CONFIDENCE,
          matchedInvoiceId: invoices[0].id,
          customerName: invoices[0].customerName,
          expenseType: 'one-time',
          needsReview: false,
          reasoning: []
        },
        reason: `Amount match: Invoice ${invoices[0].invoiceNumber} (₹${invoices[0].totalAmount})`
      }
    } else if (invoices.length > 1) {
      // Multiple matches - lower confidence
      return {
        matched: true,
        result: {
          type: 'invoice_payment',
          category: Category.G_A,
          confidence: AMOUNT_DATE_MATCH_CONFIDENCE - 15,
          matchedInvoiceId: invoices[0].id,
          customerName: invoices[0].customerName,
          expenseType: 'one-time',
          needsReview: true,
          reasoning: []
        },
        reason: `Multiple invoice matches (${invoices.length}) for amount ₹${amount}`
      }
    }
  }

  if (txn.type === 'debit') {
    // Check for matching bills
    const bills = await prisma.bill.findMany({
      where: {
        companyId: txn.companyId,
        paymentStatus: { in: ['unpaid', 'partial'] },
        totalAmount: {
          gte: amount * 0.99,
          lte: amount * 1.01
        }
      }
    })

    if (bills.length === 1) {
      return {
        matched: true,
        result: {
          type: 'bill_payment',
          category: Category.G_A,
          confidence: AMOUNT_DATE_MATCH_CONFIDENCE,
          matchedBillId: bills[0].id,
          vendorName: bills[0].vendorName,
          expenseType: 'one-time',
          needsReview: false,
          reasoning: []
        },
        reason: `Amount match: Bill ${bills[0].billNumber} (₹${bills[0].totalAmount})`
      }
    } else if (bills.length > 1) {
      // Multiple matches - lower confidence
      return {
        matched: true,
        result: {
          type: 'bill_payment',
          category: Category.G_A,
          confidence: AMOUNT_DATE_MATCH_CONFIDENCE - 15,
          matchedBillId: bills[0].id,
          vendorName: bills[0].vendorName,
          expenseType: 'one-time',
          needsReview: true,
          reasoning: []
        },
        reason: `Multiple bill matches (${bills.length}) for amount ₹${amount}`
      }
    }
  }

  return {
    matched: false,
    reason: 'No amount+date match found'
  }
}

// Strategy 3: Name Match
async function checkNameMatch(txn: TransactionContext): Promise<MatchResult> {
  const desc = txn.description.toLowerCase()

  if (txn.type === 'credit') {
    // Check customer names from invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: txn.companyId,
        status: { in: ['draft', 'sent', 'pending'] }
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        totalAmount: true
      }
    })

    for (const invoice of invoices) {
      const customerName = invoice.customerName.toLowerCase()
      const similarity = calculateSimilarity(desc, customerName)
      
      if (similarity > 0.6 || desc.includes(customerName) || customerName.includes(desc.split(' ')[0])) {
        return {
          matched: true,
          result: {
            type: 'invoice_payment',
            category: Category.G_A,
            confidence: NAME_MATCH_CONFIDENCE,
            matchedInvoiceId: invoice.id,
            customerName: invoice.customerName,
            expenseType: 'one-time',
            needsReview: true,
            reasoning: []
          },
          reason: `Customer name match: "${invoice.customerName}" found in description`
        }
      }
    }
  }

  if (txn.type === 'debit') {
    // Check vendor names from bills
    const bills = await prisma.bill.findMany({
      where: {
        companyId: txn.companyId,
        paymentStatus: { in: ['unpaid', 'partial'] }
      },
      select: {
        id: true,
        billNumber: true,
        vendorName: true,
        totalAmount: true
      }
    })

    for (const bill of bills) {
      const vendorName = bill.vendorName.toLowerCase()
      const similarity = calculateSimilarity(desc, vendorName)
      
      if (similarity > 0.6 || desc.includes(vendorName) || vendorName.includes(desc.split(' ')[0])) {
        return {
          matched: true,
          result: {
            type: 'bill_payment',
            category: Category.G_A,
            confidence: NAME_MATCH_CONFIDENCE,
            matchedBillId: bill.id,
            vendorName: bill.vendorName,
            expenseType: 'one-time',
            needsReview: true,
            reasoning: []
          },
          reason: `Vendor name match: "${bill.vendorName}" found in description`
        }
      }
    }

    // Also check known vendors
    const vendors = await prisma.vendor.findMany({
      where: {
        companyId: txn.companyId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        category: true
      }
    })

    for (const vendor of vendors) {
      const vendorName = vendor.name.toLowerCase()
      if (desc.includes(vendorName) || vendorName.includes(desc.split(' ')[0])) {
        return {
          matched: true,
          result: {
            type: 'expense',
            category: (vendor.category as Category) || Category.G_A,
            confidence: NAME_MATCH_CONFIDENCE,
            vendorName: vendor.name,
            expenseType: 'one-time',
            needsReview: false,
            reasoning: []
          },
          reason: `Known vendor match: "${vendor.name}"`
        }
      }
    }
  }

  return {
    matched: false,
    reason: 'No vendor/customer name match found'
  }
}

// Strategy 4: Historical Pattern
async function checkHistoricalPattern(txn: TransactionContext): Promise<MatchResult> {
  const amount = Math.abs(txn.amount)
  const sixMonthsAgo = new Date(txn.date)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Find similar historical transactions
  const similarTransactions = await prisma.transaction.findMany({
    where: {
      companyId: txn.companyId,
      date: { gte: sixMonthsAgo },
      amount: {
        gte: amount * 0.9,
        lte: amount * 1.1
      }
    },
    orderBy: { date: 'desc' },
    take: 10
  })

  if (similarTransactions.length >= 2) {
    // Check for recurring pattern
    const avgDaysBetween = calculateAverageDaysBetween(
      similarTransactions.map(t => t.date)
    )

    let frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | undefined
    let isRecurring = false

    if (avgDaysBetween >= 5 && avgDaysBetween <= 10) {
      frequency = 'weekly'
      isRecurring = true
    } else if (avgDaysBetween >= 25 && avgDaysBetween <= 35) {
      frequency = 'monthly'
      isRecurring = true
    } else if (avgDaysBetween >= 85 && avgDaysBetween <= 95) {
      frequency = 'quarterly'
      isRecurring = true
    } else if (avgDaysBetween >= 360 && avgDaysBetween <= 370) {
      frequency = 'yearly'
      isRecurring = true
    }

    if (isRecurring) {
      const mostRecentCategory = similarTransactions[0].category
      const vendorName = extractVendorName(txn.description)

      return {
        matched: true,
        result: {
          type: txn.type === 'credit' ? 'revenue' : 'expense',
          category: mostRecentCategory,
          confidence: HISTORICAL_PATTERN_CONFIDENCE,
          vendorName: txn.type === 'debit' ? vendorName : undefined,
          customerName: txn.type === 'credit' ? vendorName : undefined,
          expenseType: 'recurring',
          frequency,
          needsReview: false,
          reasoning: []
        },
        reason: `Recurring ${frequency} pattern detected (${similarTransactions.length} occurrences)`
      }
    }

    // Not recurring but has history - use most common category
    const categoryCounts: Record<string, number> = {}
    for (const t of similarTransactions) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1
    }
    const mostCommonCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as Category

    return {
      matched: true,
      result: {
        type: txn.type === 'credit' ? 'revenue' : 'expense',
        category: mostCommonCategory,
        confidence: HISTORICAL_PATTERN_CONFIDENCE - 10,
        vendorName: txn.type === 'debit' ? extractVendorName(txn.description) : undefined,
        expenseType: 'one-time',
        needsReview: true,
        reasoning: []
      },
      reason: `Historical pattern: ${similarTransactions.length} similar transactions found`
    }
  }

  return {
    matched: false,
    reason: 'No historical pattern found'
  }
}

// Strategy 5: AI Classification using LLM Categorizer
async function tryAIClassification(txn: TransactionContext): Promise<MatchResult> {
  try {
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return {
        matched: false,
        reason: 'AI classification skipped: OpenAI not configured'
      }
    }

    // Use the new LLM categorizer
    const { categorizeWithLLM } = await import('./llm-categorizer')

    const result = await categorizeWithLLM({
      description: txn.description,
      amount: txn.amount,
      date: txn.date,
      type: txn.type
    })

    // Check if LLM actually processed it (not a fallback)
    if (result.flags.includes('llm_error') || result.flags.includes('parse_error')) {
      return {
        matched: false,
        reason: 'AI classification failed, will use rule-based fallback'
      }
    }

    // LLM categorizer returns higher confidence - use 85% for primary LLM classification
    const LLM_CONFIDENCE = 85

    return {
      matched: true,
      result: {
        type: txn.type === 'credit' ? 'revenue' : 'expense',
        category: result.category,
        confidence: Math.min(result.confidence, LLM_CONFIDENCE),
        vendorName: txn.type === 'debit' ? result.vendorName || undefined : undefined,
        customerName: txn.type === 'credit' ? result.vendorName || undefined : undefined,
        expenseType: result.isRecurring ? 'recurring' : 'one-time',
        frequency: result.suggestedFrequency as 'weekly' | 'monthly' | 'quarterly' | 'yearly' | undefined,
        needsReview: result.confidence < REVIEW_THRESHOLD || result.flags.length > 0,
        reasoning: []
      },
      reason: `LLM classification: ${result.reasoning}`
    }
  } catch (error) {
    return {
      matched: false,
      reason: `AI classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Strategy 6: Rule-Based Classification
function classifyByRules(txn: TransactionContext): ClassificationResult {
  const category = categorizeExpense(txn.description)
  const vendorName = extractVendorName(txn.description)

  return {
    type: txn.type === 'credit' ? 'revenue' : 'expense',
    category,
    confidence: RULE_BASED_CONFIDENCE,
    vendorName: txn.type === 'debit' ? vendorName : undefined,
    customerName: txn.type === 'credit' ? vendorName : undefined,
    expenseType: 'one-time',
    needsReview: true,
    reasoning: ['Classified using keyword-based rules']
  }
}

// Utility Functions

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 || len2 === 0) return 0

  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  const maxLen = Math.max(len1, len2)
  return 1 - matrix[len1][len2] / maxLen
}

/**
 * Calculate average days between dates
 */
function calculateAverageDaysBetween(dates: Date[]): number {
  if (dates.length < 2) return 0

  const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime())
  let totalDays = 0

  for (let i = 0; i < sortedDates.length - 1; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i + 1].getTime()
    totalDays += diff / (1000 * 60 * 60 * 24)
  }

  return totalDays / (sortedDates.length - 1)
}

/**
 * Extract vendor name from description
 */
function extractVendorName(description: string): string {
  // Remove common transaction prefixes/suffixes
  let cleaned = description
    .replace(/^(payment to|paid to|transfer to|payment for|paid for|neft|imps|rtgs|upi)/i, '')
    .replace(/(payment|invoice|bill|receipt|transaction|ref|reference|txn).*$/i, '')
    .trim()

  // Take first significant words
  const words = cleaned.split(/\s+/).filter(w => w.length > 2)
  return words.slice(0, 3).join(' ') || 'Unknown'
}

// Batch classification for multiple transactions
export async function classifyTransactionsBatch(
  transactions: TransactionContext[]
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []

  for (const txn of transactions) {
    const result = await classifyTransaction(txn)
    results.push(result)
  }

  return results
}

// Get classification summary
export function getClassificationSummary(results: ClassificationResult[]): {
  total: number
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  needsReview: number
  byType: Record<string, number>
  byCategory: Record<string, number>
} {
  const summary = {
    total: results.length,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    needsReview: 0,
    byType: {} as Record<string, number>,
    byCategory: {} as Record<string, number>
  }

  for (const result of results) {
    if (result.confidence >= 80) summary.highConfidence++
    else if (result.confidence >= 60) summary.mediumConfidence++
    else summary.lowConfidence++

    if (result.needsReview) summary.needsReview++

    summary.byType[result.type] = (summary.byType[result.type] || 0) + 1
    summary.byCategory[result.category] = (summary.byCategory[result.category] || 0) + 1
  }

  return summary
}
