import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * DEBUG endpoint to inspect transactions in the database
 * GET /api/debug/transactions?companyId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      where: { companyId },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        date: true,
        createdAt: true,
      },
      orderBy: { date: 'desc' },
      take: 50, // Limit to 50 most recent
    })

    // Calculate summary
    const expenses = transactions.filter(t => t.amount < 0)
    const revenues = transactions.filter(t => t.amount > 0)
    
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const totalRevenue = revenues.reduce((sum, t) => sum + t.amount, 0)

    return NextResponse.json({
      success: true,
      summary: {
        totalTransactions: transactions.length,
        expenseCount: expenses.length,
        revenueCount: revenues.length,
        totalExpenses: totalExpenses,
        totalRevenue: totalRevenue,
        netCashFlow: totalRevenue - totalExpenses,
      },
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.amount < 0 ? 'EXPENSE' : 'REVENUE',
        category: t.category,
        createdAt: t.createdAt,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch debug transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


