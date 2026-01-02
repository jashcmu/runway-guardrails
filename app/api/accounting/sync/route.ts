import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createExpenseJournalEntry, initializeChartOfAccounts } from '@/lib/accounting/journal-entries'

/**
 * POST /api/accounting/sync
 * Retroactively create journal entries for all existing transactions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    console.log(`\n🔄 Starting accounting sync for company ${companyId}...`)

    // Ensure chart of accounts exists
    await initializeChartOfAccounts(companyId)

    // Get all transactions
    const allTransactions = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    })

    console.log(`📊 Found ${allTransactions.length} transactions to process`)

    // Get existing journal entries
    const existingJournalEntries = await prisma.journalEntry.findMany({
      where: { companyId },
      select: { transactionId: true },
    })

    const transactionsWithJournals = new Set(
      existingJournalEntries
        .filter(je => je.transactionId)
        .map(je => je.transactionId as string)
    )

    console.log(`✓ ${transactionsWithJournals.size} transactions already have journal entries`)

    // Process transactions without journal entries
    const transactionsToSync = allTransactions.filter(
      t => !transactionsWithJournals.has(t.id)
    )

    console.log(`🔧 Need to create journal entries for ${transactionsToSync.length} transactions`)

    let synced = 0
    let errors = 0

    for (const transaction of transactionsToSync) {
      try {
        const journalResult = await createExpenseJournalEntry(
          companyId,
          transaction.id,
          transaction.amount,
          transaction.category,
          transaction.description,
          transaction.date,
          transaction.gstAmount || undefined
        )

        if (journalResult.success) {
          synced++
          console.log(`✓ Synced: ${transaction.description} (${transaction.amount})`)
        } else {
          errors++
          console.error(`✗ Failed to sync transaction ${transaction.id}: ${journalResult.error}`)
        }
      } catch (error) {
        errors++
        console.error(`✗ Error syncing transaction ${transaction.id}:`, error)
      }
    }

    console.log(`\n✅ Sync complete!`)
    console.log(`   - Synced: ${synced}`)
    console.log(`   - Errors: ${errors}`)
    console.log(`   - Already synced: ${transactionsWithJournals.size}`)
    console.log(`   - Total transactions: ${allTransactions.length}\n`)

    return NextResponse.json({
      success: true,
      message: 'Accounting sync completed',
      stats: {
        totalTransactions: allTransactions.length,
        alreadySynced: transactionsWithJournals.size,
        newlySynced: synced,
        errors,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('Accounting sync error:', error)
    return NextResponse.json({
      error: 'Failed to sync accounting',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}



