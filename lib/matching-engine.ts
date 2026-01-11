/**
 * Intelligent Matching Engine
 * Matches bank transactions with invoices and bills using multiple criteria
 * 
 * Matching Criteria:
 * - Amount match (exact or within tolerance)
 * - Invoice/Bill number extraction
 * - Customer/Vendor name fuzzy matching
 * - Date proximity
 * - Combined weighted confidence score
 */

import { prisma } from './prisma'

// Types
export interface MatchingContext {
  description: string
  amount: number
  date: Date
  type: 'credit' | 'debit'
  companyId: string
}

export interface InvoiceMatch {
  invoiceId: string
  invoiceNumber: string
  customerName: string
  invoiceAmount: number
  confidence: number
  matchReasons: string[]
}

export interface BillMatch {
  billId: string
  billNumber: string
  vendorName: string
  billAmount: number
  confidence: number
  matchReasons: string[]
}

export interface MatchResult {
  hasMatch: boolean
  invoiceMatch?: InvoiceMatch
  billMatch?: BillMatch
  allInvoiceMatches?: InvoiceMatch[]
  allBillMatches?: BillMatch[]
}

// Matching weights
const WEIGHTS = {
  exactAmount: 40,
  closeAmount: 25,
  invoiceNumber: 30,
  customerName: 20,
  vendorName: 20,
  dateProximity: 10
}

// Tolerance thresholds
const AMOUNT_TOLERANCE_PERCENT = 0.01 // 1%
const AMOUNT_TOLERANCE_ABS = 1 // ₹1
const DATE_PROXIMITY_DAYS = 30
const MIN_MATCH_CONFIDENCE = 50

/**
 * Match a transaction with pending invoices (for credits/incoming payments)
 */
export async function matchInvoice(
  context: MatchingContext
): Promise<{ confidence: number; invoiceId?: string; invoiceNumber?: string; customerName?: string; allMatches?: InvoiceMatch[] }> {
  if (context.type !== 'credit') {
    return { confidence: 0, allMatches: [] }
  }

  const amount = Math.abs(context.amount)
  const txnDate = new Date(context.date)

  // Get all pending invoices for this company
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      companyId: context.companyId,
      status: { in: ['draft', 'sent', 'pending'] },
      balanceAmount: { gt: 0 }
    },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      totalAmount: true,
      balanceAmount: true,
      dueDate: true,
      invoiceDate: true
    }
  })

  const matches: InvoiceMatch[] = []

  for (const invoice of pendingInvoices) {
    let confidence = 0
    const matchReasons: string[] = []

    // 1. Amount matching
    const amountToMatch = invoice.balanceAmount || invoice.totalAmount
    const amountDiff = Math.abs(amount - amountToMatch)
    const amountDiffPercent = amountDiff / amountToMatch

    if (amountDiff <= AMOUNT_TOLERANCE_ABS) {
      confidence += WEIGHTS.exactAmount
      matchReasons.push('Exact amount match')
    } else if (amountDiffPercent <= AMOUNT_TOLERANCE_PERCENT) {
      confidence += WEIGHTS.closeAmount
      matchReasons.push(`Amount within ${(amountDiffPercent * 100).toFixed(1)}%`)
    }

    // 2. Invoice number matching
    const invoiceNumberMatch = extractAndMatchInvoiceNumber(
      context.description,
      invoice.invoiceNumber
    )
    if (invoiceNumberMatch.matched) {
      confidence += WEIGHTS.invoiceNumber
      matchReasons.push(`Invoice number match: ${invoice.invoiceNumber}`)
    }

    // 3. Customer name matching
    const nameMatch = fuzzyMatch(context.description, invoice.customerName)
    if (nameMatch.similarity > 0.6) {
      const nameScore = Math.round(WEIGHTS.customerName * nameMatch.similarity)
      confidence += nameScore
      matchReasons.push(`Customer name match: ${invoice.customerName} (${Math.round(nameMatch.similarity * 100)}%)`)
    }

    // 4. Date proximity
    if (invoice.dueDate) {
      const daysDiff = Math.abs(
        (txnDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff <= DATE_PROXIMITY_DAYS) {
        const dateScore = Math.round(WEIGHTS.dateProximity * (1 - daysDiff / DATE_PROXIMITY_DAYS))
        confidence += dateScore
        matchReasons.push(`Payment ${Math.round(daysDiff)} days from due date`)
      }
    }

    if (confidence >= MIN_MATCH_CONFIDENCE) {
      matches.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        invoiceAmount: amountToMatch,
        confidence,
        matchReasons
      })
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence)

  if (matches.length > 0) {
    const bestMatch = matches[0]
    return {
      confidence: bestMatch.confidence,
      invoiceId: bestMatch.invoiceId,
      invoiceNumber: bestMatch.invoiceNumber,
      customerName: bestMatch.customerName,
      allMatches: matches
    }
  }

  return { confidence: 0, allMatches: [] }
}

/**
 * Match a transaction with pending bills (for debits/outgoing payments)
 */
export async function matchBill(
  context: MatchingContext
): Promise<{ confidence: number; billId?: string; billNumber?: string; vendorName?: string; allMatches?: BillMatch[] }> {
  if (context.type !== 'debit') {
    return { confidence: 0, allMatches: [] }
  }

  const amount = Math.abs(context.amount)
  const txnDate = new Date(context.date)

  // Get all pending bills for this company
  const pendingBills = await prisma.bill.findMany({
    where: {
      companyId: context.companyId,
      paymentStatus: { in: ['unpaid', 'partial'] },
      balanceAmount: { gt: 0 }
    },
    select: {
      id: true,
      billNumber: true,
      vendorName: true,
      totalAmount: true,
      balanceAmount: true,
      dueDate: true,
      billDate: true
    }
  })

  const matches: BillMatch[] = []

  for (const bill of pendingBills) {
    let confidence = 0
    const matchReasons: string[] = []

    // 1. Amount matching
    const amountToMatch = bill.balanceAmount
    const amountDiff = Math.abs(amount - amountToMatch)
    const amountDiffPercent = amountDiff / amountToMatch

    if (amountDiff <= AMOUNT_TOLERANCE_ABS) {
      confidence += WEIGHTS.exactAmount
      matchReasons.push('Exact amount match')
    } else if (amountDiffPercent <= AMOUNT_TOLERANCE_PERCENT) {
      confidence += WEIGHTS.closeAmount
      matchReasons.push(`Amount within ${(amountDiffPercent * 100).toFixed(1)}%`)
    }

    // 2. Bill number matching
    const billNumberMatch = extractAndMatchBillNumber(
      context.description,
      bill.billNumber
    )
    if (billNumberMatch.matched) {
      confidence += WEIGHTS.invoiceNumber // Same weight as invoice number
      matchReasons.push(`Bill number match: ${bill.billNumber}`)
    }

    // 3. Vendor name matching
    const nameMatch = fuzzyMatch(context.description, bill.vendorName)
    if (nameMatch.similarity > 0.6) {
      const nameScore = Math.round(WEIGHTS.vendorName * nameMatch.similarity)
      confidence += nameScore
      matchReasons.push(`Vendor name match: ${bill.vendorName} (${Math.round(nameMatch.similarity * 100)}%)`)
    }

    // 4. Date proximity
    if (bill.dueDate) {
      const daysDiff = Math.abs(
        (txnDate.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff <= DATE_PROXIMITY_DAYS) {
        const dateScore = Math.round(WEIGHTS.dateProximity * (1 - daysDiff / DATE_PROXIMITY_DAYS))
        confidence += dateScore
        matchReasons.push(`Payment ${Math.round(daysDiff)} days from due date`)
      }
    }

    if (confidence >= MIN_MATCH_CONFIDENCE) {
      matches.push({
        billId: bill.id,
        billNumber: bill.billNumber,
        vendorName: bill.vendorName,
        billAmount: amountToMatch,
        confidence,
        matchReasons
      })
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence)

  if (matches.length > 0) {
    const bestMatch = matches[0]
    return {
      confidence: bestMatch.confidence,
      billId: bestMatch.billId,
      billNumber: bestMatch.billNumber,
      vendorName: bestMatch.vendorName,
      allMatches: matches
    }
  }

  return { confidence: 0, allMatches: [] }
}

/**
 * Full matching function - tries both invoice and bill matching
 */
export async function matchTransaction(context: MatchingContext): Promise<MatchResult> {
  if (context.type === 'credit') {
    const invoiceResult = await matchInvoice(context)
    
    if (invoiceResult.confidence >= MIN_MATCH_CONFIDENCE && invoiceResult.invoiceId) {
      return {
        hasMatch: true,
        invoiceMatch: {
          invoiceId: invoiceResult.invoiceId,
          invoiceNumber: invoiceResult.invoiceNumber!,
          customerName: invoiceResult.customerName!,
          invoiceAmount: context.amount,
          confidence: invoiceResult.confidence,
          matchReasons: invoiceResult.allMatches?.[0]?.matchReasons || []
        },
        allInvoiceMatches: invoiceResult.allMatches
      }
    }
  }

  if (context.type === 'debit') {
    const billResult = await matchBill(context)
    
    if (billResult.confidence >= MIN_MATCH_CONFIDENCE && billResult.billId) {
      return {
        hasMatch: true,
        billMatch: {
          billId: billResult.billId,
          billNumber: billResult.billNumber!,
          vendorName: billResult.vendorName!,
          billAmount: context.amount,
          confidence: billResult.confidence,
          matchReasons: billResult.allMatches?.[0]?.matchReasons || []
        },
        allBillMatches: billResult.allMatches
      }
    }
  }

  return { hasMatch: false }
}

/**
 * Extract and match invoice number from description
 */
function extractAndMatchInvoiceNumber(
  description: string,
  invoiceNumber: string
): { matched: boolean; extractedNumber?: string } {
  const desc = description.toUpperCase()
  const invNum = invoiceNumber.toUpperCase()

  // Direct match
  if (desc.includes(invNum)) {
    return { matched: true, extractedNumber: invoiceNumber }
  }

  // Extract patterns
  const patterns = [
    /INV[-#]?(\d+)/i,
    /INVOICE\s*#?\s*(\d+)/i,
    /INV[-_]?([A-Z0-9]+)/i,
    /#(\d{4,})/
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match) {
      const extracted = match[1]
      // Check if extracted number matches invoice number
      if (invNum.includes(extracted) || extracted.includes(invNum.replace(/\D/g, ''))) {
        return { matched: true, extractedNumber: extracted }
      }
    }
  }

  return { matched: false }
}

/**
 * Extract and match bill number from description
 */
function extractAndMatchBillNumber(
  description: string,
  billNumber: string
): { matched: boolean; extractedNumber?: string } {
  const desc = description.toUpperCase()
  const billNum = billNumber.toUpperCase()

  // Direct match
  if (desc.includes(billNum)) {
    return { matched: true, extractedNumber: billNumber }
  }

  // Extract patterns
  const patterns = [
    /BILL[-#]?(\d+)/i,
    /BILL\s*#?\s*(\d+)/i,
    /BILL[-_]?([A-Z0-9]+)/i,
    /PO[-#]?(\d+)/i
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match) {
      const extracted = match[1]
      // Check if extracted number matches bill number
      if (billNum.includes(extracted) || extracted.includes(billNum.replace(/\D/g, ''))) {
        return { matched: true, extractedNumber: extracted }
      }
    }
  }

  return { matched: false }
}

/**
 * Fuzzy string matching using Levenshtein distance
 */
function fuzzyMatch(str1: string, str2: string): { similarity: number; matched: boolean } {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  // Direct containment check
  if (s1.includes(s2) || s2.includes(s1)) {
    return { similarity: 0.9, matched: true }
  }

  // Word-based matching
  const words1 = s1.split(/\s+/)
  const words2 = s2.split(/\s+/)
  
  let matchedWords = 0
  for (const word1 of words1) {
    if (word1.length < 3) continue
    for (const word2 of words2) {
      if (word2.length < 3) continue
      if (word1.includes(word2) || word2.includes(word1)) {
        matchedWords++
        break
      }
    }
  }

  const wordSimilarity = matchedWords / Math.max(
    words1.filter(w => w.length >= 3).length,
    words2.filter(w => w.length >= 3).length,
    1
  )

  if (wordSimilarity >= 0.5) {
    return { similarity: wordSimilarity, matched: true }
  }

  // Levenshtein distance for closer matching
  const distance = levenshteinDistance(s1, s2)
  const maxLen = Math.max(s1.length, s2.length)
  const similarity = 1 - distance / maxLen

  return { similarity, matched: similarity >= 0.6 }
}

/**
 * Calculate Levenshtein distance between two strings
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
 * Reconcile matched invoice - mark as paid
 */
export async function reconcileInvoice(
  invoiceId: string,
  paymentAmount: number,
  paymentDate: Date
): Promise<{ success: boolean; newStatus: string; remainingBalance: number }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  })

  if (!invoice) {
    return { success: false, newStatus: 'not_found', remainingBalance: 0 }
  }

  const currentPaid = invoice.paidAmount || 0
  const newPaidAmount = currentPaid + paymentAmount
  const newBalanceAmount = invoice.totalAmount - newPaidAmount
  const newStatus = newBalanceAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : invoice.status)

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: Math.max(0, newBalanceAmount),
      status: newStatus,
      paidDate: newStatus === 'paid' ? paymentDate : undefined
    }
  })

  return {
    success: true,
    newStatus,
    remainingBalance: Math.max(0, newBalanceAmount)
  }
}

/**
 * Reconcile matched bill - mark as paid
 */
export async function reconcileBill(
  billId: string,
  paymentAmount: number,
  paymentDate: Date
): Promise<{ success: boolean; newStatus: string; remainingBalance: number }> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId }
  })

  if (!bill) {
    return { success: false, newStatus: 'not_found', remainingBalance: 0 }
  }

  const currentPaid = bill.paidAmount || 0
  const newPaidAmount = currentPaid + paymentAmount
  const newBalanceAmount = bill.totalAmount - newPaidAmount
  const newStatus = newBalanceAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid')

  await prisma.bill.update({
    where: { id: billId },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: Math.max(0, newBalanceAmount),
      paymentStatus: newStatus,
      paymentDate: newStatus === 'paid' ? paymentDate : undefined
    }
  })

  return {
    success: true,
    newStatus,
    remainingBalance: Math.max(0, newBalanceAmount)
  }
}

/**
 * Get matching summary for a batch of transactions
 */
export async function getMatchingSummary(
  companyId: string,
  transactions: MatchingContext[]
): Promise<{
  total: number
  matched: number
  unmatched: number
  matchRate: number
  byConfidence: { high: number; medium: number; low: number }
}> {
  let matched = 0
  let high = 0
  let medium = 0
  let low = 0

  for (const txn of transactions) {
    const result = await matchTransaction(txn)
    
    if (result.hasMatch) {
      matched++
      const confidence = result.invoiceMatch?.confidence || result.billMatch?.confidence || 0
      
      if (confidence >= 80) high++
      else if (confidence >= 60) medium++
      else low++
    }
  }

  return {
    total: transactions.length,
    matched,
    unmatched: transactions.length - matched,
    matchRate: transactions.length > 0 ? (matched / transactions.length) * 100 : 0,
    byConfidence: { high, medium, low }
  }
}
