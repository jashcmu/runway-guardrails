/**
 * Data Integrity Checker
 * Scheduled checks to ensure data consistency
 * 
 * Validations:
 * - AR = Sum of unpaid invoices
 * - AP = Sum of unpaid bills
 * - Cash balance = Initial + Sum(transactions)
 * - No orphaned transactions
 * - No duplicate transactions
 */

import { prisma } from './prisma'
import { validateCashBalance, validateARAP } from './validators/cash-balance-validator'
import { findExistingDuplicates } from './duplicate-detector'

// Types
export interface IntegrityCheckResult {
  checkName: string
  passed: boolean
  details: string
  fixable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface FullIntegrityReport {
  companyId: string
  timestamp: Date
  overallStatus: 'pass' | 'warning' | 'fail'
  checks: IntegrityCheckResult[]
  summary: {
    totalChecks: number
    passed: number
    warnings: number
    failures: number
  }
}

/**
 * Run all integrity checks for a company
 */
export async function runFullIntegrityCheck(
  companyId: string
): Promise<FullIntegrityReport> {
  const checks: IntegrityCheckResult[] = []

  // 1. Cash Balance Check
  const cashBalanceCheck = await checkCashBalance(companyId)
  checks.push(cashBalanceCheck)

  // 2. AR Consistency Check
  const arCheck = await checkARConsistency(companyId)
  checks.push(arCheck)

  // 3. AP Consistency Check
  const apCheck = await checkAPConsistency(companyId)
  checks.push(apCheck)

  // 4. Orphaned Transactions Check
  const orphanCheck = await checkOrphanedTransactions(companyId)
  checks.push(orphanCheck)

  // 5. Duplicate Transactions Check
  const duplicateCheck = await checkDuplicateTransactions(companyId)
  checks.push(duplicateCheck)

  // 6. Invoice Status Consistency
  const invoiceCheck = await checkInvoiceStatusConsistency(companyId)
  checks.push(invoiceCheck)

  // 7. Bill Status Consistency
  const billCheck = await checkBillStatusConsistency(companyId)
  checks.push(billCheck)

  // 8. Transaction Date Validity
  const dateCheck = await checkTransactionDates(companyId)
  checks.push(dateCheck)

  // 9. Category Distribution Check
  const categoryCheck = await checkCategoryDistribution(companyId)
  checks.push(categoryCheck)

  // Calculate summary
  const passed = checks.filter(c => c.passed).length
  const failures = checks.filter(c => !c.passed && c.severity === 'critical').length
  const warnings = checks.filter(c => !c.passed && c.severity !== 'critical').length

  let overallStatus: 'pass' | 'warning' | 'fail' = 'pass'
  if (failures > 0) overallStatus = 'fail'
  else if (warnings > 0) overallStatus = 'warning'

  return {
    companyId,
    timestamp: new Date(),
    overallStatus,
    checks,
    summary: {
      totalChecks: checks.length,
      passed,
      warnings,
      failures
    }
  }
}

/**
 * Check cash balance consistency
 */
async function checkCashBalance(companyId: string): Promise<IntegrityCheckResult> {
  const validation = await validateCashBalance(companyId)

  if (validation.isValid) {
    return {
      checkName: 'Cash Balance Consistency',
      passed: true,
      details: `Cash balance ₹${validation.storedBalance.toLocaleString('en-IN')} matches calculated balance`,
      fixable: false,
      severity: 'low'
    }
  }

  return {
    checkName: 'Cash Balance Consistency',
    passed: false,
    details: `Discrepancy of ₹${validation.discrepancy.toLocaleString('en-IN')} (${validation.percentDiff.toFixed(2)}%)`,
    fixable: true,
    severity: validation.percentDiff > 5 ? 'critical' : 'high'
  }
}

/**
 * Check AR (Accounts Receivable) consistency
 */
async function checkARConsistency(companyId: string): Promise<IntegrityCheckResult> {
  const validation = await validateARAP(companyId)

  // Check for invoices marked as paid but with balance
  const inconsistentInvoices = await prisma.invoice.count({
    where: {
      companyId,
      status: 'paid',
      balanceAmount: { gt: 0 }
    }
  })

  if (inconsistentInvoices > 0) {
    return {
      checkName: 'AR Consistency',
      passed: false,
      details: `${inconsistentInvoices} invoices marked as paid but have remaining balance`,
      fixable: true,
      severity: 'high'
    }
  }

  return {
    checkName: 'AR Consistency',
    passed: true,
    details: `AR total: ₹${validation.calculatedAR.toLocaleString('en-IN')} from ${validation.details.unpaidInvoicesCount} unpaid invoices`,
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check AP (Accounts Payable) consistency
 */
async function checkAPConsistency(companyId: string): Promise<IntegrityCheckResult> {
  const validation = await validateARAP(companyId)

  // Check for bills marked as paid but with balance
  const inconsistentBills = await prisma.bill.count({
    where: {
      companyId,
      paymentStatus: 'paid',
      balanceAmount: { gt: 0 }
    }
  })

  if (inconsistentBills > 0) {
    return {
      checkName: 'AP Consistency',
      passed: false,
      details: `${inconsistentBills} bills marked as paid but have remaining balance`,
      fixable: true,
      severity: 'high'
    }
  }

  return {
    checkName: 'AP Consistency',
    passed: true,
    details: `AP total: ₹${validation.calculatedAP.toLocaleString('en-IN')} from ${validation.details.unpaidBillsCount} unpaid bills`,
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check for orphaned transactions (no company)
 */
async function checkOrphanedTransactions(companyId: string): Promise<IntegrityCheckResult> {
  // This shouldn't happen due to foreign key constraints, but check anyway
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: { id: true, companyId: true }
  })

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true }
  })

  if (!company) {
    return {
      checkName: 'Orphaned Transactions',
      passed: false,
      details: `Company not found but ${transactions.length} transactions exist`,
      fixable: false,
      severity: 'critical'
    }
  }

  return {
    checkName: 'Orphaned Transactions',
    passed: true,
    details: 'All transactions are properly linked to company',
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check for duplicate transactions
 */
async function checkDuplicateTransactions(companyId: string): Promise<IntegrityCheckResult> {
  const { totalDuplicates } = await findExistingDuplicates(companyId)

  if (totalDuplicates > 10) {
    return {
      checkName: 'Duplicate Transactions',
      passed: false,
      details: `${totalDuplicates} potential duplicate transactions found`,
      fixable: true,
      severity: 'high'
    }
  }

  if (totalDuplicates > 0) {
    return {
      checkName: 'Duplicate Transactions',
      passed: false,
      details: `${totalDuplicates} potential duplicate transactions found`,
      fixable: true,
      severity: 'medium'
    }
  }

  return {
    checkName: 'Duplicate Transactions',
    passed: true,
    details: 'No duplicate transactions detected',
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check invoice status consistency
 */
async function checkInvoiceStatusConsistency(companyId: string): Promise<IntegrityCheckResult> {
  // Check for overdue invoices not marked as overdue
  const now = new Date()
  const overdueNotMarked = await prisma.invoice.count({
    where: {
      companyId,
      status: { in: ['draft', 'sent', 'pending'] },
      dueDate: { lt: now },
      balanceAmount: { gt: 0 }
    }
  })

  if (overdueNotMarked > 0) {
    return {
      checkName: 'Invoice Status Consistency',
      passed: false,
      details: `${overdueNotMarked} invoices are overdue but not marked as such`,
      fixable: true,
      severity: 'medium'
    }
  }

  return {
    checkName: 'Invoice Status Consistency',
    passed: true,
    details: 'All invoice statuses are consistent',
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check bill status consistency
 */
async function checkBillStatusConsistency(companyId: string): Promise<IntegrityCheckResult> {
  // Check for overdue bills not marked as overdue
  const now = new Date()
  const overdueNotMarked = await prisma.bill.count({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial'] },
      dueDate: { lt: now },
      balanceAmount: { gt: 0 }
    }
  })

  if (overdueNotMarked > 0) {
    return {
      checkName: 'Bill Status Consistency',
      passed: false,
      details: `${overdueNotMarked} bills are overdue but status may not reflect this`,
      fixable: true,
      severity: 'medium'
    }
  }

  return {
    checkName: 'Bill Status Consistency',
    passed: true,
    details: 'All bill statuses are consistent',
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check transaction date validity
 */
async function checkTransactionDates(companyId: string): Promise<IntegrityCheckResult> {
  const now = new Date()
  const futureLimit = new Date()
  futureLimit.setDate(futureLimit.getDate() + 7)

  const futureTxns = await prisma.transaction.count({
    where: {
      companyId,
      date: { gt: futureLimit }
    }
  })

  const tenYearsAgo = new Date()
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)

  const veryOldTxns = await prisma.transaction.count({
    where: {
      companyId,
      date: { lt: tenYearsAgo }
    }
  })

  if (futureTxns > 0 || veryOldTxns > 0) {
    return {
      checkName: 'Transaction Date Validity',
      passed: false,
      details: `${futureTxns} future transactions, ${veryOldTxns} very old transactions`,
      fixable: true,
      severity: futureTxns > 0 ? 'high' : 'medium'
    }
  }

  return {
    checkName: 'Transaction Date Validity',
    passed: true,
    details: 'All transaction dates are within valid range',
    fixable: false,
    severity: 'low'
  }
}

/**
 * Check category distribution for anomalies
 */
async function checkCategoryDistribution(companyId: string): Promise<IntegrityCheckResult> {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const categoryGroups = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      companyId,
      date: { gte: threeMonthsAgo },
      amount: { lt: 0 } // Only expenses
    },
    _count: true,
    _sum: { amount: true }
  })

  const total = categoryGroups.reduce((sum, g) => sum + g._count, 0)
  
  // Check if any category has more than 80% of transactions
  const dominantCategory = categoryGroups.find(g => g._count / total > 0.8)

  if (dominantCategory && total > 10) {
    return {
      checkName: 'Category Distribution',
      passed: false,
      details: `${dominantCategory.category} has ${Math.round((dominantCategory._count / total) * 100)}% of expenses - may need review`,
      fixable: false,
      severity: 'low'
    }
  }

  return {
    checkName: 'Category Distribution',
    passed: true,
    details: `Expenses distributed across ${categoryGroups.length} categories`,
    fixable: false,
    severity: 'low'
  }
}

/**
 * Fix common data integrity issues
 */
export async function fixIntegrityIssues(
  companyId: string,
  issues: string[] // Array of check names to fix
): Promise<{
  fixed: string[]
  failed: string[]
  details: Record<string, string>
}> {
  const fixed: string[] = []
  const failed: string[] = []
  const details: Record<string, string> = {}

  for (const issue of issues) {
    try {
      switch (issue) {
        case 'Cash Balance Consistency':
          // Recalculate cash balance from transactions
          const transactions = await prisma.transaction.findMany({
            where: { companyId },
            select: { amount: true }
          })
          const calculatedBalance = transactions.reduce((sum, t) => sum + t.amount, 0)
          
          await prisma.company.update({
            where: { id: companyId },
            data: { cashBalance: calculatedBalance }
          })
          
          fixed.push(issue)
          details[issue] = `Updated cash balance to ₹${calculatedBalance.toLocaleString('en-IN')}`
          break

        case 'AR Consistency':
          // Fix invoices marked as paid but with balance
          await prisma.invoice.updateMany({
            where: {
              companyId,
              status: 'paid',
              balanceAmount: { gt: 0 }
            },
            data: { status: 'partial' }
          })
          fixed.push(issue)
          details[issue] = 'Updated inconsistent invoice statuses'
          break

        case 'AP Consistency':
          // Fix bills marked as paid but with balance
          await prisma.bill.updateMany({
            where: {
              companyId,
              paymentStatus: 'paid',
              balanceAmount: { gt: 0 }
            },
            data: { paymentStatus: 'partial' }
          })
          fixed.push(issue)
          details[issue] = 'Updated inconsistent bill statuses'
          break

        case 'Invoice Status Consistency':
          // Mark overdue invoices
          const now = new Date()
          await prisma.invoice.updateMany({
            where: {
              companyId,
              status: { in: ['draft', 'sent', 'pending'] },
              dueDate: { lt: now },
              balanceAmount: { gt: 0 }
            },
            data: { status: 'overdue' }
          })
          fixed.push(issue)
          details[issue] = 'Updated overdue invoice statuses'
          break

        default:
          failed.push(issue)
          details[issue] = 'No automatic fix available'
      }
    } catch (error) {
      failed.push(issue)
      details[issue] = `Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  return { fixed, failed, details }
}

/**
 * Get data integrity summary
 */
export async function getIntegritySummary(companyId: string): Promise<{
  lastCheck: Date | null
  status: 'pass' | 'warning' | 'fail'
  issuesCount: number
  fixableCount: number
}> {
  const report = await runFullIntegrityCheck(companyId)

  return {
    lastCheck: report.timestamp,
    status: report.overallStatus,
    issuesCount: report.summary.warnings + report.summary.failures,
    fixableCount: report.checks.filter(c => !c.passed && c.fixable).length
  }
}
