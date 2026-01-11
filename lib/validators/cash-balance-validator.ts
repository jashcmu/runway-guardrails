/**
 * Cash Balance Validator
 * Validates and reconciles cash balance calculations
 * 
 * Features:
 * - Recalculates cash balance from transactions
 * - Compares with stored balance
 * - Flags discrepancies
 * - Optionally prevents negative balance
 */

import { prisma } from '../prisma'

// Types
export interface CashBalanceValidation {
  isValid: boolean
  storedBalance: number
  calculatedBalance: number
  discrepancy: number
  percentDiff: number
  details: BalanceDetails
  errors: string[]
  warnings: string[]
}

export interface BalanceDetails {
  totalCredits: number
  totalDebits: number
  netChange: number
  transactionCount: number
  oldestTransaction: Date | null
  newestTransaction: Date | null
}

export interface ARAPValidation {
  arIsValid: boolean
  apIsValid: boolean
  storedAR: number
  calculatedAR: number
  arDiscrepancy: number
  storedAP: number
  calculatedAP: number
  apDiscrepancy: number
  details: {
    unpaidInvoicesCount: number
    unpaidInvoicesTotal: number
    unpaidBillsCount: number
    unpaidBillsTotal: number
    overdueInvoicesCount: number
    overdueBillsCount: number
  }
}

// Configuration
const DISCREPANCY_THRESHOLD = 0.01 // 1% threshold for flagging

/**
 * Validate cash balance for a company
 */
export async function validateCashBalance(
  companyId: string,
  initialBalance: number = 0
): Promise<CashBalanceValidation> {
  const errors: string[] = []
  const warnings: string[] = []

  // Get stored company balance
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { cashBalance: true }
  })

  if (!company) {
    return {
      isValid: false,
      storedBalance: 0,
      calculatedBalance: 0,
      discrepancy: 0,
      percentDiff: 0,
      details: {
        totalCredits: 0,
        totalDebits: 0,
        netChange: 0,
        transactionCount: 0,
        oldestTransaction: null,
        newestTransaction: null
      },
      errors: ['Company not found'],
      warnings: []
    }
  }

  // Get all transactions
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      amount: true,
      date: true
    },
    orderBy: { date: 'asc' }
  })

  // Calculate balance from transactions
  let totalCredits = 0
  let totalDebits = 0

  for (const txn of transactions) {
    if (txn.amount > 0) {
      totalCredits += txn.amount
    } else {
      totalDebits += Math.abs(txn.amount)
    }
  }

  const netChange = totalCredits - totalDebits
  const calculatedBalance = initialBalance + netChange

  // Calculate discrepancy
  const discrepancy = Math.abs(company.cashBalance - calculatedBalance)
  const percentDiff = company.cashBalance !== 0 
    ? (discrepancy / Math.abs(company.cashBalance)) * 100 
    : (calculatedBalance !== 0 ? 100 : 0)

  // Check for issues
  if (discrepancy > 1 && percentDiff > DISCREPANCY_THRESHOLD * 100) {
    errors.push(
      `Cash balance discrepancy: Stored ₹${company.cashBalance.toLocaleString('en-IN')} vs ` +
      `Calculated ₹${calculatedBalance.toLocaleString('en-IN')} (${percentDiff.toFixed(2)}% difference)`
    )
  }

  if (company.cashBalance < 0) {
    warnings.push('Cash balance is negative')
  }

  if (calculatedBalance < 0) {
    warnings.push('Calculated balance from transactions is negative')
  }

  // Date details
  const oldestTransaction = transactions.length > 0 ? transactions[0].date : null
  const newestTransaction = transactions.length > 0 ? transactions[transactions.length - 1].date : null

  return {
    isValid: errors.length === 0,
    storedBalance: company.cashBalance,
    calculatedBalance,
    discrepancy,
    percentDiff,
    details: {
      totalCredits,
      totalDebits,
      netChange,
      transactionCount: transactions.length,
      oldestTransaction,
      newestTransaction
    },
    errors,
    warnings
  }
}

/**
 * Validate AR (Accounts Receivable) and AP (Accounts Payable)
 */
export async function validateARAP(companyId: string): Promise<ARAPValidation> {
  // Calculate AR from unpaid invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['draft', 'sent', 'pending'] },
      balanceAmount: { gt: 0 }
    },
    select: {
      balanceAmount: true,
      totalAmount: true,
      dueDate: true
    }
  })

  const now = new Date()
  const calculatedAR = unpaidInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || inv.totalAmount), 0)
  const overdueInvoices = unpaidInvoices.filter(inv => inv.dueDate && inv.dueDate < now)

  // Calculate AP from unpaid bills
  const unpaidBills = await prisma.bill.findMany({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial'] },
      balanceAmount: { gt: 0 }
    },
    select: {
      balanceAmount: true,
      totalAmount: true,
      dueDate: true
    }
  })

  const calculatedAP = unpaidBills.reduce((sum, bill) => sum + bill.balanceAmount, 0)
  const overdueBills = unpaidBills.filter(bill => bill.dueDate && bill.dueDate < now)

  // Note: The current schema doesn't have stored AR/AP fields on Company
  // These would need to be added for full validation
  // For now, we just return the calculated values

  return {
    arIsValid: true, // Would compare with stored value
    apIsValid: true, // Would compare with stored value
    storedAR: calculatedAR, // No stored field yet
    calculatedAR,
    arDiscrepancy: 0,
    storedAP: calculatedAP, // No stored field yet
    calculatedAP,
    apDiscrepancy: 0,
    details: {
      unpaidInvoicesCount: unpaidInvoices.length,
      unpaidInvoicesTotal: calculatedAR,
      unpaidBillsCount: unpaidBills.length,
      unpaidBillsTotal: calculatedAP,
      overdueInvoicesCount: overdueInvoices.length,
      overdueBillsCount: overdueBills.length
    }
  }
}

/**
 * Recalculate and fix cash balance
 */
export async function recalculateCashBalance(
  companyId: string,
  initialBalance: number = 0,
  dryRun: boolean = true
): Promise<{
  oldBalance: number
  newBalance: number
  difference: number
  updated: boolean
}> {
  const validation = await validateCashBalance(companyId, initialBalance)

  if (validation.isValid) {
    return {
      oldBalance: validation.storedBalance,
      newBalance: validation.storedBalance,
      difference: 0,
      updated: false
    }
  }

  if (!dryRun) {
    await prisma.company.update({
      where: { id: companyId },
      data: { cashBalance: validation.calculatedBalance }
    })
  }

  return {
    oldBalance: validation.storedBalance,
    newBalance: validation.calculatedBalance,
    difference: validation.discrepancy,
    updated: !dryRun
  }
}

/**
 * Get cash flow summary for a period
 */
export async function getCashFlowSummary(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  openingBalance: number
  closingBalance: number
  totalInflows: number
  totalOutflows: number
  netChange: number
  byCategory: Record<string, { inflows: number; outflows: number }>
}> {
  // Get transactions in period
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      amount: true,
      category: true,
      date: true
    },
    orderBy: { date: 'asc' }
  })

  // Get balance before start date
  const transactionsBeforeStart = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { lt: startDate }
    },
    select: { amount: true }
  })

  const balanceBeforeStart = transactionsBeforeStart.reduce((sum, t) => sum + t.amount, 0)
  
  // Calculate flows
  let totalInflows = 0
  let totalOutflows = 0
  const byCategory: Record<string, { inflows: number; outflows: number }> = {}

  for (const txn of transactions) {
    if (txn.amount > 0) {
      totalInflows += txn.amount
    } else {
      totalOutflows += Math.abs(txn.amount)
    }

    if (!byCategory[txn.category]) {
      byCategory[txn.category] = { inflows: 0, outflows: 0 }
    }

    if (txn.amount > 0) {
      byCategory[txn.category].inflows += txn.amount
    } else {
      byCategory[txn.category].outflows += Math.abs(txn.amount)
    }
  }

  const netChange = totalInflows - totalOutflows

  return {
    openingBalance: balanceBeforeStart,
    closingBalance: balanceBeforeStart + netChange,
    totalInflows,
    totalOutflows,
    netChange,
    byCategory
  }
}

/**
 * Validate runway calculation
 */
export async function validateRunway(companyId: string): Promise<{
  cashBalance: number
  monthlyBurn: number
  calculatedRunway: number
  storedRunway: number | null
  isValid: boolean
  warnings: string[]
}> {
  const warnings: string[] = []

  // Get company
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { cashBalance: true, targetMonths: true }
  })

  if (!company) {
    return {
      cashBalance: 0,
      monthlyBurn: 0,
      calculatedRunway: 0,
      storedRunway: null,
      isValid: false,
      warnings: ['Company not found']
    }
  }

  // Calculate monthly burn from last 3 months
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const expenses = await prisma.transaction.findMany({
    where: {
      companyId,
      amount: { lt: 0 },
      date: { gte: threeMonthsAgo }
    },
    select: { amount: true }
  })

  const totalExpenses = expenses.reduce((sum, exp) => sum + Math.abs(exp.amount), 0)
  const monthlyBurn = totalExpenses / 3

  // Calculate runway
  const calculatedRunway = monthlyBurn > 0 
    ? Math.floor(company.cashBalance / monthlyBurn)
    : 999

  // Check discrepancy
  if (company.targetMonths && Math.abs(company.targetMonths - calculatedRunway) > 1) {
    warnings.push(
      `Runway discrepancy: Stored ${company.targetMonths} months vs Calculated ${calculatedRunway} months`
    )
  }

  // Add relevant warnings
  if (calculatedRunway < 6) {
    warnings.push(`Low runway warning: Only ${calculatedRunway} months of runway remaining`)
  }

  if (calculatedRunway < 3) {
    warnings.push(`CRITICAL: Less than 3 months of runway`)
  }

  return {
    cashBalance: company.cashBalance,
    monthlyBurn,
    calculatedRunway,
    storedRunway: company.targetMonths,
    isValid: warnings.length === 0,
    warnings
  }
}
