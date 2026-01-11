// Enhanced Bank Statement Processor with Multi-Layer Classification
import { PrismaClient, Category } from '@prisma/client'
import { classifyExpense, detectSubscription } from './smart-expense-classifier'
import { classifyTransaction, ClassificationResult } from './transaction-classifier'
import { matchTransaction, reconcileInvoice, reconcileBill } from './matching-engine'
import { extractEntities } from './entity-extractor'
import { checkForDuplicates } from './duplicate-detector'

const prisma = new PrismaClient()

// Confidence threshold for auto-approval
const REVIEW_THRESHOLD = 70

type BankTransaction = {
  date: string
  description: string
  debit: number
  credit: number
  balance: number
}

type MatchedTransaction = {
  transaction: BankTransaction
  matchType: 'bill' | 'invoice' | 'expense' | 'revenue' | 'unmatched'
  matchedId?: string
  category?: Category
  confidenceScore?: number
  needsReview?: boolean
  classification?: ClassificationResult
}

type ProcessingResult = {
  transactions: MatchedTransaction[]
  cashBalanceChange: number
  newCashBalance: number
  billsPaid: number
  invoicesPaid: number
  newTransactions: number
  needsReviewCount: number
  duplicatesSkipped: number
  averageConfidence: number
}

export async function processBankStatement(
  fileContent: string | Buffer,
  companyId: string,
  bankAccountId?: string,
  isPDF = false
): Promise<ProcessingResult> {
  console.log(`\n🚀 Processing ${isPDF ? 'PDF' : 'CSV'} bank statement for company ${companyId}`)
  
  let rawTransactions: Array<{date: Date, description: string, debit: number, credit: number, balance?: number}>
  
  if (isPDF) {
    // Parse PDF
    const { parsePDFStatement } = await import('./simple-bank-parser')
    const pdfBuffer = fileContent as Buffer
    const parsed = await parsePDFStatement(pdfBuffer)
    
    rawTransactions = parsed.map(t => ({
      date: t.date,
      description: t.description,
      debit: t.type === 'debit' ? Math.abs(t.amount) : 0,
      credit: t.type === 'credit' ? Math.abs(t.amount) : 0,
      balance: t.balance,
    }))
  } else {
    // Parse CSV
    const { parseCSVStatement } = await import('./simple-bank-parser')
    const csvText = fileContent as string
    const parsed = parseCSVStatement(csvText)
    
    rawTransactions = parsed.map(t => ({
      date: t.date,
      description: t.description,
      debit: t.type === 'debit' ? Math.abs(t.amount) : 0,
      credit: t.type === 'credit' ? Math.abs(t.amount) : 0,
      balance: t.balance,
    }))
  }

  console.log(`✅ Parser returned ${rawTransactions.length} raw transactions`)

  const transactions: BankTransaction[] = rawTransactions.map(t => ({
    date: t.date.toISOString(),
    description: t.description,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance || 0,
  }))
  
  console.log(`✅ Converted to ${transactions.length} BankTransaction objects`)

  const matched: MatchedTransaction[] = []
  let cashChange = 0
  let billsPaid = 0
  let invoicesPaid = 0
  let newTxCount = 0
  let needsReviewCount = 0
  let duplicatesSkipped = 0
  let totalConfidence = 0

  for (const txn of transactions) {
    // Skip invalid rows
    if (!txn.date || !txn.description || (txn.debit === 0 && txn.credit === 0)) {
      continue
    }
    
    // Skip balance rows
    const descLower = txn.description.toLowerCase()
    if (descLower.includes('opening balance') || descLower.includes('closing balance')) {
      continue
    }

    const amount = txn.credit > 0 ? txn.credit : -txn.debit
    const txnType = txn.credit > 0 ? 'credit' : 'debit'
    
    const parsedDate = new Date(txn.date)
    if (isNaN(parsedDate.getTime())) {
      continue
    }

    // Check for duplicates
    const isDuplicate = await checkForDuplicates({
      description: txn.description,
      amount: Math.abs(amount),
      date: parsedDate,
      companyId
    })

    if (isDuplicate.isDuplicate) {
      duplicatesSkipped++
      continue
    }

    // Use multi-layer classification
    const classification = await classifyTransaction({
      description: txn.description,
      amount: Math.abs(amount),
      date: parsedDate,
      type: txnType,
      companyId
    })

    // Extract entities for additional context
    const entities = extractEntities(txn.description)

    // Determine if needs review
    const needsReview = classification.needsReview || classification.confidence < REVIEW_THRESHOLD

    let matchedItem: MatchedTransaction = {
      transaction: txn,
      matchType: 'unmatched',
      confidenceScore: classification.confidence,
      needsReview,
      classification
    }

    // Process based on classification type
    if (classification.type === 'invoice_payment' && classification.matchedInvoiceId) {
      // Invoice payment detected
      const result = await reconcileInvoice(
        classification.matchedInvoiceId,
        txn.credit,
        parsedDate
      )
      
      if (result.success) {
        matchedItem.matchType = 'invoice'
        matchedItem.matchedId = classification.matchedInvoiceId
        matchedItem.category = classification.category
        invoicesPaid++
      }
      cashChange += txn.credit
    } else if (classification.type === 'bill_payment' && classification.matchedBillId) {
      const result = await reconcileBill(
        classification.matchedBillId,
        txn.debit,
        parsedDate
      )
      
      if (result.success) {
        matchedItem.matchType = 'bill'
        matchedItem.matchedId = classification.matchedBillId
        matchedItem.category = classification.category
        billsPaid++
      }
      cashChange -= txn.debit
    } else if (txn.credit > 0) {
      matchedItem.matchType = 'revenue'
      matchedItem.category = classification.category
      cashChange += txn.credit
    } else if (txn.debit > 0) {
      matchedItem.matchType = 'expense'
      matchedItem.category = classification.category

      // Get historical transactions for smart classification (legacy support)
      const historicalTransactions = await prisma.transaction.findMany({
        where: { companyId },
        orderBy: { date: 'desc' },
        take: 100,
      })
      
      // Classify if recurring or one-time using legacy system
      const legacyClassification = classifyExpense(
        txn.description,
        txn.debit,
        classification.category,
        historicalTransactions.map(t => ({
          description: t.description || '',
          amount: Math.abs(t.amount),
          date: t.date,
          category: t.category
        }))
      )
      
      // Check if it's a subscription
      const subscriptionInfo = detectSubscription(
        txn.description,
        txn.debit,
        historicalTransactions.map(t => ({
          description: t.description || '',
          amount: Math.abs(t.amount),
          date: t.date,
          category: t.category
        }))
      )
      
      // Create subscription record if detected
      if (subscriptionInfo.isSubscription && subscriptionInfo.confidence !== 'low') {
        await createOrUpdateSubscription(
          companyId,
          subscriptionInfo.subscriptionName,
          txn.debit,
          subscriptionInfo.billingCycle,
          parsedDate
        )
      }
      
      // Create recurring expense if detected
      if (classification.expenseType === 'recurring' || (legacyClassification.expenseType === 'recurring' && legacyClassification.confidence !== 'low')) {
        await createOrUpdateRecurringExpense(
          companyId,
          txn.description,
          txn.debit,
          classification.category,
          classification.frequency || legacyClassification.frequency || 'monthly',
          parsedDate
        )
      }

      cashChange -= txn.debit
    }

    // Create transaction record with classification metadata
    await prisma.transaction.create({
      data: {
        companyId,
        amount: amount,
        category: matchedItem.category || Category.G_A,
        description: txn.description,
        date: parsedDate,
        currency: 'INR',
        expenseType: classification.expenseType,
        frequency: classification.frequency,
        vendorName: classification.vendorName || entities.vendor,
        isAutoDetected: true,
        // Review queue fields
        needsReview: needsReview,
        reviewReason: needsReview ? (classification.confidence < REVIEW_THRESHOLD ? 'low_confidence' : 'unclear_description') : null,
        confidenceScore: classification.confidence,
        transactionType: classification.type,
        matchedInvoiceId: classification.matchedInvoiceId,
        matchedBillId: classification.matchedBillId,
        classificationReasoning: JSON.stringify(classification.reasoning),
      },
    })

    if (needsReview) {
      needsReviewCount++
    }
    totalConfidence += classification.confidence
    newTxCount++
    matched.push(matchedItem)
  }

  // Update company cash balance
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  const oldCashBalance = company?.cashBalance || 0
  const newCashBalance = oldCashBalance + cashChange

  await prisma.company.update({
    where: { id: companyId },
    data: {
      cashBalance: newCashBalance,
    },
  })

  // Recalculate runway
  await recalculateRunway(companyId, newCashBalance)

  const averageConfidence = newTxCount > 0 ? totalConfidence / newTxCount : 0

  console.log(`\n✅ Processing Complete:`)
  console.log(`   Transactions: ${newTxCount}`)
  console.log(`   Bills Paid: ${billsPaid}`)
  console.log(`   Invoices Paid: ${invoicesPaid}`)
  console.log(`   Needs Review: ${needsReviewCount}`)
  console.log(`   Duplicates Skipped: ${duplicatesSkipped}`)
  console.log(`   Cash Change: ₹${cashChange}`)
  console.log(`   New Balance: ₹${newCashBalance}\n`)

  return {
    transactions: matched,
    cashBalanceChange: cashChange,
    newCashBalance,
    billsPaid,
    invoicesPaid,
    newTransactions: newTxCount,
    needsReviewCount,
    duplicatesSkipped,
    averageConfidence,
  }
}

function autoCategorizeExpense(description: string): Category {
  const desc = description.toLowerCase()

  if (desc.includes('salary') || desc.includes('payroll') || desc.includes('hire') || desc.includes('recruitment')) return Category.Hiring
  if (desc.includes('aws') || desc.includes('azure') || desc.includes('gcp') || desc.includes('cloud') || desc.includes('hosting') || desc.includes('server')) return Category.Cloud
  if (desc.includes('saas') || desc.includes('subscription') || desc.includes('software') || desc.includes('license')) return Category.SaaS
  if (desc.includes('marketing') || desc.includes('ads') || desc.includes('google ads') || desc.includes('advertisement') || desc.includes('campaign')) return Category.Marketing
  
  // Everything else goes to G&A (General & Administrative)
  return Category.G_A
}

function extractVendorName(description: string): string {
  // Remove common transaction prefixes/suffixes
  let cleaned = description
    .replace(/^(payment to|paid to|transfer to|payment for|paid for)/i, '')
    .replace(/(payment|invoice|bill|receipt|transaction)$/i, '')
    .trim()

  // Take first significant word(s)
  const words = cleaned.split(/\s+/)
  return words.slice(0, Math.min(3, words.length)).join(' ') || 'Unknown Vendor'
}

async function createOrUpdateSubscription(
  companyId: string,
  name: string,
  amount: number,
  billingCycle: 'monthly' | 'quarterly' | 'yearly',
  startDate: Date
) {
  // Check if subscription already exists
  const existing = await prisma.subscription.findFirst({
    where: {
      companyId,
      name: { contains: name, mode: 'insensitive' },
    },
  })

  if (existing) {
    // Update existing subscription
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        amount,
        billingCycle,
        lastBilledDate: startDate,
        status: 'active',
      },
    })
  } else {
    // Create new subscription
    await prisma.subscription.create({
      data: {
        companyId,
        name,
        amount,
        currency: 'INR',
        billingCycle,
        startDate,
        lastBilledDate: startDate,
        status: 'active',
        category: Category.SaaS,
      },
    })
  }
}

async function createOrUpdateRecurringExpense(
  companyId: string,
  description: string,
  amount: number,
  category: Category,
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  lastDate: Date
) {
  // Check if recurring expense already exists
  const vendorName = extractVendorName(description)
  
  const existing = await prisma.recurringExpense.findFirst({
    where: {
      companyId,
      description: { contains: vendorName, mode: 'insensitive' },
    },
  })

  if (existing) {
    // Update existing recurring expense
    await prisma.recurringExpense.update({
      where: { id: existing.id },
      data: {
        amount,
        frequency,
        lastPaymentDate: lastDate,
        status: 'active',
      },
    })
  } else {
    // Create new recurring expense
    await prisma.recurringExpense.create({
      data: {
        companyId,
        description: vendorName,
        amount,
        currency: 'INR',
        frequency,
        category,
        startDate: lastDate,
        lastPaymentDate: lastDate,
        status: 'active',
      },
    })
  }
}

async function recalculateRunway(companyId: string, cashBalance: number) {
  // Get last 3 months of expenses
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const expenses = await prisma.transaction.findMany({
    where: {
      companyId,
      amount: { lt: 0 },
      date: { gte: threeMonthsAgo },
    },
  })

  const totalExpenses = expenses.reduce((sum, exp) => sum + Math.abs(exp.amount), 0)
  const averageMonthlyBurn = totalExpenses / 3

  const runwayMonths = averageMonthlyBurn > 0 ? cashBalance / averageMonthlyBurn : 999

  // Update company with runway
  await prisma.company.update({
    where: { id: companyId },
    data: {
      targetMonths: Math.floor(runwayMonths),
    },
  })

  return runwayMonths
}

// Generate sample bank statement CSV
export function generateSampleBankStatement(): string {
  const today = new Date()
  const csv = `Date,Description,Debit,Credit,Balance
${formatDate(addDays(today, -30))},Opening Balance,0,0,500000
${formatDate(addDays(today, -25))},Payment from Acme Corp - INV001,0,50000,550000
${formatDate(addDays(today, -20))},Office Rent Payment,30000,0,520000
${formatDate(addDays(today, -18))},AWS Cloud Services,15000,0,505000
${formatDate(addDays(today, -15))},Salary - January,200000,0,305000
${formatDate(addDays(today, -10))},Client Invoice Payment - INV002,0,75000,380000
${formatDate(addDays(today, -8))},Google Ads Marketing,25000,0,355000
${formatDate(addDays(today, -5))},SaaS Subscription Payment,12000,0,343000
${formatDate(addDays(today, -3))},Customer Payment - INV003,0,40000,383000
${formatDate(addDays(today, -1))},Office Supplies,8000,0,375000`

  return csv
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

