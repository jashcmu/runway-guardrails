import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autoCategorizeBulk } from '@/lib/auto-categorize'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, transactionIds } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!transactionIds || !Array.isArray(transactionIds)) {
      return NextResponse.json({ error: 'transactionIds array is required' }, { status: 400 })
    }

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        companyId,
      },
    })

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 })
    }

    // Auto-categorize
    const transactionsToCategorize = transactions.map(txn => ({
      description: txn.description || '',
      amount: typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount)),
      date: txn.date,
    }))

    const categorized = await autoCategorizeBulk(transactionsToCategorize)

    // Update transactions
    const updates = await Promise.all(
      categorized.map(async ({ transaction, category }) => {
        const originalTxn = transactions.find(
          t => t.description === transaction.description && 
               Math.abs((typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount))) - transaction.amount) < 0.01
        )
        if (originalTxn) {
          return prisma.transaction.update({
            where: { id: originalTxn.id },
            data: { category },
          })
        }
        return null
      })
    )

    const updated = updates.filter(Boolean)

    return NextResponse.json({
      message: 'Transactions categorized successfully',
      updated: updated.length,
      total: transactions.length,
    }, { status: 200 })
  } catch (error) {
    console.error('Auto-categorize error:', error)
    return NextResponse.json(
      { error: 'Failed to categorize transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

