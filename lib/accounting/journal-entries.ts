import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

// Re-export for convenience
export { initializeChartOfAccounts } from './chart-of-accounts'

/**
 * Core Journal Entry Creation Logic
 * Implements double-entry bookkeeping
 */

export interface JournalEntryInput {
  companyId: string
  date: Date
  description: string
  reference?: string
  notes?: string
  transactionId?: string
  invoiceId?: string
  revenueId?: string
  entries: Array<{
    accountCode: string
    debit?: number
    credit?: number
  }>
}

export interface JournalEntryResult {
  success: boolean
  journalEntries?: any[]
  error?: string
}

/**
 * Create journal entries (double-entry)
 * Validates that debits = credits before creating
 */
export async function createJournalEntries(input: JournalEntryInput): Promise<JournalEntryResult> {
  const { companyId, date, description, reference, notes, transactionId, invoiceId, revenueId, entries } = input

  // Validation: Must have at least 2 entries (debit and credit)
  if (entries.length < 2) {
    return { success: false, error: 'Journal entry must have at least 2 entries (debit and credit)' }
  }

  // Calculate totals
  let totalDebits = 0
  let totalCredits = 0

  for (const entry of entries) {
    totalDebits += entry.debit || 0
    totalCredits += entry.credit || 0
  }

  // Validation: Debits must equal credits
  const difference = Math.abs(totalDebits - totalCredits)
  if (difference > 0.01) {
    // Allow 1 paisa rounding error
    return {
      success: false,
      error: `Debits (₹${totalDebits}) do not equal credits (₹${totalCredits}). Difference: ₹${difference}`,
    }
  }

  // Get account IDs from codes
  const accountPromises = entries.map((entry) =>
    prisma.accountingAccount.findFirst({
      where: {
        companyId,
        accountCode: entry.accountCode,
      },
    })
  )

  const accounts = await Promise.all(accountPromises)

  // Check if all accounts exist
  for (let i = 0; i < accounts.length; i++) {
    if (!accounts[i]) {
      return { success: false, error: `Account code ${entries[i].accountCode} not found` }
    }
  }

  // Create journal entries and update account balances in a transaction
  try {
    const journalEntries = await prisma.$transaction(async (tx) => {
      const createdEntries = []

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const account = accounts[i]!

        // Create journal entry
        const journalEntry = await tx.journalEntry.create({
          data: {
            companyId,
            accountId: account.id,
            date,
            description,
            reference,
            notes,
            transactionId,
            invoiceId,
            revenueId,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
          },
        })

        createdEntries.push(journalEntry)

        // Update account balance
        const debitAmount = entry.debit || 0
        const creditAmount = entry.credit || 0

        // Balance calculation based on account type
        // Assets and Expenses: Debit increases, Credit decreases
        // Liabilities, Equity, Revenue: Credit increases, Debit decreases
        let balanceChange = 0
        if (account.type === 'Asset' || account.type === 'Expense') {
          balanceChange = debitAmount - creditAmount
        } else {
          // Liability, Equity, Revenue
          balanceChange = creditAmount - debitAmount
        }

        await tx.accountingAccount.update({
          where: { id: account.id },
          data: { balance: { increment: balanceChange } },
        })
      }

      return createdEntries
    })

    console.log(`✓ Created ${journalEntries.length} journal entries (${description})`)
    return { success: true, journalEntries }
  } catch (error) {
    console.error('Journal entry creation error:', error)
    return {
      success: false,
      error: `Failed to create journal entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Create journal entry for an expense transaction
 */
export async function createExpenseJournalEntry(
  companyId: string,
  transactionId: string,
  amount: number,
  category: Category,
  description: string,
  date: Date,
  gstAmount?: number
): Promise<JournalEntryResult> {
  // Map category to expense account code (expanded for all categories)
  const categoryToAccountCode: Record<Category, string> = {
    // Personnel & HR
    Hiring: '5000', // Hiring & Recruitment
    Salaries: '5010', // Salaries & Wages
    Benefits: '5020', // Employee Benefits
    Training: '5030', // Training & Development
    
    // Sales & Marketing
    Marketing: '5100', // Marketing
    Sales: '5110', // Sales
    Advertising: '5120', // Advertising
    Events: '5130', // Events & Conferences
    
    // Technology
    SaaS: '5200', // SaaS Tools
    Cloud: '5210', // Cloud Services
    ITInfrastructure: '5220', // IT Infrastructure
    Software: '5230', // Software
    Hardware: '5240', // Hardware
    Security: '5250', // Security
    
    // Operations
    Rent: '5300', // Rent & Facilities
    Utilities: '5310', // Utilities
    OfficeSupplies: '5320', // Office Supplies
    Equipment: '5330', // Equipment & Furniture
    Maintenance: '5340', // Maintenance
    
    // Professional Services
    Legal: '5400', // Legal
    Accounting: '5410', // Accounting & Audit
    Consulting: '5420', // Consulting
    ProfessionalServices: '5430', // Professional Services
    
    // Travel & Entertainment
    Travel: '5500', // Travel
    Meals: '5510', // Meals & Food
    Entertainment: '5520', // Entertainment
    
    // Finance
    Taxes: '5600', // Taxes & Duties
    Insurance: '5610', // Insurance
    BankFees: '5620', // Bank Fees
    PaymentProcessing: '5630', // Payment Processing
    InterestCharges: '5640', // Interest & Finance
    
    // R&D
    ResearchDevelopment: '5700', // R&D
    
    // Customer Operations
    CustomerSupport: '5800', // Customer Support
    Subscriptions: '5810', // Subscriptions
    
    // Other
    Refunds: '5900', // Refunds & Returns
    Depreciation: '5910', // Depreciation
    BadDebts: '5920', // Bad Debts
    G_A: '5950', // General & Admin
    Other: '5999', // Other
  }

  const expenseAccountCode = categoryToAccountCode[category]
  const entries: Array<{ accountCode: string; debit?: number; credit?: number }> = []

  // If GST, split into expense + GST input credit
  if (gstAmount && gstAmount > 0) {
    const amountExcludingGST = amount - gstAmount

    // Debit: Expense account (amount excluding GST)
    entries.push({
      accountCode: expenseAccountCode,
      debit: amountExcludingGST,
    })

    // Debit: GST Input Credit
    entries.push({
      accountCode: '1110', // GST Input Credit Receivable
      debit: gstAmount,
    })
  } else {
    // No GST - simple entry
    entries.push({
      accountCode: expenseAccountCode,
      debit: amount,
    })
  }

  // Credit: Bank or Cash (assume default bank account for now)
  entries.push({
    accountCode: '1010', // Bank - HDFC (default)
    credit: amount,
  })

  return await createJournalEntries({
    companyId,
    date,
    description,
    transactionId,
    entries,
  })
}

/**
 * Create journal entry for revenue/invoice
 */
export async function createRevenueJournalEntry(
  companyId: string,
  revenueId: string,
  invoiceId: string | null,
  amount: number,
  description: string,
  date: Date,
  gstAmount?: number
): Promise<JournalEntryResult> {
  const entries: Array<{ accountCode: string; debit?: number; credit?: number }> = []

  // Debit: Accounts Receivable (total amount including GST)
  entries.push({
    accountCode: '1100', // Accounts Receivable
    debit: amount,
  })

  // If GST, split into revenue + GST payable
  if (gstAmount && gstAmount > 0) {
    const amountExcludingGST = amount - gstAmount

    // Credit: Service Revenue (amount excluding GST)
    entries.push({
      accountCode: '4000', // Service Revenue
      credit: amountExcludingGST,
    })

    // Credit: GST Payable (for now, use IGST - can be split later)
    entries.push({
      accountCode: '2102', // GST Payable - IGST
      credit: gstAmount,
    })
  } else {
    // No GST - simple entry
    entries.push({
      accountCode: '4000', // Service Revenue
      credit: amount,
    })
  }

  return await createJournalEntries({
    companyId,
    date,
    description,
    invoiceId: invoiceId || undefined,
    revenueId,
    entries,
  })
}

/**
 * Create journal entry for payment received
 */
export async function createPaymentReceivedJournalEntry(
  companyId: string,
  revenueId: string,
  amount: number,
  description: string,
  date: Date
): Promise<JournalEntryResult> {
  return await createJournalEntries({
    companyId,
    date,
    description,
    revenueId,
    entries: [
      // Debit: Bank (cash received)
      {
        accountCode: '1010', // Bank - HDFC (default)
        debit: amount,
      },
      // Credit: Accounts Receivable (reduce outstanding)
      {
        accountCode: '1100',
        credit: amount,
      },
    ],
  })
}

/**
 * Get journal entries for a transaction
 */
export async function getJournalEntriesByTransaction(companyId: string, transactionId: string) {
  return await prisma.journalEntry.findMany({
    where: {
      companyId,
      transactionId,
    },
    include: {
      account: true,
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Get all journal entries for a company (with date range)
 */
export async function getJournalEntries(companyId: string, startDate?: Date, endDate?: Date) {
  return await prisma.journalEntry.findMany({
    where: {
      companyId,
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    },
    include: {
      account: true,
    },
    orderBy: { date: 'desc' },
  })
}

