/**
 * Enhanced AI Anomaly Detection Module
 * Uses statistical analysis and LLM for intelligent anomaly detection
 */

import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'
import { chatCompletion } from './openai-client'

export interface Anomaly {
  transactionId: string
  type: 'amount' | 'duplicate' | 'frequency' | 'newVendor' | 'pattern' | 'budget' | 'timing' | 'suspicious'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details?: string
  confidence: number
  suggestedAction: string
  metrics?: Record<string, number | string>
  relatedTransactions?: string[]
}

interface TransactionStats {
  avg: number
  stdDev: number
  count: number
  max: number
  min: number
  median: number
}

/**
 * Comprehensive anomaly detection
 */
export async function detectAnomalies(
  companyId: string, 
  lookbackDays = 90
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - lookbackDays)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate },
    },
    orderBy: { date: 'desc' },
  })

  if (transactions.length < 5) {
    return anomalies
  }

  // Calculate category statistics with standard deviation
  const categoryStats = calculateCategoryStats(transactions)
  
  // Get recent transactions (last 30 days) for focused analysis
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentTransactions = transactions.filter(t => t.date >= thirtyDaysAgo)

  // 1. Amount Anomalies (Z-score based)
  for (const txn of recentTransactions) {
    if (txn.amount >= 0) continue // Only check expenses
    
    const stats = categoryStats.get(txn.category)
    if (!stats || stats.count < 3) continue

    const amount = Math.abs(txn.amount)
    const zScore = stats.stdDev > 0 ? (amount - stats.avg) / stats.stdDev : 0

    if (zScore > 2.5) {
      const severity = zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low'
      anomalies.push({
        transactionId: txn.id,
        type: 'amount',
        severity,
        message: `Unusual amount: ₹${formatCurrency(amount)} is ${zScore.toFixed(1)} standard deviations above average`,
        details: `Average for ${txn.category}: ₹${formatCurrency(stats.avg)}. This transaction is ${Math.round(amount / stats.avg)}x higher.`,
        confidence: Math.min(95, 70 + zScore * 5),
        suggestedAction: 'Review transaction for accuracy and authorization',
        metrics: {
          amount,
          average: stats.avg,
          zScore: Math.round(zScore * 100) / 100
        }
      })
    }
  }

  // 2. Duplicate Payment Detection
  const duplicateGroups = findDuplicates(recentTransactions)
  for (const group of duplicateGroups) {
    anomalies.push({
      transactionId: group[0].id,
      type: 'duplicate',
      severity: group.length > 2 ? 'high' : 'medium',
      message: `Potential duplicate: ${group.length} transactions with same amount ₹${formatCurrency(Math.abs(group[0].amount))}`,
      details: `Found on dates: ${group.map(t => t.date.toLocaleDateString()).join(', ')}`,
      confidence: 75,
      suggestedAction: 'Verify these are not duplicate payments',
      relatedTransactions: group.map(t => t.id)
    })
  }

  // 3. New High-Value Vendor
  const vendorHistory = buildVendorHistory(transactions)
  for (const txn of recentTransactions) {
    if (txn.amount >= 0) continue
    
    const vendor = txn.vendorName || extractVendorFromDescription(txn.description || '')
    const amount = Math.abs(txn.amount)
    const history = vendorHistory.get(vendor)
    
    if (amount > 50000 && (!history || history.count === 1)) {
      anomalies.push({
        transactionId: txn.id,
        type: 'newVendor',
        severity: amount > 200000 ? 'high' : amount > 100000 ? 'medium' : 'low',
        message: `New vendor with large payment: ${vendor}`,
        details: `First-time payment of ₹${formatCurrency(amount)}. Ensure vendor is verified.`,
        confidence: 65,
        suggestedAction: 'Verify vendor identity and payment authorization',
        metrics: { amount, vendor }
      })
    }
  }

  // 4. Frequency Anomalies (unusual payment patterns)
  const frequencyAnomalies = detectFrequencyAnomalies(transactions, recentTransactions)
  anomalies.push(...frequencyAnomalies)

  // 5. Timing Anomalies (unusual transaction timing)
  const timingAnomalies = detectTimingAnomalies(recentTransactions)
  anomalies.push(...timingAnomalies)

  // 6. Budget Overruns
  const budgetAnomalies = await detectBudgetAnomalies(companyId, recentTransactions)
  anomalies.push(...budgetAnomalies)

  // 7. Suspicious Patterns (round numbers, end-of-period spikes)
  const suspiciousAnomalies = detectSuspiciousPatterns(recentTransactions)
  anomalies.push(...suspiciousAnomalies)

  // Sort by severity and confidence
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  anomalies.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff
    return b.confidence - a.confidence
  })

  return anomalies
}

/**
 * Use LLM to analyze suspicious transactions
 */
export async function analyzeWithLLM(
  transactions: Array<{ description?: string | null; amount: number; category: string; date: Date }>,
  context: string
): Promise<{ insights: string[]; flags: string[] }> {
  try {
    const transactionSummary = transactions.slice(0, 20).map(t => 
      `- ${t.date.toLocaleDateString()}: ${t.description} | ₹${Math.abs(t.amount).toLocaleString('en-IN')} | ${t.category}`
    ).join('\n')

    const prompt = `Analyze these transactions for an Indian startup and identify any concerning patterns:

Context: ${context}

Transactions:
${transactionSummary}

Look for:
1. Unusual spending patterns
2. Potential fraud indicators
3. Policy violations
4. Compliance concerns
5. Cost optimization opportunities

Respond in JSON:
{
  "insights": ["insight1", "insight2"],
  "flags": ["concern1", "concern2"]
}`

    const response = await chatCompletion([
      { role: 'system', content: 'You are a financial auditor analyzing transactions for anomalies and risks.' },
      { role: 'user', content: prompt }
    ])

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        flags: Array.isArray(parsed.flags) ? parsed.flags : []
      }
    }

    return { insights: [], flags: [] }
  } catch (error) {
    console.error('LLM anomaly analysis failed:', error)
    return { insights: [], flags: [] }
  }
}

/**
 * Calculate statistics for each category
 */
function calculateCategoryStats(
  transactions: Array<{ amount: number; category: Category }>
): Map<Category, TransactionStats> {
  const categoryData = new Map<Category, number[]>()

  for (const txn of transactions) {
    if (txn.amount >= 0) continue
    const amounts = categoryData.get(txn.category) || []
    amounts.push(Math.abs(txn.amount))
    categoryData.set(txn.category, amounts)
  }

  const stats = new Map<Category, TransactionStats>()

  for (const [category, amounts] of categoryData) {
    if (amounts.length === 0) continue
    
    const sorted = [...amounts].sort((a, b) => a - b)
    const sum = amounts.reduce((s, a) => s + a, 0)
    const avg = sum / amounts.length
    const variance = amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length
    
    stats.set(category, {
      avg,
      stdDev: Math.sqrt(variance),
      count: amounts.length,
      max: sorted[sorted.length - 1],
      min: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)]
    })
  }

  return stats
}

/**
 * Find duplicate transactions
 */
function findDuplicates(
  transactions: Array<{ id: string; amount: number; date: Date; description?: string | null }>
): Array<typeof transactions> {
  const duplicates: Array<typeof transactions> = []
  const processed = new Set<string>()

  for (let i = 0; i < transactions.length; i++) {
    if (processed.has(transactions[i].id)) continue
    if (transactions[i].amount >= 0) continue

    const group = [transactions[i]]
    
    for (let j = i + 1; j < transactions.length; j++) {
      if (processed.has(transactions[j].id)) continue
      
      const timeDiff = Math.abs(transactions[i].date.getTime() - transactions[j].date.getTime())
      const amountDiff = Math.abs(transactions[i].amount - transactions[j].amount)
      
      // Same amount within 48 hours
      if (amountDiff < 1 && timeDiff < 48 * 60 * 60 * 1000) {
        group.push(transactions[j])
        processed.add(transactions[j].id)
      }
    }
    
    if (group.length > 1) {
      group.forEach(t => processed.add(t.id))
      duplicates.push(group)
    }
  }

  return duplicates
}

/**
 * Build vendor payment history
 */
function buildVendorHistory(
  transactions: Array<{ vendorName?: string | null; description?: string | null; amount: number }>
): Map<string, { count: number; total: number }> {
  const history = new Map<string, { count: number; total: number }>()

  for (const txn of transactions) {
    if (txn.amount >= 0) continue
    
    const vendor = txn.vendorName || extractVendorFromDescription(txn.description || '')
    const existing = history.get(vendor) || { count: 0, total: 0 }
    existing.count++
    existing.total += Math.abs(txn.amount)
    history.set(vendor, existing)
  }

  return history
}

/**
 * Extract vendor name from description
 */
function extractVendorFromDescription(description: string): string {
  const cleaned = description
    .replace(/^(payment to|paid to|transfer to|neft|imps|rtgs|upi)/i, '')
    .replace(/(payment|invoice|bill|txn|ref).*/i, '')
    .replace(/\d{10,}/g, '')
    .trim()
  
  return cleaned.split(/\s+/).slice(0, 3).join(' ') || 'Unknown'
}

/**
 * Detect frequency-based anomalies
 */
function detectFrequencyAnomalies(
  allTransactions: Array<{ id: string; vendorName?: string | null; description?: string | null; amount: number; date: Date }>,
  recentTransactions: Array<{ id: string; vendorName?: string | null; description?: string | null; amount: number; date: Date }>
): Anomaly[] {
  const anomalies: Anomaly[] = []
  
  // Check for sudden increase in payment frequency to a vendor
  const recentVendorCounts = new Map<string, number>()
  const historicalVendorCounts = new Map<string, number>()
  
  for (const txn of recentTransactions) {
    if (txn.amount >= 0) continue
    const vendor = txn.vendorName || extractVendorFromDescription(txn.description || '')
    recentVendorCounts.set(vendor, (recentVendorCounts.get(vendor) || 0) + 1)
  }
  
  for (const txn of allTransactions) {
    if (txn.amount >= 0) continue
    const vendor = txn.vendorName || extractVendorFromDescription(txn.description || '')
    historicalVendorCounts.set(vendor, (historicalVendorCounts.get(vendor) || 0) + 1)
  }
  
  for (const [vendor, recentCount] of recentVendorCounts) {
    const historicalCount = historicalVendorCounts.get(vendor) || recentCount
    const expectedMonthly = historicalCount / 3 // Assuming 90 days of history
    
    if (recentCount > expectedMonthly * 2 && recentCount >= 3) {
      anomalies.push({
        transactionId: '', // Group anomaly
        type: 'frequency',
        severity: recentCount > expectedMonthly * 3 ? 'high' : 'medium',
        message: `Unusual payment frequency to ${vendor}`,
        details: `${recentCount} payments this month vs. expected ${Math.round(expectedMonthly)}`,
        confidence: 70,
        suggestedAction: 'Review if all payments are legitimate',
        metrics: { vendor, recentCount, expectedMonthly }
      })
    }
  }
  
  return anomalies
}

/**
 * Detect timing-based anomalies
 */
function detectTimingAnomalies(
  transactions: Array<{ id: string; amount: number; date: Date }>
): Anomaly[] {
  const anomalies: Anomaly[] = []
  
  // Check for weekend transactions (unusual for business expenses)
  const weekendTxns = transactions.filter(t => {
    const day = t.date.getDay()
    return (day === 0 || day === 6) && t.amount < 0 && Math.abs(t.amount) > 10000
  })
  
  if (weekendTxns.length > 3) {
    anomalies.push({
      transactionId: weekendTxns[0].id,
      type: 'timing',
      severity: 'low',
      message: `${weekendTxns.length} large transactions on weekends`,
      details: 'Weekend business transactions are unusual and may warrant review',
      confidence: 55,
      suggestedAction: 'Verify if weekend transactions are authorized',
      relatedTransactions: weekendTxns.slice(0, 5).map(t => t.id)
    })
  }
  
  return anomalies
}

/**
 * Detect budget overrun anomalies
 */
async function detectBudgetAnomalies(
  companyId: string,
  transactions: Array<{ id: string; category: Category; amount: number }>
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []
  
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  const budgets = await prisma.budget.findMany({
    where: {
      companyId,
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart }
    }
  })
  
  // Calculate category spending
  const categorySpend = new Map<Category, number>()
  for (const txn of transactions) {
    if (txn.amount >= 0) continue
    categorySpend.set(txn.category, (categorySpend.get(txn.category) || 0) + Math.abs(txn.amount))
  }
  
  for (const budget of budgets) {
    const spend = categorySpend.get(budget.category) || 0
    const percentage = (spend / budget.amount) * 100
    
    if (percentage > 100) {
      anomalies.push({
        transactionId: '',
        type: 'budget',
        severity: percentage > 150 ? 'high' : 'medium',
        message: `${budget.category} budget exceeded by ${Math.round(percentage - 100)}%`,
        details: `Spent ₹${formatCurrency(spend)} of ₹${formatCurrency(budget.amount)} budget`,
        confidence: 95,
        suggestedAction: 'Review spending and consider budget adjustment',
        metrics: { category: budget.category, spend, budget: budget.amount, percentage }
      })
    } else if (percentage > 90) {
      anomalies.push({
        transactionId: '',
        type: 'budget',
        severity: 'low',
        message: `${budget.category} budget at ${Math.round(percentage)}%`,
        details: `Approaching budget limit. ₹${formatCurrency(budget.amount - spend)} remaining.`,
        confidence: 90,
        suggestedAction: 'Monitor spending for remainder of month'
      })
    }
  }
  
  return anomalies
}

/**
 * Detect suspicious patterns
 */
function detectSuspiciousPatterns(
  transactions: Array<{ id: string; amount: number; date: Date }>
): Anomaly[] {
  const anomalies: Anomaly[] = []
  
  // Check for suspiciously round numbers
  const roundNumberTxns = transactions.filter(t => {
    if (t.amount >= 0) return false
    const amount = Math.abs(t.amount)
    return amount >= 50000 && amount % 10000 === 0
  })
  
  if (roundNumberTxns.length > 5) {
    anomalies.push({
      transactionId: roundNumberTxns[0].id,
      type: 'suspicious',
      severity: 'low',
      message: `Multiple large round-number transactions detected`,
      details: `${roundNumberTxns.length} transactions with exact round amounts (₹10K, ₹50K, etc.)`,
      confidence: 50,
      suggestedAction: 'Verify if these represent actual invoiced amounts',
      relatedTransactions: roundNumberTxns.slice(0, 5).map(t => t.id)
    })
  }
  
  return anomalies
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// ============ Category Learning ============

export interface CategoryLearning {
  keywords: string[]
  category: Category
  confidence: number
  companyId: string
}

/**
 * Learn from user's category corrections
 */
export async function learnFromCorrection(
  companyId: string,
  description: string,
  originalCategory: Category,
  correctedCategory: Category
): Promise<void> {
  // Extract keywords from description
  const keywords = extractKeywords(description)
  
  console.log(
    `📚 Learning: "${description}" → ${originalCategory} corrected to ${correctedCategory}`
  )
  console.log(`   Keywords: ${keywords.join(', ')}`)
  
  // Store in activity log for now (could be dedicated table)
  await prisma.activityLog.create({
    data: {
      companyId,
      userId: 'system',
      userName: 'Category Learning',
      action: 'category_correction',
      entityType: 'transaction',
      changes: {
        description,
        originalCategory,
        correctedCategory,
        keywords
      }
    }
  })
}

/**
 * Get company-specific categorization patterns
 */
export async function getCompanyCategorizationPatterns(companyId: string): Promise<CategoryLearning[]> {
  const corrections = await prisma.activityLog.findMany({
    where: {
      companyId,
      action: 'category_correction'
    },
    orderBy: { timestamp: 'desc' },
    take: 100
  })
  
  const patterns: CategoryLearning[] = []
  
  for (const log of corrections) {
    const changes = log.changes as any
    if (changes?.keywords && changes?.correctedCategory) {
      patterns.push({
        keywords: changes.keywords,
        category: changes.correctedCategory as Category,
        confidence: 85, // User corrections are high confidence
        companyId
      })
    }
  }
  
  return patterns
}

/**
 * Extract keywords from description
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set(['to', 'from', 'for', 'the', 'and', 'or', 'payment', 'paid', 'ref', 'txn', 'transfer'])
  
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 5)
}

/**
 * Apply learned patterns to categorization
 */
export function applyLearnedPatterns(
  description: string,
  patterns: CategoryLearning[]
): { category: Category; confidence: number } | null {
  const descLower = description.toLowerCase()
  
  for (const pattern of patterns) {
    const matchCount = pattern.keywords.filter(k => descLower.includes(k)).length
    if (matchCount >= 2 || (pattern.keywords.length === 1 && matchCount === 1)) {
      return {
        category: pattern.category,
        confidence: pattern.confidence * (matchCount / pattern.keywords.length)
      }
    }
  }
  
  return null
}
