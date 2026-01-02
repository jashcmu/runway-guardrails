import { prisma } from '@/lib/prisma'
import { parseCSVStatement, parsePDFStatement } from '@/lib/bank-parser'

/**
 * Bank Reconciliation System with Intelligent Matching
 */

export interface BankTransaction {
  date: Date
  description: string
  amount: number
  type: 'debit' | 'credit'
}

export interface ReconciliationMatch {
  bankTransaction: BankTransaction
  systemTransaction: any | null
  matchConfidence: number // 0-100
  matchType: 'exact' | 'fuzzy' | 'unmatched'
  suggestedAction: string
}

export interface ReconciliationResult {
  matches: ReconciliationMatch[]
  totalBankTransactions: number
  totalMatched: number
  totalUnmatched: number
  reconciliationDifference: number
}

/**
 * Calculate similarity between two strings (0-100)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 100

  // Simple word-based matching
  const words1 = s1.split(/\s+/)
  const words2 = s2.split(/\s+/)

  let matchedWords = 0
  for (const word1 of words1) {
    if (words2.some((word2) => word2.includes(word1) || word1.includes(word2))) {
      matchedWords++
    }
  }

  return (matchedWords / Math.max(words1.length, words2.length)) * 100
}

/**
 * Match a bank transaction with system transactions
 */
async function matchBankTransaction(
  companyId: string,
  bankTxn: BankTransaction
): Promise<ReconciliationMatch> {
  // Get transactions within ±5 days
  const startDate = new Date(bankTxn.date)
  startDate.setDate(startDate.getDate() - 5)
  const endDate = new Date(bankTxn.date)
  endDate.setDate(endDate.getDate() + 5)

  // Search in both expenses and revenues
  const [expenses, revenues] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        amount: {
          gte: bankTxn.amount * 0.99, // Allow 1% variance
          lte: bankTxn.amount * 1.01,
        },
      },
    }),
    prisma.revenue.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        amount: {
          gte: bankTxn.amount * 0.99,
          lte: bankTxn.amount * 1.01,
        },
      },
    }),
  ])

  let bestMatch: any = null
  let bestConfidence = 0
  let matchType: 'exact' | 'fuzzy' | 'unmatched' = 'unmatched'

  // Check expenses
  for (const expense of expenses) {
    const descSimilarity = calculateStringSimilarity(
      bankTxn.description,
      expense.description || ''
    )
    const dateMatch = Math.abs(bankTxn.date.getTime() - expense.date.getTime()) / (1000 * 60 * 60 * 24)
    const amountMatch = 100 - Math.abs((bankTxn.amount - expense.amount) / bankTxn.amount) * 100

    const confidence = (descSimilarity * 0.5 + (100 - dateMatch * 10) * 0.3 + amountMatch * 0.2)

    if (confidence > bestConfidence) {
      bestConfidence = confidence
      bestMatch = { ...expense, _type: 'expense' }

      if (confidence >= 80 && dateMatch <= 2) {
        matchType = 'exact'
      } else if (confidence >= 60) {
        matchType = 'fuzzy'
      }
    }
  }

  // Check revenues
  for (const revenue of revenues) {
    const descSimilarity = calculateStringSimilarity(
      bankTxn.description,
      revenue.description
    )
    const dateMatch = Math.abs(bankTxn.date.getTime() - revenue.date.getTime()) / (1000 * 60 * 60 * 24)
    const amountMatch = 100 - Math.abs((bankTxn.amount - revenue.amount) / bankTxn.amount) * 100

    const confidence = (descSimilarity * 0.5 + (100 - dateMatch * 10) * 0.3 + amountMatch * 0.2)

    if (confidence > bestConfidence) {
      bestConfidence = confidence
      bestMatch = { ...revenue, _type: 'revenue' }

      if (confidence >= 80 && dateMatch <= 2) {
        matchType = 'exact'
      } else if (confidence >= 60) {
        matchType = 'fuzzy'
      }
    }
  }

  let suggestedAction = ''
  if (matchType === 'exact') {
    suggestedAction = 'Auto-approve match'
  } else if (matchType === 'fuzzy') {
    suggestedAction = 'Review and confirm match'
  } else {
    if (bankTxn.type === 'debit') {
      suggestedAction = 'Create missing expense transaction'
    } else {
      suggestedAction = 'Create missing revenue transaction'
    }
  }

  return {
    bankTransaction: bankTxn,
    systemTransaction: bestMatch,
    matchConfidence: Math.round(bestConfidence),
    matchType,
    suggestedAction,
  }
}

/**
 * Reconcile bank statement with system transactions
 */
export async function reconcileBankStatement(
  companyId: string,
  bankAccountId: string,
  statementData: string,
  fileType: 'csv' | 'pdf'
): Promise<ReconciliationResult> {
  console.log(`\n🏦 Starting bank reconciliation for company ${companyId}...`)

  // Parse bank statement
  let bankTransactions: BankTransaction[] = []

  if (fileType === 'csv') {
    const parsed = parseCSVStatement(statementData)
    bankTransactions = parsed.map((txn) => ({
      date: txn.date,
      description: txn.description,
      amount: Math.abs(txn.amount),
      type: txn.type,
    }))
  } else {
    const parsed = parsePDFStatement(statementData)
    bankTransactions = parsed.map((txn) => ({
      date: txn.date,
      description: txn.description,
      amount: Math.abs(txn.amount),
      type: txn.type,
    }))
  }

  console.log(`📄 Parsed ${bankTransactions.length} bank transactions`)

  // Match each bank transaction
  const matches: ReconciliationMatch[] = []
  let totalMatched = 0

  for (const bankTxn of bankTransactions) {
    const match = await matchBankTransaction(companyId, bankTxn)
    matches.push(match)

    if (match.matchType !== 'unmatched') {
      totalMatched++
      console.log(
        `  ${match.matchType === 'exact' ? '✓' : '~'} Matched: ${bankTxn.description} (${match.matchConfidence}% confidence)`
      )
    } else {
      console.log(`  ✗ Unmatched: ${bankTxn.description}`)
    }
  }

  const totalUnmatched = bankTransactions.length - totalMatched

  console.log(`\n✅ Reconciliation complete:`)
  console.log(`  - Total transactions: ${bankTransactions.length}`)
  console.log(`  - Matched: ${totalMatched} (${((totalMatched / bankTransactions.length) * 100).toFixed(1)}%)`)
  console.log(`  - Unmatched: ${totalUnmatched}`)
  console.log('')

  return {
    matches,
    totalBankTransactions: bankTransactions.length,
    totalMatched,
    totalUnmatched,
    reconciliationDifference: 0, // Can be calculated based on unmatched transactions
  }
}

/**
 * Create reconciliation record
 */
export async function createReconciliationRecord(
  companyId: string,
  bankAccountId: string,
  statementDate: Date,
  statementBalance: number,
  bookBalance: number
): Promise<any> {
  const difference = statementBalance - bookBalance

  return await prisma.bankReconciliation.create({
    data: {
      companyId,
      bankAccountId,
      statementDate,
      statementBalance,
      bookBalance,
      difference,
      isReconciled: Math.abs(difference) < 0.01,
    },
  })
}



