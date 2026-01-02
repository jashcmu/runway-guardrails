import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

/**
 * AI Anomaly Detection
 * Detects unusual transactions and patterns
 */

export interface Anomaly {
  transactionId: string
  type: 'amount' | 'duplicate' | 'frequency' | 'newVendor'
  severity: 'low' | 'medium' | 'high'
  message: string
  confidence: number
  suggestedAction: string
}

/**
 * Detect anomalies in transactions
 */
export async function detectAnomalies(companyId: string, lookbackDays = 90): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []

  // Get historical transactions
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - lookbackDays)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate },
    },
    orderBy: { date: 'desc' },
  })

  if (transactions.length < 10) {
    return anomalies // Not enough data
  }

  // Calculate category averages
  const categoryStats = new Map<Category, { avg: number; count: number; max: number }>()

  for (const txn of transactions) {
    const stats = categoryStats.get(txn.category) || { avg: 0, count: 0, max: 0 }
    stats.avg = (stats.avg * stats.count + txn.amount) / (stats.count + 1)
    stats.count++
    stats.max = Math.max(stats.max, txn.amount)
    categoryStats.set(txn.category, stats)
  }

  // Check each transaction for anomalies
  for (const txn of transactions) {
    const stats = categoryStats.get(txn.category)
    if (!stats) continue

    // ANOMALY 1: Amount significantly higher than average
    if (txn.amount > stats.avg * 3 && stats.count >= 5) {
      anomalies.push({
        transactionId: txn.id,
        type: 'amount',
        severity: txn.amount > stats.avg * 5 ? 'high' : 'medium',
        message: `${txn.description}: ₹${txn.amount.toLocaleString('en-IN')} is ${Math.round(txn.amount / stats.avg)}x higher than average ₹${Math.round(stats.avg).toLocaleString('en-IN')} for ${txn.category}`,
        confidence: 85,
        suggestedAction: 'Review transaction for accuracy',
      })
    }

    // ANOMALY 2: Check for duplicates (same amount, same day or next day)
    const duplicates = transactions.filter(
      (t) =>
        t.id !== txn.id &&
        Math.abs(t.amount - txn.amount) < 1 &&
        Math.abs(t.date.getTime() - txn.date.getTime()) < 48 * 60 * 60 * 1000
    )

    if (duplicates.length > 0) {
      anomalies.push({
        transactionId: txn.id,
        type: 'duplicate',
        severity: 'medium',
        message: `Possible duplicate payment: ${txn.description} (₹${txn.amount.toLocaleString('en-IN')}) appears ${duplicates.length + 1} times`,
        confidence: 70,
        suggestedAction: 'Check for duplicate payments',
      })
    }
  }

  // ANOMALY 3: New high-value vendor
  const recentTransactions = transactions.filter((t) => {
    const daysSince = (Date.now() - t.date.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 30
  })

  const vendorHistory = new Map<string, number>()
  for (const txn of transactions) {
    if (txn.description) {
      vendorHistory.set(txn.description, (vendorHistory.get(txn.description) || 0) + 1)
    }
  }

  for (const txn of recentTransactions) {
    if (txn.description && txn.amount > 50000) {
      const history = vendorHistory.get(txn.description) || 0
      if (history <= 1) {
        anomalies.push({
          transactionId: txn.id,
          type: 'newVendor',
          severity: txn.amount > 100000 ? 'high' : 'low',
          message: `New vendor with large payment: ${txn.description} (₹${txn.amount.toLocaleString('en-IN')})`,
          confidence: 60,
          suggestedAction: 'Verify vendor identity and payment authorization',
        })
      }
    }
  }

  return anomalies
}

/**
 * Learning-based categorization improvement
 * Stores user corrections to improve future categorization
 */
export interface CategoryLearning {
  keywords: string[]
  category: Category
  confidence: number
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
  // In a full implementation, this would:
  // 1. Extract keywords from description
  // 2. Store in a company-specific learning table
  // 3. Use this data to improve future categorization

  console.log(
    `📚 Learning: "${description}" → ${originalCategory} corrected to ${correctedCategory} for company ${companyId}`
  )

  // TODO: Implement persistent storage of learned patterns
}

/**
 * Get company-specific categorization patterns
 */
export async function getCompanyCategorizationPatterns(companyId: string): Promise<CategoryLearning[]> {
  // TODO: Implement retrieval of learned patterns from database

  return []
}




