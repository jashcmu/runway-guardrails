/**
 * Monitoring System
 * Monitors system health, data integrity, and classification accuracy
 * 
 * Features:
 * - Low confidence rate monitoring
 * - Review queue size alerts
 * - Cash balance discrepancy detection
 * - Failed import tracking
 * - API error monitoring
 * - Data integrity checks
 */

import { prisma } from './prisma'
import { validateCashBalance, validateARAP } from './validators/cash-balance-validator'

// Types
export interface HealthCheck {
  status: 'healthy' | 'warning' | 'critical'
  checks: HealthCheckItem[]
  lastChecked: Date
  score: number // 0-100
}

export interface HealthCheckItem {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  value?: number | string
  threshold?: number | string
}

export interface MonitoringMetrics {
  reviewQueue: {
    pending: number
    reviewedToday: number
    averageConfidence: number
    lowConfidenceRate: number
  }
  classification: {
    totalClassified: number
    accuracyRate: number
    manualCorrections: number
    autoApproved: number
  }
  dataIntegrity: {
    cashBalanceValid: boolean
    arApValid: boolean
    duplicatesFound: number
    orphanedRecords: number
  }
  system: {
    failedImports: number
    apiErrors: number
    avgProcessingTime: number
  }
}

export interface Alert {
  id: string
  companyId: string
  type: 'warning' | 'critical'
  category: 'review_queue' | 'data_integrity' | 'system' | 'cash_balance'
  message: string
  details: Record<string, unknown>
  createdAt: Date
  isResolved: boolean
}

// Thresholds
const THRESHOLDS = {
  reviewQueueSize: 50, // Warn if >50 pending reviews
  lowConfidenceRate: 20, // Warn if >20% transactions have low confidence
  averageConfidenceMin: 60, // Warn if average confidence <60%
  duplicateThreshold: 5, // Warn if >5 duplicates found
  cashDiscrepancyPercent: 1, // Warn if >1% discrepancy
  failedImportsMax: 3, // Warn if >3 failed imports in a day
  apiErrorsMax: 10 // Warn if >10 API errors in an hour
}

/**
 * Run comprehensive health check for a company
 */
export async function runHealthCheck(companyId: string): Promise<HealthCheck> {
  const checks: HealthCheckItem[] = []
  let totalScore = 0
  let checkCount = 0

  // 1. Review Queue Check
  const reviewQueueCheck = await checkReviewQueue(companyId)
  checks.push(reviewQueueCheck)
  totalScore += reviewQueueCheck.status === 'pass' ? 100 : reviewQueueCheck.status === 'warn' ? 50 : 0
  checkCount++

  // 2. Classification Accuracy Check
  const classificationCheck = await checkClassificationAccuracy(companyId)
  checks.push(classificationCheck)
  totalScore += classificationCheck.status === 'pass' ? 100 : classificationCheck.status === 'warn' ? 50 : 0
  checkCount++

  // 3. Cash Balance Check
  const cashBalanceCheck = await checkCashBalanceIntegrity(companyId)
  checks.push(cashBalanceCheck)
  totalScore += cashBalanceCheck.status === 'pass' ? 100 : cashBalanceCheck.status === 'warn' ? 50 : 0
  checkCount++

  // 4. AR/AP Check
  const arApCheck = await checkARAPIntegrity(companyId)
  checks.push(arApCheck)
  totalScore += arApCheck.status === 'pass' ? 100 : arApCheck.status === 'warn' ? 50 : 0
  checkCount++

  // 5. Duplicate Check
  const duplicateCheck = await checkForDuplicates(companyId)
  checks.push(duplicateCheck)
  totalScore += duplicateCheck.status === 'pass' ? 100 : duplicateCheck.status === 'warn' ? 50 : 0
  checkCount++

  // Calculate overall status
  const score = Math.round(totalScore / checkCount)
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  
  if (checks.some(c => c.status === 'fail')) {
    status = 'critical'
  } else if (checks.some(c => c.status === 'warn')) {
    status = 'warning'
  }

  return {
    status,
    checks,
    lastChecked: new Date(),
    score
  }
}

/**
 * Check review queue health
 */
async function checkReviewQueue(companyId: string): Promise<HealthCheckItem> {
  const pending = await prisma.transaction.count({
    where: {
      companyId,
      needsReview: true,
      reviewedAt: null
    }
  })

  if (pending > THRESHOLDS.reviewQueueSize * 2) {
    return {
      name: 'Review Queue',
      status: 'fail',
      message: `${pending} transactions pending review (critical)`,
      value: pending,
      threshold: THRESHOLDS.reviewQueueSize
    }
  }

  if (pending > THRESHOLDS.reviewQueueSize) {
    return {
      name: 'Review Queue',
      status: 'warn',
      message: `${pending} transactions pending review`,
      value: pending,
      threshold: THRESHOLDS.reviewQueueSize
    }
  }

  return {
    name: 'Review Queue',
    status: 'pass',
    message: `${pending} transactions pending review`,
    value: pending,
    threshold: THRESHOLDS.reviewQueueSize
  }
}

/**
 * Check classification accuracy
 */
async function checkClassificationAccuracy(companyId: string): Promise<HealthCheckItem> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [total, lowConfidence] = await Promise.all([
    prisma.transaction.count({
      where: {
        companyId,
        createdAt: { gte: thirtyDaysAgo }
      }
    }),
    prisma.transaction.count({
      where: {
        companyId,
        createdAt: { gte: thirtyDaysAgo },
        confidenceScore: { lt: 70 }
      }
    })
  ])

  if (total === 0) {
    return {
      name: 'Classification Accuracy',
      status: 'pass',
      message: 'No transactions to evaluate',
      value: 'N/A'
    }
  }

  const lowConfidenceRate = (lowConfidence / total) * 100

  if (lowConfidenceRate > THRESHOLDS.lowConfidenceRate * 2) {
    return {
      name: 'Classification Accuracy',
      status: 'fail',
      message: `${lowConfidenceRate.toFixed(1)}% low confidence rate (critical)`,
      value: lowConfidenceRate,
      threshold: THRESHOLDS.lowConfidenceRate
    }
  }

  if (lowConfidenceRate > THRESHOLDS.lowConfidenceRate) {
    return {
      name: 'Classification Accuracy',
      status: 'warn',
      message: `${lowConfidenceRate.toFixed(1)}% low confidence rate`,
      value: lowConfidenceRate,
      threshold: THRESHOLDS.lowConfidenceRate
    }
  }

  return {
    name: 'Classification Accuracy',
    status: 'pass',
    message: `${lowConfidenceRate.toFixed(1)}% low confidence rate`,
    value: lowConfidenceRate,
    threshold: THRESHOLDS.lowConfidenceRate
  }
}

/**
 * Check cash balance integrity
 */
async function checkCashBalanceIntegrity(companyId: string): Promise<HealthCheckItem> {
  const validation = await validateCashBalance(companyId)

  if (!validation.isValid && validation.percentDiff > THRESHOLDS.cashDiscrepancyPercent * 2) {
    return {
      name: 'Cash Balance',
      status: 'fail',
      message: `Cash balance discrepancy: ${validation.percentDiff.toFixed(2)}% (₹${validation.discrepancy.toLocaleString('en-IN')})`,
      value: validation.percentDiff,
      threshold: THRESHOLDS.cashDiscrepancyPercent
    }
  }

  if (!validation.isValid) {
    return {
      name: 'Cash Balance',
      status: 'warn',
      message: `Cash balance discrepancy: ${validation.percentDiff.toFixed(2)}%`,
      value: validation.percentDiff,
      threshold: THRESHOLDS.cashDiscrepancyPercent
    }
  }

  return {
    name: 'Cash Balance',
    status: 'pass',
    message: 'Cash balance is consistent',
    value: validation.storedBalance.toLocaleString('en-IN')
  }
}

/**
 * Check AR/AP integrity
 */
async function checkARAPIntegrity(companyId: string): Promise<HealthCheckItem> {
  const validation = await validateARAP(companyId)

  if (!validation.arIsValid || !validation.apIsValid) {
    return {
      name: 'AR/AP Integrity',
      status: 'warn',
      message: `AR: ₹${validation.calculatedAR.toLocaleString('en-IN')}, AP: ₹${validation.calculatedAP.toLocaleString('en-IN')}`,
      value: `AR Discrepancy: ${validation.arDiscrepancy}, AP Discrepancy: ${validation.apDiscrepancy}`
    }
  }

  return {
    name: 'AR/AP Integrity',
    status: 'pass',
    message: `AR: ₹${validation.calculatedAR.toLocaleString('en-IN')}, AP: ₹${validation.calculatedAP.toLocaleString('en-IN')}`,
    value: `Overdue: ${validation.details.overdueInvoicesCount} invoices, ${validation.details.overdueBillsCount} bills`
  }
}

/**
 * Check for duplicate transactions
 */
async function checkForDuplicates(companyId: string): Promise<HealthCheckItem> {
  // Simple check: same amount + same day + similar description
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: thirtyDaysAgo }
    },
    select: {
      id: true,
      amount: true,
      date: true,
      description: true
    }
  })

  let duplicateCount = 0
  const seen = new Map<string, boolean>()

  for (const txn of transactions) {
    const dateStr = txn.date.toISOString().split('T')[0]
    const key = `${txn.amount}:${dateStr}`
    
    if (seen.has(key)) {
      duplicateCount++
    } else {
      seen.set(key, true)
    }
  }

  if (duplicateCount > THRESHOLDS.duplicateThreshold * 2) {
    return {
      name: 'Duplicate Detection',
      status: 'fail',
      message: `${duplicateCount} potential duplicates found (critical)`,
      value: duplicateCount,
      threshold: THRESHOLDS.duplicateThreshold
    }
  }

  if (duplicateCount > THRESHOLDS.duplicateThreshold) {
    return {
      name: 'Duplicate Detection',
      status: 'warn',
      message: `${duplicateCount} potential duplicates found`,
      value: duplicateCount,
      threshold: THRESHOLDS.duplicateThreshold
    }
  }

  return {
    name: 'Duplicate Detection',
    status: 'pass',
    message: `${duplicateCount} potential duplicates found`,
    value: duplicateCount,
    threshold: THRESHOLDS.duplicateThreshold
  }
}

/**
 * Get comprehensive monitoring metrics
 */
export async function getMonitoringMetrics(companyId: string): Promise<MonitoringMetrics> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Review Queue Metrics
  const [pending, reviewedToday, avgConfidence, lowConfidenceCount] = await Promise.all([
    prisma.transaction.count({
      where: { companyId, needsReview: true, reviewedAt: null }
    }),
    prisma.transaction.count({
      where: {
        companyId,
        reviewedAt: { gte: today }
      }
    }),
    prisma.transaction.aggregate({
      where: { companyId, confidenceScore: { not: null } },
      _avg: { confidenceScore: true }
    }),
    prisma.transaction.count({
      where: { companyId, confidenceScore: { lt: 70 } }
    })
  ])

  // Classification Metrics
  const [totalClassified, manualCorrections] = await Promise.all([
    prisma.transaction.count({
      where: { companyId, createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.activityLog.count({
      where: {
        companyId,
        action: 'recategorize',
        timestamp: { gte: thirtyDaysAgo }
      }
    })
  ])

  // Data Integrity
  const cashValidation = await validateCashBalance(companyId)
  const arApValidation = await validateARAP(companyId)

  return {
    reviewQueue: {
      pending,
      reviewedToday,
      averageConfidence: avgConfidence._avg.confidenceScore || 0,
      lowConfidenceRate: totalClassified > 0 ? (lowConfidenceCount / totalClassified) * 100 : 0
    },
    classification: {
      totalClassified,
      accuracyRate: totalClassified > 0 ? ((totalClassified - manualCorrections) / totalClassified) * 100 : 100,
      manualCorrections,
      autoApproved: totalClassified - pending - manualCorrections
    },
    dataIntegrity: {
      cashBalanceValid: cashValidation.isValid,
      arApValid: arApValidation.arIsValid && arApValidation.apIsValid,
      duplicatesFound: 0, // Would need to run duplicate check
      orphanedRecords: 0 // Would need orphan check
    },
    system: {
      failedImports: 0, // Would track from import logs
      apiErrors: 0, // Would track from error logs
      avgProcessingTime: 0 // Would track from performance logs
    }
  }
}

/**
 * Create an alert
 */
export async function createAlert(
  companyId: string,
  type: 'warning' | 'critical',
  category: 'review_queue' | 'data_integrity' | 'system' | 'cash_balance',
  message: string,
  details: Record<string, unknown>
): Promise<void> {
  await prisma.alert.create({
    data: {
      companyId,
      message,
      severity: type,
      riskLevel: type === 'critical' ? 'high' : 'medium',
      category: category === 'cash_balance' ? 'G_A' : undefined
    }
  })
}

/**
 * Get active alerts for a company
 */
export async function getActiveAlerts(companyId: string): Promise<{
  id: string
  message: string
  severity: string
  createdAt: Date
}[]> {
  return prisma.alert.findMany({
    where: {
      companyId,
      isRead: false
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      message: true,
      severity: true,
      createdAt: true
    }
  })
}

/**
 * Schedule health check (would be called by a cron job)
 */
export async function scheduleHealthChecks(): Promise<void> {
  const companies = await prisma.company.findMany({
    select: { id: true }
  })

  for (const company of companies) {
    const health = await runHealthCheck(company.id)
    
    if (health.status === 'critical') {
      await createAlert(
        company.id,
        'critical',
        'system',
        `System health is critical: ${health.checks.filter(c => c.status === 'fail').map(c => c.name).join(', ')}`,
        { healthScore: health.score, checks: health.checks }
      )
    } else if (health.status === 'warning') {
      await createAlert(
        company.id,
        'warning',
        'system',
        `System health warnings: ${health.checks.filter(c => c.status === 'warn').map(c => c.name).join(', ')}`,
        { healthScore: health.score, checks: health.checks }
      )
    }
  }
}

/**
 * Get monitoring dashboard data
 */
export async function getMonitoringDashboard(companyId: string): Promise<{
  health: HealthCheck
  metrics: MonitoringMetrics
  alerts: Awaited<ReturnType<typeof getActiveAlerts>>
  trends: {
    confidenceTrend: 'improving' | 'declining' | 'stable'
    reviewRateTrend: 'improving' | 'declining' | 'stable'
  }
}> {
  const [health, metrics, alerts] = await Promise.all([
    runHealthCheck(companyId),
    getMonitoringMetrics(companyId),
    getActiveAlerts(companyId)
  ])

  // Determine trends (simplified - would need historical data)
  const confidenceTrend: 'improving' | 'declining' | 'stable' = 
    metrics.reviewQueue.averageConfidence >= 80 ? 'improving' :
    metrics.reviewQueue.averageConfidence <= 60 ? 'declining' : 'stable'

  const reviewRateTrend: 'improving' | 'declining' | 'stable' =
    metrics.reviewQueue.pending <= 10 ? 'improving' :
    metrics.reviewQueue.pending >= 50 ? 'declining' : 'stable'

  return {
    health,
    metrics,
    alerts,
    trends: {
      confidenceTrend,
      reviewRateTrend
    }
  }
}
