import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { getDataQuality } from '@/lib/calculations'
import { calculateBurnRateMetrics } from '@/lib/burn-rate-calculator'
import { Category } from '@prisma/client'

function getMonthToDateSpendByCategory(
  transactions: Array<{ date: Date; amount: any; category: Category }>,
  year: number,
  month: number
): Map<Category, number> {
  const spendByCategory = new Map<Category, number>()

  for (const transaction of transactions) {
    const date = new Date(transaction.date)
    if (date.getFullYear() === year && date.getMonth() === month) {
      const amount = typeof transaction.amount === 'number'
        ? transaction.amount
        : parseFloat(String(transaction.amount))

      const current = spendByCategory.get(transaction.category) || 0
      spendByCategory.set(transaction.category, current + amount)
    }
  }

  return spendByCategory
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const companySlug = searchParams.get('companySlug')

    // Support both companyId and companySlug
    let company
    if (companyId) {
      company = await prisma.company.findUnique({
        where: { id: companyId },
      })
    } else if (companySlug) {
      company = await prisma.company.findUnique({
        where: { slug: companySlug },
      })
    } else {
      return NextResponse.json({ error: 'companyId or companySlug is required' }, { status: 400 })
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const actualCompanyId = company.id
    const cashBalance = company.cashBalance
    const targetMonths = company.targetMonths

    // Verify Prisma client is working
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database client not initialized. Please check your DATABASE_URL configuration.' },
        { status: 500 }
      )
    }

    // Get monthly burn and runway using the NEW burn rate calculator
    const burnMetrics = await calculateBurnRateMetrics(actualCompanyId, cashBalance)
    const monthlyBurn = burnMetrics.netBurnRate // Use NET burn rate, not gross
    const runway = burnMetrics.runway === Infinity ? 999 : burnMetrics.runway
    const dataQuality = await getDataQuality(actualCompanyId)
    
    console.log(`📊 Dashboard Metrics for ${company.name}:`)
    console.log(`   Cash Balance: ₹${cashBalance.toLocaleString()}`)
    console.log(`   Monthly Burn: ₹${monthlyBurn.toLocaleString()}`)
    console.log(`   Runway: ${runway === 999 ? '∞' : runway.toFixed(1)} months`)

    // Get current month
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const startOfMonth = new Date(currentYear, currentMonth, 1)
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

    // Get active budgets
    const activeBudgets = await prisma.budget.findMany({
      where: {
        companyId: actualCompanyId,
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
    })

    // Get transactions for month-to-date calculation
    const transactions = await prisma.transaction.findMany({
      where: { companyId: actualCompanyId },
      select: {
        date: true,
        amount: true,
        category: true,
      },
    })

    const mtdSpendByCategory = getMonthToDateSpendByCategory(
      transactions,
      currentYear,
      currentMonth
    )

    // Build category budget data - show all categories, even without budgets
    const allCategories = Object.values(Category)
    const categoryData = allCategories.map(cat => {
      const budget = activeBudgets.find(b => b.category === cat)
      const budgetAmount = budget 
        ? (typeof budget.amount === 'number' ? budget.amount : parseFloat(String(budget.amount)))
        : 0
      
      const mtdSpend = mtdSpendByCategory.get(cat) || 0
      const percentage = budgetAmount > 0 ? (mtdSpend / budgetAmount) * 100 : 0
      
      let status: 'under' | 'warning' | 'over' | 'no-budget' = 'no-budget'
      if (budgetAmount > 0) {
        if (percentage >= 100) {
          status = 'over'
        } else if (percentage >= 80) {
          status = 'warning'
        } else {
          status = 'under'
        }
      }

      return {
        category: cat,
        budget: budgetAmount,
        spend: mtdSpend,
        percentage: budgetAmount > 0 ? Math.round(percentage) : 0,
        status,
      }
    })

    // Calculate required cash for target months
    const requiredCash = targetMonths ? monthlyBurn * targetMonths : null
    const cashShortfall = requiredCash ? Math.max(0, requiredCash - cashBalance) : null

    return NextResponse.json({
      cashBalance,
      monthlyBurn,
      runway: runway === Infinity ? null : runway,
      categories: categoryData,
      targetMonths,
      requiredCash,
      cashShortfall,
      dataQuality,
    })

  } catch (error) {
    console.error('Dashboard error:', error)
    
    // Always return JSON, never HTML
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Check if it's a Prisma connection error
    if (errorMessage.includes('DATABASE_URL') || 
        errorMessage.includes('connection') || 
        errorMessage.includes('P1001') ||
        errorMessage.includes('adapter') ||
        errorMessage.includes('accelerateUrl')) {
      return NextResponse.json(
        { 
          error: 'Database connection error', 
          message: 'Please ensure DATABASE_URL is configured correctly in your .env file.',
          details: errorMessage
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

