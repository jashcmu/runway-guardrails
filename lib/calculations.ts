import { Transaction } from '@prisma/client'
import { prisma } from './prisma'

type TransactionWithAmount = Pick<Transaction, 'date' | 'amount' | 'expenseType' | 'frequency' | 'endDate'>

/**
 * Calculate monthly burn rate with recurring vs one-time awareness.
 * Recurring expenses are counted at their frequency-adjusted rate (until endDate if specified).
 * One-time expenses are amortized over 12 months or company age (whichever is less).
 */
export function calculateMonthlyBurn(transactions: TransactionWithAmount[]): number {
  if (transactions.length === 0) {
    return 0
  }

  const now = new Date()

  // Separate recurring and one-time expenses
  const recurringExpenses = transactions.filter(t => t.expenseType === 'recurring')
  const oneTimeExpenses = transactions.filter(t => t.expenseType === 'one-time')

  // Calculate recurring monthly burn (only count active recurring expenses)
  let recurringMonthlyBurn = 0
  
  for (const transaction of recurringExpenses) {
    // Skip if expense has ended
    if (transaction.endDate && new Date(transaction.endDate) < now) {
      continue
    }

    const amount = typeof transaction.amount === 'number'
      ? transaction.amount
      : parseFloat(String(transaction.amount))
    
    // Convert to monthly amount based on frequency
    const frequency = transaction.frequency || 'monthly'
    switch (frequency) {
      case 'monthly':
        recurringMonthlyBurn += amount
        break
      case 'quarterly':
        recurringMonthlyBurn += amount / 3
        break
      case 'yearly':
        recurringMonthlyBurn += amount / 12
        break
      case 'weekly':
        recurringMonthlyBurn += amount * 4.33 // Average weeks per month
        break
      default:
        recurringMonthlyBurn += amount // Assume monthly if not specified
    }
  }

  // For one-time expenses, amortize over company history (max 12 months)
  if (oneTimeExpenses.length > 0) {
    const allDates = transactions.map(t => new Date(t.date).getTime())
    const oldestExpense = new Date(Math.min(...allDates))
    
    // Calculate months of history (minimum 1 month)
    const monthsOfHistory = Math.max(
      1, 
      Math.ceil((now.getTime() - oldestExpense.getTime()) / (30 * 24 * 60 * 60 * 1000))
    )
    
    const oneTimeTotal = oneTimeExpenses.reduce((sum, txn) => {
      const amount = typeof txn.amount === 'number' 
        ? txn.amount 
        : parseFloat(String(txn.amount))
      return sum + amount
    }, 0)
    
    // Amortize one-time expenses over history period (max 12 months)
    const amortizationPeriod = Math.min(12, monthsOfHistory)
    const amortizedOneTime = oneTimeTotal / amortizationPeriod
    
    return recurringMonthlyBurn + amortizedOneTime
  }

  return recurringMonthlyBurn
}

/**
 * Calculate runway with consideration for recurring expenses that end.
 * This provides a more accurate projection by accounting for when expenses stop.
 */
export function calculateSmartRunway(
  cashBalance: number,
  transactions: TransactionWithAmount[]
): number | null {
  if (cashBalance <= 0 || transactions.length === 0) {
    return null
  }

  const now = new Date()
  let remainingCash = cashBalance
  let monthsCounter = 0
  const maxMonths = 120 // 10 years maximum projection

  while (remainingCash > 0 && monthsCounter < maxMonths) {
    const projectionDate = new Date(now.getTime() + monthsCounter * 30 * 24 * 60 * 60 * 1000)
    
    // Calculate burn for this specific month
    let monthBurn = 0

    // Add recurring expenses that are still active in this projection month
    for (const txn of transactions.filter(t => t.expenseType === 'recurring')) {
      // Skip if expense hasn't started yet or has already ended
      const startDate = new Date(txn.date)
      const endDate = txn.endDate ? new Date(txn.endDate) : null
      
      if (startDate > projectionDate) continue
      if (endDate && endDate < projectionDate) continue

      const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
      const frequency = txn.frequency || 'monthly'

      switch (frequency) {
        case 'monthly':
          monthBurn += amount
          break
        case 'quarterly':
          monthBurn += amount / 3
          break
        case 'yearly':
          monthBurn += amount / 12
          break
        case 'weekly':
          monthBurn += amount * 4.33
          break
        default:
          monthBurn += amount
      }
    }

    // Amortize one-time expenses
    const oneTimeExpenses = transactions.filter(t => t.expenseType === 'one-time')
    if (oneTimeExpenses.length > 0) {
      const oneTimeTotal = oneTimeExpenses.reduce((sum, txn) => {
        const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
        return sum + amount
      }, 0)
      monthBurn += oneTimeTotal / 12 // Amortize over 12 months
    }

    remainingCash -= monthBurn
    monthsCounter++
  }

  return monthsCounter
}

/**
 * Calculate runway in months based on cash balance and monthly burn rate.
 * Returns 0 if burn rate is 0 or negative to avoid division issues.
 */
export function calculateRunway(cashBalance: number, monthlyBurn: number): number {
  if (monthlyBurn <= 0) {
    return cashBalance > 0 ? Infinity : 0
  }

  return cashBalance / monthlyBurn
}

/**
 * Get monthly burn for a company by fetching transactions and calculating with recurring awareness.
 */
export async function getMonthlyBurnForCompany(companyId: string): Promise<number> {
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      date: true,
      amount: true,
      expenseType: true,
      frequency: true,
      endDate: true,
    },
    orderBy: {
      date: 'asc',
    },
  })

  return calculateMonthlyBurn(transactions)
}

/**
 * Get smart runway for a company that accounts for limited-duration recurring expenses.
 */
export async function getSmartRunwayForCompany(companyId: string, cashBalance: number): Promise<number | null> {
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      date: true,
      amount: true,
      expenseType: true,
      frequency: true,
      endDate: true,
    },
    orderBy: {
      date: 'asc',
    },
  })

  return calculateSmartRunway(cashBalance, transactions)
}

/**
 * Get runway in months for a company given a cash balance.
 * Uses smart runway calculation that accounts for limited-duration recurring expenses.
 */
export async function getRunwayForCompany(
  companyId: string,
  cashBalance: number
): Promise<number> {
  // Use smart runway if there are transactions, otherwise fall back to simple calculation
  const smartRunway = await getSmartRunwayForCompany(companyId, cashBalance)
  
  if (smartRunway !== null) {
    return smartRunway
  }
  
  // Fallback: simple calculation
  const monthlyBurn = await getMonthlyBurnForCompany(companyId)
  return calculateRunway(cashBalance, monthlyBurn)
}

/**
 * Get data quality info to show appropriate warnings to users.
 * Returns info about how much historical data is available.
 */
export async function getDataQuality(companyId: string): Promise<{
  hasEnoughData: boolean
  monthsOfData: number
  totalTransactions: number
  message: string
}> {
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: { date: true },
  })

  if (transactions.length === 0) {
    return {
      hasEnoughData: false,
      monthsOfData: 0,
      totalTransactions: 0,
      message: 'No transactions yet. Add expenses to see accurate runway calculations.',
    }
  }

  // Count unique months
  const months = new Set<string>()
  for (const txn of transactions) {
    const date = new Date(txn.date)
    months.add(`${date.getFullYear()}-${date.getMonth() + 1}`)
  }

  const monthsOfData = months.size
  const hasEnoughData = monthsOfData >= 2

  let message = ''
  if (monthsOfData === 1) {
    message = `Based on ${transactions.length} transaction${transactions.length > 1 ? 's' : ''} this month. Add more data for accurate trends.`
  } else if (monthsOfData === 2) {
    message = `Based on ${transactions.length} transactions over ${monthsOfData} months. Getting better!`
  } else {
    message = `Based on ${transactions.length} transactions over ${monthsOfData} months.`
  }

  return {
    hasEnoughData,
    monthsOfData,
    totalTransactions: transactions.length,
    message,
  }
}

