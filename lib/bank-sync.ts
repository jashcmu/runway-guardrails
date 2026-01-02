import { parseCSVStatement } from './bank-parser'
import { prisma } from './prisma'
import { Category } from '@prisma/client'
import { autoCategorizeTransaction } from './auto-categorize'
import { createExpenseJournalEntry, initializeChartOfAccounts } from './accounting/journal-entries'

export interface BankSyncConfig {
  companyId: string
  autoCategorize: boolean
  defaultCategory?: Category
}

export async function syncBankStatement(
  csvText: string,
  config: BankSyncConfig
): Promise<{ imported: number; categorized: number; errors: number }> {
  try {
    // Ensure chart of accounts exists
    await initializeChartOfAccounts(config.companyId)
    
    // Parse CSV
    const parsedTransactions = parseCSVStatement(csvText)
    
    if (parsedTransactions.length === 0) {
      return { imported: 0, categorized: 0, errors: 0 }
    }

    // Filter only debit transactions (expenses)
    const expenses = parsedTransactions.filter(t => t.type === 'debit' && t.amount < 0)

    let imported = 0
    let categorized = 0
    let errors = 0

    // Import transactions
    for (const expense of expenses) {
      try {
        // Auto-categorize if enabled
        let category = config.defaultCategory || Category.G_A
        if (config.autoCategorize) {
          try {
            category = await autoCategorizeTransaction({
              description: expense.description,
              amount: Math.abs(expense.amount),
              date: expense.date,
            })
            categorized++
          } catch (err) {
            console.warn('Auto-categorization failed, using default:', err)
          }
        }

        // Check for duplicates (same description, amount, and date within 1 day)
        const existing = await prisma.transaction.findFirst({
          where: {
            companyId: config.companyId,
            description: expense.description,
            amount: Math.abs(expense.amount),
            date: {
              gte: new Date(expense.date.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(expense.date.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        })

        if (!existing) {
          const transaction = await prisma.transaction.create({
            data: {
              companyId: config.companyId,
              amount: Math.abs(expense.amount),
              category,
              description: expense.description,
              date: expense.date,
              currency: 'INR',
              expenseType: 'one-time',
              gstRate: 0,
            },
          })
          
          // Create journal entries for the transaction
          const journalResult = await createExpenseJournalEntry(
            config.companyId,
            transaction.id,
            transaction.amount,
            category,
            expense.description || '',
            expense.date,
            transaction.gstAmount || undefined
          )
          
          if (!journalResult.success) {
            console.warn(`⚠ Failed to create journal entries for transaction ${transaction.id}: ${journalResult.error}`)
          } else {
            console.log(`✓ Created journal entries for transaction: ${expense.description}`)
          }
          
          imported++
        }
      } catch (err) {
        console.error('Error importing transaction:', err)
        errors++
      }
    }

    return { imported, categorized, errors }
  } catch (error) {
    console.error('Bank sync error:', error)
    throw new Error(`Failed to sync bank statement: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function detectBankFormat(csvText: string): 'hdfc' | 'icici' | 'sbi' | 'generic' {
  const text = csvText.toLowerCase()
  
  if (text.includes('hdfc') || text.includes('hdfc bank')) {
    return 'hdfc'
  }
  if (text.includes('icici') || text.includes('icici bank')) {
    return 'icici'
  }
  if (text.includes('state bank') || text.includes('sbi')) {
    return 'sbi'
  }
  
  return 'generic'
}

