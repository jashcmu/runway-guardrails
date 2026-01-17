import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { getDataQuality } from '@/lib/calculations'
import { calculateBurnRateMetrics } from '@/lib/burn-rate-calculator'
import { Category } from '@prisma/client'
import { CATEGORY_DISPLAY_NAMES, CATEGORY_GROUPS, getCategoryGroup } from '@/lib/categorize'

interface CategorySpend {
  category: Category
  displayName: string
  group: string
  spend: number
  budget: number
  percentage: number
  status: 'under' | 'warning' | 'over' | 'no-budget'
  transactionCount: number
  percentOfTotal: number
  trend: 'up' | 'down' | 'stable'
  previousMonthSpend: number
  trendPercentage: number
}

interface MonthlySpend {
  month: string
  year: number
  monthNum: number
  total: number
  byCategory: Record<string, number>
}

function getMonthToDateSpendByCategory(
  transactions: Array<{ date: Date; amount: any; category: Category }>,
  year: number,
  month: number
): Map<Category, { amount: number; count: number }> {
  const spendByCategory = new Map<Category, { amount: number; count: number }>()

  for (const transaction of transactions) {
    const date = new Date(transaction.date)
    if (date.getFullYear() === year && date.getMonth() === month) {
      const amount = typeof transaction.amount === 'number'
        ? transaction.amount
        : parseFloat(String(transaction.amount))

      // Only count expenses (negative amounts)
      if (amount < 0) {
        const current = spendByCategory.get(transaction.category) || { amount: 0, count: 0 }
        spendByCategory.set(transaction.category, { 
          amount: current.amount + Math.abs(amount),
          count: current.count + 1
        })
      }
    }
  }

  return spendByCategory
}

function getMonthlySpendTrend(
  transactions: Array<{ date: Date; amount: any; category: Category }>,
  months: number = 6
): MonthlySpend[] {
  const monthlyData: MonthlySpend[] = []
  const now = new Date()
  
  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = targetDate.getFullYear()
    const monthNum = targetDate.getMonth()
    const monthName = targetDate.toLocaleString('en-US', { month: 'short' })
    
    const byCategory: Record<string, number> = {}
    let total = 0
    
    for (const txn of transactions) {
      const txnDate = new Date(txn.date)
      if (txnDate.getFullYear() === year && txnDate.getMonth() === monthNum) {
        const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
        if (amount < 0) {
          const absAmount = Math.abs(amount)
          byCategory[txn.category] = (byCategory[txn.category] || 0) + absAmount
          total += absAmount
        }
      }
    }
    
    monthlyData.push({
      month: `${monthName} ${year}`,
      year,
      monthNum,
      total,
      byCategory
    })
  }
  
  return monthlyData
}

function getTopVendors(
  transactions: Array<{ description?: string | null; amount: any; vendorName?: string | null }>,
  limit: number = 10
): Array<{ name: string; total: number; count: number }> {
  const vendorSpend: Record<string, { total: number; count: number }> = {}
  
  for (const txn of transactions) {
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    if (amount < 0) {
      const vendor = txn.vendorName || extractVendor(txn.description || '') || 'Unknown'
      if (!vendorSpend[vendor]) {
        vendorSpend[vendor] = { total: 0, count: 0 }
      }
      vendorSpend[vendor].total += Math.abs(amount)
      vendorSpend[vendor].count++
    }
  }
  
  return Object.entries(vendorSpend)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

function extractVendor(description: string): string {
  // Simple vendor extraction
  const cleaned = description
    .replace(/UPI\/\d+\/.*$/i, '')
    .replace(/NEFT\/.*$/i, '')
    .replace(/IMPS\/.*$/i, '')
    .replace(/\d{10,}/g, '')
    .trim()
  
  const words = cleaned.split(/\s+/).slice(0, 3)
  return words.join(' ') || 'Unknown'
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

    // Get transactions for analytics
    const transactions = await prisma.transaction.findMany({
      where: { companyId: actualCompanyId },
      select: {
        date: true,
        amount: true,
        category: true,
        description: true,
        vendorName: true,
      },
    })

    // Current month spend by category
    const mtdSpendByCategory = getMonthToDateSpendByCategory(
      transactions,
      currentYear,
      currentMonth
    )
    
    // Previous month spend for trend calculation
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const prevMonthSpendByCategory = getMonthToDateSpendByCategory(
      transactions,
      prevYear,
      prevMonth
    )
    
    // Calculate total spend this month
    const totalMonthSpend = Array.from(mtdSpendByCategory.values())
      .reduce((sum, val) => sum + val.amount, 0)

    // Build enhanced category data
    const allCategories = Object.values(Category)
    const categoryData: CategorySpend[] = allCategories.map(cat => {
      const budget = activeBudgets.find(b => b.category === cat)
      const budgetAmount = budget 
        ? (typeof budget.amount === 'number' ? budget.amount : parseFloat(String(budget.amount)))
        : 0
      
      const mtdData = mtdSpendByCategory.get(cat) || { amount: 0, count: 0 }
      const prevData = prevMonthSpendByCategory.get(cat) || { amount: 0, count: 0 }
      const mtdSpend = mtdData.amount
      const prevSpend = prevData.amount
      
      const percentage = budgetAmount > 0 ? (mtdSpend / budgetAmount) * 100 : 0
      
      // Determine budget status
      let status: 'under' | 'warning' | 'over' | 'no-budget' = 'no-budget'
      if (budgetAmount > 0) {
        if (percentage >= 100) status = 'over'
        else if (percentage >= 80) status = 'warning'
        else status = 'under'
      }
      
      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable'
      let trendPercentage = 0
      if (prevSpend > 0) {
        trendPercentage = ((mtdSpend - prevSpend) / prevSpend) * 100
        if (trendPercentage > 10) trend = 'up'
        else if (trendPercentage < -10) trend = 'down'
      } else if (mtdSpend > 0) {
        trend = 'up'
        trendPercentage = 100
      }

      return {
        category: cat,
        displayName: CATEGORY_DISPLAY_NAMES[cat] || cat,
        group: getCategoryGroup(cat),
        spend: mtdSpend,
        budget: budgetAmount,
        percentage: budgetAmount > 0 ? Math.round(percentage) : 0,
        status,
        transactionCount: mtdData.count,
        percentOfTotal: totalMonthSpend > 0 ? Math.round((mtdSpend / totalMonthSpend) * 100) : 0,
        trend,
        previousMonthSpend: prevSpend,
        trendPercentage: Math.round(trendPercentage)
      }
    }).filter(c => c.spend > 0 || c.budget > 0) // Only return categories with activity or budget

    // Get spending trends for last 6 months
    const monthlyTrend = getMonthlySpendTrend(transactions, 6)
    
    // Get top vendors
    const topVendors = getTopVendors(transactions, 10)
    
    // Group spending by category groups
    const spendByGroup: Record<string, number> = {}
    for (const cat of categoryData) {
      spendByGroup[cat.group] = (spendByGroup[cat.group] || 0) + cat.spend
    }

    // Calculate required cash for target months
    const requiredCash = targetMonths ? monthlyBurn * targetMonths : null
    const cashShortfall = requiredCash ? Math.max(0, requiredCash - cashBalance) : null
    
    // Summary stats
    const totalTransactions = transactions.length
    const totalExpenses = transactions.filter(t => {
      const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount))
      return amt < 0
    }).length
    const totalRevenue = transactions.filter(t => {
      const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount))
      return amt > 0
    }).length

    return NextResponse.json({
      // Core metrics
      cashBalance,
      monthlyBurn,
      runway: runway === Infinity ? null : runway,
      targetMonths,
      requiredCash,
      cashShortfall,
      dataQuality,
      
      // Enhanced category analytics
      categories: categoryData,
      categoryGroups: CATEGORY_GROUPS,
      spendByGroup,
      totalMonthSpend,
      
      // Trends
      monthlyTrend,
      
      // Top vendors
      topVendors,
      
      // Summary
      summary: {
        totalTransactions,
        totalExpenses,
        totalRevenue,
        categoriesWithSpend: categoryData.filter(c => c.spend > 0).length,
        categoriesOverBudget: categoryData.filter(c => c.status === 'over').length,
        categoriesWarning: categoryData.filter(c => c.status === 'warning').length
      }
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

