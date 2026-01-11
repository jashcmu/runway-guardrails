/**
 * Duplicate Transaction Detector
 * Prevents double-counting of transactions
 * 
 * Detection Methods:
 * - Same amount + date (±1 day) + description similarity
 * - Bank transaction ID matching (if available)
 * - Reference number matching
 */

import { prisma } from './prisma'

// Types
export interface DuplicateCheckContext {
  description: string
  amount: number
  date: Date
  companyId: string
  referenceNumber?: string
  bankTransactionId?: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matchedTransactionId?: string
  matchConfidence: number
  matchReason?: string
}

// Thresholds
const DATE_TOLERANCE_DAYS = 1
const AMOUNT_TOLERANCE_PERCENT = 0.005 // 0.5%
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.8

/**
 * Check if a transaction is a duplicate
 */
export async function checkForDuplicates(
  context: DuplicateCheckContext
): Promise<DuplicateCheckResult> {
  // 1. Check by bank transaction ID (most reliable)
  if (context.bankTransactionId) {
    const matchById = await checkByBankTransactionId(context)
    if (matchById.isDuplicate) return matchById
  }

  // 2. Check by reference number
  if (context.referenceNumber) {
    const matchByRef = await checkByReferenceNumber(context)
    if (matchByRef.isDuplicate) return matchByRef
  }

  // 3. Check by amount + date + description
  const matchByContent = await checkByContent(context)
  if (matchByContent.isDuplicate) return matchByContent

  return { isDuplicate: false, matchConfidence: 0 }
}

/**
 * Check by bank transaction ID
 */
async function checkByBankTransactionId(
  context: DuplicateCheckContext
): Promise<DuplicateCheckResult> {
  // Look for existing transaction with same bank transaction ID in description
  const existing = await prisma.transaction.findFirst({
    where: {
      companyId: context.companyId,
      description: { contains: context.bankTransactionId, mode: 'insensitive' }
    },
    select: { id: true }
  })

  if (existing) {
    return {
      isDuplicate: true,
      matchedTransactionId: existing.id,
      matchConfidence: 100,
      matchReason: 'Bank transaction ID match'
    }
  }

  return { isDuplicate: false, matchConfidence: 0 }
}

/**
 * Check by reference number
 */
async function checkByReferenceNumber(
  context: DuplicateCheckContext
): Promise<DuplicateCheckResult> {
  const existing = await prisma.transaction.findFirst({
    where: {
      companyId: context.companyId,
      description: { contains: context.referenceNumber, mode: 'insensitive' }
    },
    select: { id: true }
  })

  if (existing) {
    return {
      isDuplicate: true,
      matchedTransactionId: existing.id,
      matchConfidence: 95,
      matchReason: 'Reference number match'
    }
  }

  return { isDuplicate: false, matchConfidence: 0 }
}

/**
 * Check by amount, date, and description similarity
 */
async function checkByContent(
  context: DuplicateCheckContext
): Promise<DuplicateCheckResult> {
  const startDate = new Date(context.date)
  startDate.setDate(startDate.getDate() - DATE_TOLERANCE_DAYS)
  
  const endDate = new Date(context.date)
  endDate.setDate(endDate.getDate() + DATE_TOLERANCE_DAYS)

  const amountMin = context.amount * (1 - AMOUNT_TOLERANCE_PERCENT)
  const amountMax = context.amount * (1 + AMOUNT_TOLERANCE_PERCENT)

  // Find transactions within date and amount range
  const candidates = await prisma.transaction.findMany({
    where: {
      companyId: context.companyId,
      date: {
        gte: startDate,
        lte: endDate
      },
      amount: {
        gte: -amountMax,
        lte: amountMax
      }
    },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true
    }
  })

  // Filter by absolute amount match
  const amountMatches = candidates.filter(c => 
    Math.abs(Math.abs(c.amount) - context.amount) <= context.amount * AMOUNT_TOLERANCE_PERCENT
  )

  // Check description similarity for each candidate
  for (const candidate of amountMatches) {
    if (!candidate.description) continue

    const similarity = calculateSimilarity(
      context.description.toLowerCase(),
      candidate.description.toLowerCase()
    )

    if (similarity >= DESCRIPTION_SIMILARITY_THRESHOLD) {
      return {
        isDuplicate: true,
        matchedTransactionId: candidate.id,
        matchConfidence: Math.round(similarity * 100),
        matchReason: `Content match: ${Math.round(similarity * 100)}% description similarity`
      }
    }
  }

  // Check for exact amount + same day (even without description match)
  const exactAmountSameDay = amountMatches.filter(c => {
    const cDate = new Date(c.date)
    const tDate = new Date(context.date)
    return cDate.toDateString() === tDate.toDateString() &&
           Math.abs(Math.abs(c.amount) - context.amount) < 1
  })

  if (exactAmountSameDay.length > 0) {
    // High chance of duplicate if exact amount on same day
    return {
      isDuplicate: true,
      matchedTransactionId: exactAmountSameDay[0].id,
      matchConfidence: 85,
      matchReason: 'Exact amount match on same day'
    }
  }

  return { isDuplicate: false, matchConfidence: 0 }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim()
  const s2 = str2.trim()

  if (s1 === s2) return 1

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 || len2 === 0) return 0

  // Use word-based comparison for better results
  const words1 = s1.split(/\s+/).filter(w => w.length > 2)
  const words2 = s2.split(/\s+/).filter(w => w.length > 2)

  if (words1.length === 0 || words2.length === 0) {
    // Fall back to character-level comparison
    const distance = levenshteinDistance(s1, s2)
    return 1 - distance / Math.max(len1, len2)
  }

  // Calculate word overlap
  let matchedWords = 0
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchedWords++
        break
      }
    }
  }

  return matchedWords / Math.max(words1.length, words2.length)
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length

  if (len1 === 0) return len2
  if (len2 === 0) return len1

  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Batch duplicate check for multiple transactions
 */
export async function checkBatchForDuplicates(
  transactions: DuplicateCheckContext[]
): Promise<Map<number, DuplicateCheckResult>> {
  const results = new Map<number, DuplicateCheckResult>()

  for (let i = 0; i < transactions.length; i++) {
    const result = await checkForDuplicates(transactions[i])
    results.set(i, result)
  }

  return results
}

/**
 * Find potential duplicates in existing transactions
 * Useful for cleanup/audit
 */
export async function findExistingDuplicates(
  companyId: string
): Promise<{
  duplicateGroups: Array<{
    transactions: Array<{ id: string; description: string | null; amount: number; date: Date }>
    matchReason: string
  }>
  totalDuplicates: number
}> {
  const allTransactions = await prisma.transaction.findMany({
    where: { companyId },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true
    }
  })

  const duplicateGroups: Array<{
    transactions: Array<{ id: string; description: string | null; amount: number; date: Date }>
    matchReason: string
  }> = []
  const processedIds = new Set<string>()

  for (let i = 0; i < allTransactions.length; i++) {
    if (processedIds.has(allTransactions[i].id)) continue

    const txn = allTransactions[i]
    const duplicates: typeof allTransactions = [txn]

    for (let j = i + 1; j < allTransactions.length; j++) {
      if (processedIds.has(allTransactions[j].id)) continue

      const candidate = allTransactions[j]
      
      // Check for potential duplicate
      const daysDiff = Math.abs(
        (txn.date.getTime() - candidate.date.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (daysDiff <= DATE_TOLERANCE_DAYS) {
        const amountMatch = Math.abs(txn.amount) === Math.abs(candidate.amount)
        
        if (amountMatch && txn.description && candidate.description) {
          const similarity = calculateSimilarity(
            txn.description.toLowerCase(),
            candidate.description.toLowerCase()
          )
          
          if (similarity >= DESCRIPTION_SIMILARITY_THRESHOLD) {
            duplicates.push(candidate)
            processedIds.add(candidate.id)
          }
        }
      }
    }

    if (duplicates.length > 1) {
      processedIds.add(txn.id)
      duplicateGroups.push({
        transactions: duplicates,
        matchReason: `${duplicates.length} transactions with same amount within ${DATE_TOLERANCE_DAYS} day(s) and similar description`
      })
    }
  }

  return {
    duplicateGroups,
    totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.transactions.length - 1, 0)
  }
}

/**
 * Remove duplicate transactions (keep the first occurrence)
 */
export async function removeDuplicates(
  companyId: string,
  dryRun: boolean = true
): Promise<{
  duplicatesFound: number
  duplicatesRemoved: number
  removedIds: string[]
}> {
  const { duplicateGroups, totalDuplicates } = await findExistingDuplicates(companyId)
  
  const idsToRemove: string[] = []

  for (const group of duplicateGroups) {
    // Keep the first transaction (oldest), remove the rest
    const sorted = group.transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    for (let i = 1; i < sorted.length; i++) {
      idsToRemove.push(sorted[i].id)
    }
  }

  if (!dryRun && idsToRemove.length > 0) {
    await prisma.transaction.deleteMany({
      where: {
        id: { in: idsToRemove },
        companyId
      }
    })
  }

  return {
    duplicatesFound: totalDuplicates,
    duplicatesRemoved: dryRun ? 0 : idsToRemove.length,
    removedIds: dryRun ? [] : idsToRemove
  }
}
