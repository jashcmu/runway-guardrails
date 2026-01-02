import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { categorizeExpense } from '@/lib/categorize'

// Re-categorize all transactions for a company
export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      where: { companyId },
    })

    console.log(`\n🔄 Re-categorizing ${transactions.length} transactions...`)

    let updated = 0
    const categoryCounts: Record<string, number> = {}

    for (const txn of transactions) {
      if (txn.description) {
        const newCategory = categorizeExpense(txn.description)
        
        // Only update if category changed
        if (txn.category !== newCategory) {
          await prisma.transaction.update({
            where: { id: txn.id },
            data: { category: newCategory },
          })
          
          console.log(`  ✓ "${txn.description}" → ${newCategory}`)
          updated++
        }

        // Count categories
        categoryCounts[newCategory] = (categoryCounts[newCategory] || 0) + 1
      }
    }

    console.log(`\n✅ Re-categorized ${updated} transactions`)
    console.log('Category breakdown:', categoryCounts)
    console.log('')

    return NextResponse.json({ 
      message: `Successfully re-categorized ${updated} transactions`,
      updated,
      total: transactions.length,
      categoryCounts
    })
  } catch (error) {
    console.error('Recategorize error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to recategorize',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}



