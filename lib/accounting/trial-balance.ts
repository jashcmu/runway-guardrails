import { prisma } from '@/lib/prisma'

/**
 * Trial Balance Calculation and Validation
 * Ensures accounting equation: Assets = Liabilities + Equity
 */

export interface TrialBalanceEntry {
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
  balance: number
}

export interface TrialBalanceResult {
  entries: TrialBalanceEntry[]
  totalDebits: number
  totalCredits: number
  difference: number
  isBalanced: boolean
  asOfDate: Date
}

/**
 * Calculate trial balance for a company
 */
export async function calculateTrialBalance(companyId: string, asOfDate?: Date): Promise<TrialBalanceResult> {
  const effectiveDate = asOfDate || new Date()

  // Get all accounts
  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: { accountCode: 'asc' },
  })

  // Get journal entries up to the date
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      date: { lte: effectiveDate },
    },
    include: {
      account: true,
    },
  })

  // Calculate balances for each account
  const accountBalances = new Map<string, { debit: number; credit: number }>()

  for (const entry of journalEntries) {
    const accountId = entry.accountId
    if (!accountBalances.has(accountId)) {
      accountBalances.set(accountId, { debit: 0, credit: 0 })
    }

    const balance = accountBalances.get(accountId)!
    balance.debit += entry.debit
    balance.credit += entry.credit
  }

  // Build trial balance entries
  const entries: TrialBalanceEntry[] = []
  let totalDebits = 0
  let totalCredits = 0

  for (const account of accounts) {
    const balance = accountBalances.get(account.id) || { debit: 0, credit: 0 }
    const netBalance = balance.debit - balance.credit

    // Determine debit/credit side based on account type
    let debit = 0
    let credit = 0

    if (account.type === 'Asset' || account.type === 'Expense') {
      // Assets and Expenses have debit balance
      if (netBalance >= 0) {
        debit = netBalance
      } else {
        credit = Math.abs(netBalance)
      }
    } else {
      // Liabilities, Equity, Revenue have credit balance
      if (netBalance >= 0) {
        credit = netBalance
      } else {
        debit = Math.abs(netBalance)
      }
    }

    // Only include accounts with non-zero balances
    if (debit !== 0 || credit !== 0) {
      entries.push({
        accountCode: account.accountCode,
        accountName: account.name,
        accountType: account.type,
        debit,
        credit,
        balance: account.balance, // Current balance from account
      })

      totalDebits += debit
      totalCredits += credit
    }
  }

  const difference = Math.abs(totalDebits - totalCredits)
  const isBalanced = difference < 0.01 // Allow 1 paisa rounding error

  return {
    entries,
    totalDebits,
    totalCredits,
    difference,
    isBalanced,
    asOfDate: effectiveDate,
  }
}

/**
 * Validate that books are balanced
 */
export async function validateBooksBalance(companyId: string): Promise<{ isBalanced: boolean; message: string }> {
  const trialBalance = await calculateTrialBalance(companyId)

  if (trialBalance.isBalanced) {
    return {
      isBalanced: true,
      message: `Books are balanced. Total Debits: ₹${trialBalance.totalDebits.toFixed(2)}, Total Credits: ₹${trialBalance.totalCredits.toFixed(2)}`,
    }
  } else {
    return {
      isBalanced: false,
      message: `Books NOT balanced! Difference: ₹${trialBalance.difference.toFixed(2)}. Total Debits: ₹${trialBalance.totalDebits.toFixed(2)}, Total Credits: ₹${trialBalance.totalCredits.toFixed(2)}`,
    }
  }
}

/**
 * Get account balances by type
 */
export async function getAccountBalancesByType(companyId: string) {
  const accounts = await prisma.account.findMany({
    where: { companyId },
  })

  const balancesByType: Record<string, number> = {
    Asset: 0,
    Liability: 0,
    Equity: 0,
    Revenue: 0,
    Expense: 0,
  }

  for (const account of accounts) {
    balancesByType[account.type] += account.balance
  }

  return balancesByType
}

/**
 * Verify accounting equation: Assets = Liabilities + Equity
 */
export async function verifyAccountingEquation(companyId: string): Promise<{ isValid: boolean; message: string }> {
  const balances = await getAccountBalancesByType(companyId)

  const assets = balances.Asset
  const liabilities = balances.Liability
  const equity = balances.Equity

  const leftSide = assets
  const rightSide = liabilities + equity

  const difference = Math.abs(leftSide - rightSide)
  const isValid = difference < 0.01

  if (isValid) {
    return {
      isValid: true,
      message: `Accounting equation balanced: Assets (₹${assets.toFixed(2)}) = Liabilities (₹${liabilities.toFixed(2)}) + Equity (₹${equity.toFixed(2)})`,
    }
  } else {
    return {
      isValid: false,
      message: `Accounting equation NOT balanced! Assets: ₹${assets.toFixed(2)}, Liabilities + Equity: ₹${rightSide.toFixed(2)}, Difference: ₹${difference.toFixed(2)}`,
    }
  }
}



