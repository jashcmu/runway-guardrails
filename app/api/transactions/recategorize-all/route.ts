import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autoCategorizeTransaction } from '@/lib/auto-categorize'
import { auth } from '@/lib/auth-config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { companyId } = await request.json()
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Verify user has access to this company
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        companies: {
          where: { id: companyId }
        }
      }
    })

    if (!user || user.companies.length === 0) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 403 })
    }

    // Get all uncategorized or old-category transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId,
        amount: { lt: 0 }, // Only expenses
      },
      orderBy: { date: 'desc' },
      take: 1000, // Limit to prevent timeout
    })

    if (transactions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No transactions to recategorize',
        recategorized: 0 
      })
    }

    let recategorized = 0
    const errors: string[] = []

    // Recategorize in batches
    for (const txn of transactions) {
      try {
        const description = txn.description || txn.vendorName || 'Unknown'
        const newCategory = await autoCategorizeTransaction({
          description,
          amount: Math.abs(Number(txn.amount)),
          date: txn.date,
          type: 'debit',
        })

        // Only update if category changed
        if (txn.category !== newCategory) {
          await prisma.transaction.update({
            where: { id: txn.id },
            data: { category: newCategory },
          })
          recategorized++
        }
      } catch (error: any) {
        errors.push(`Transaction ${txn.id}: ${error.message}`)
        console.error(`Error recategorizing transaction ${txn.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recategorized ${recategorized} out of ${transactions.length} transactions`,
      recategorized,
      total: transactions.length,
      errors: errors.slice(0, 10), // Limit error messages
    })
  } catch (error: any) {
    console.error('Recategorization error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recategorize transactions' },
      { status: 500 }
    )
  }
}
