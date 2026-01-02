// Enhanced Bank Statement Processor with Full Integration
import { PrismaClient, Category } from '@prisma/client'
import Papa from 'papaparse'
import { classifyExpense, detectSubscription } from './smart-expense-classifier'

const prisma = new PrismaClient()

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
}

export async function processBankStatement(
  fileContent: string,
  companyId: string,
  bankAccountId?: string
): Promise<{
  transactions: MatchedTransaction[]
  cashBalanceChange: number
  newCashBalance: number
  billsPaid: number
  invoicesPaid: number
  newTransactions: number
}> {
  // Parse CSV
  const parsedData = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
  }) as Papa.ParseResult<any>

  const transactions: BankTransaction[] = parsedData.data.map((row: any) => ({
    date: row.Date || row.date,
    description: row.Description || row.description || row.Narration,
    debit: parseFloat(row.Debit || row.debit || row['Withdrawal Amt.'] || '0'),
    credit: parseFloat(row.Credit || row.credit || row['Deposit Amt.'] || '0'),
    balance: parseFloat(row.Balance || row.balance || '0'),
  }))

  const matched: MatchedTransaction[] = []
  let cashChange = 0
  let billsPaid = 0
  let invoicesPaid = 0
  let newTxCount = 0

  // Get existing bills and invoices
  const pendingBills = await prisma.bill.findMany({
    where: { companyId, paymentStatus: { in: ['unpaid', 'partial'] } },
  })

  const pendingInvoices = await prisma.invoice.findMany({
    where: { companyId, status: { in: ['draft', 'sent'] } },
  })

  for (const txn of transactions) {
    // Skip opening balance rows (description contains "opening balance" and both debit/credit are 0)
    if (
      txn.description.toLowerCase().includes('opening balance') ||
      (txn.debit === 0 && txn.credit === 0)
    ) {
      console.log(`⏭️  Skipping opening balance row: ${txn.description}`)
      continue
    }

    const amount = txn.credit > 0 ? txn.credit : -txn.debit
    let matchedItem: MatchedTransaction = {
      transaction: txn,
      matchType: 'unmatched',
    }

    if (txn.credit > 0) {
      // Incoming money (REVENUE) - This is SETTLED CASH, not AR
      // Try to match with existing invoices for reconciliation
      const matchedInvoice = pendingInvoices.find((inv) =>
        Math.abs(inv.totalAmount - txn.credit) < 1 || // Amount match
        txn.description.toLowerCase().includes(inv.customerName.toLowerCase()) ||
        txn.description.includes(inv.invoiceNumber)
      )

      if (matchedInvoice) {
        // Mark invoice as paid (reconciliation)
        await prisma.invoice.update({
          where: { id: matchedInvoice.id },
          data: {
            status: 'paid',
            paidDate: new Date(txn.date),
            paidAmount: txn.credit,
            balanceAmount: 0,
          },
        })

        matchedItem = {
          ...matchedItem,
          matchType: 'invoice',
          matchedId: matchedInvoice.id,
          category: Category.G_A,
        }
        invoicesPaid++
        console.log(`✅ Matched invoice ${matchedInvoice.invoiceNumber} as paid`)
      } else {
        // No invoice match - just revenue (settled cash)
        matchedItem.matchType = 'revenue'
        matchedItem.category = Category.G_A
        console.log(`💰 Revenue: ${txn.description} - ₹${txn.credit} (no invoice match)`)
      }
      
      cashChange += txn.credit
    } else if (txn.debit > 0) {
      // Outgoing money (EXPENSE) - This is SETTLED CASH, not AP
      // Try to match with existing bills for reconciliation
      const matchedBill = pendingBills.find((bill) =>
        Math.abs(bill.totalAmount - txn.debit) < 1 || // Amount match
        txn.description.toLowerCase().includes(bill.vendorName.toLowerCase()) ||
        txn.description.includes(bill.billNumber)
      )

      if (matchedBill) {
        // Mark bill as paid (reconciliation)
        await prisma.bill.update({
          where: { id: matchedBill.id },
          data: {
            paymentStatus: 'paid',
            paymentDate: new Date(txn.date),
            paidAmount: txn.debit,
            balanceAmount: 0,
          },
        })

        matchedItem = {
          ...matchedItem,
          matchType: 'bill',
          matchedId: matchedBill.id,
          category: Category.G_A,
        }
        billsPaid++
        console.log(`✅ Matched bill ${matchedBill.billNumber} as paid`)
      } else {
        // No bill match - just expense (settled cash)
        const category = autoCategorizeExpense(txn.description)
        
        // Get historical transactions for smart classification
        const historicalTransactions = await prisma.transaction.findMany({
          where: { companyId },
          orderBy: { date: 'desc' },
          take: 100,
        })
        
        // Classify if recurring or one-time
        const classification = classifyExpense(
          txn.description,
          txn.debit,
          category,
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
            new Date(txn.date)
          )
          console.log(`🔄 Detected subscription: ${subscriptionInfo.subscriptionName} (${subscriptionInfo.billingCycle})`)
        }
        
        // Create recurring expense if detected
        if (classification.expenseType === 'recurring' && classification.confidence !== 'low') {
          await createOrUpdateRecurringExpense(
            companyId,
            txn.description,
            txn.debit,
            category,
            classification.frequency || 'monthly',
            new Date(txn.date)
          )
          console.log(`🔁 Detected recurring expense: ${txn.description} (${classification.frequency})`)
        }

        matchedItem.matchType = 'expense'
        matchedItem.category = category
        console.log(`💸 Expense: ${txn.description} - ₹${txn.debit} [${classification.expenseType}] (no bill match)`)
      }
      
      cashChange -= txn.debit
    }

    // Create transaction record
    await prisma.transaction.create({
      data: {
        companyId,
        amount: amount,
        category: matchedItem.category || Category.G_A,
        description: txn.description,
        date: new Date(txn.date),
        currency: 'INR',
      },
    })

    newTxCount++
    matched.push(matchedItem)
  }

  // Update company cash balance
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  const oldCashBalance = company?.cashBalance || 0
  
  // Calculate new balance by ADDING the net change to existing balance
  // This way we preserve the initial balance entered during onboarding
  const newCashBalance = oldCashBalance + cashChange

  await prisma.company.update({
    where: { id: companyId },
    data: {
      cashBalance: newCashBalance,
    },
  })

  // Recalculate runway
  await recalculateRunway(companyId, newCashBalance)

  return {
    transactions: matched,
    cashBalanceChange: cashChange,
    newCashBalance,
    billsPaid,
    invoicesPaid,
    newTransactions: newTxCount,
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

