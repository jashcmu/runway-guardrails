// Comprehensive Burn Rate Calculator
// Handles both Net Burn Rate and Gross Burn Rate calculations
import { PrismaClient, Transaction } from '@prisma/client'

const prisma = new PrismaClient()

export interface BurnRateMetrics {
  grossBurnRate: number // Total monthly expenses (all money going out)
  netBurnRate: number // Total monthly expenses - Total monthly revenue
  monthlyRevenue: number // Total money coming in
  monthlyExpenses: number // Total money going out
  runway: number // Months of cash left (using net burn rate)
  profitability: boolean // Whether revenue > expenses (net burn < 0)
  calculationPeriod: 'last_3_months' | 'last_month' | 'insufficient_data'
}

/**
 * Calculate comprehensive burn rate metrics for a company.
 * 
 * GROSS BURN RATE: Total monthly cash expenses (salaries, rent, subscriptions, etc.)
 * NET BURN RATE: Gross burn - Monthly revenue (how much cash you're losing per month)
 * 
 * @param companyId - The company ID
 * @param cashBalance - Current cash balance (optional, will fetch if not provided)
 * @returns BurnRateMetrics object with all burn rate calculations
 */
export async function calculateBurnRateMetrics(
  companyId: string,
  cashBalance?: number
): Promise<BurnRateMetrics> {
  // Fetch company cash balance if not provided
  if (cashBalance === undefined) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cashBalance: true },
    })
    cashBalance = company?.cashBalance || 0
  }

  // Get ALL transactions to calculate burn rate
  const allTransactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      amount: true,
      date: true,
    },
    orderBy: { date: 'asc' },
  })

  console.log(`🔍 Found ${allTransactions.length} total transactions for company ${companyId}`)

  // If no transactions, return zeros
  if (allTransactions.length === 0) {
    console.log('⚠️  No transactions found - returning zero metrics')
    return {
      grossBurnRate: 0,
      netBurnRate: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      runway: cashBalance > 0 ? Infinity : 0,
      profitability: true,
      calculationPeriod: 'insufficient_data',
    }
  }

  // Calculate time period (from first to last transaction)
  const firstDate = new Date(allTransactions[0].date)
  const lastDate = new Date(allTransactions[allTransactions.length - 1].date)
  const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  const monthsDiff = Math.max(1, daysDiff / 30) // Convert days to months

  console.log(`📅 Transaction period: ${monthsDiff.toFixed(2)} months (${daysDiff.toFixed(0)} days)`)

  // Separate expenses (negative amounts) and revenues (positive amounts)
  const expenses = allTransactions.filter(t => t.amount < 0)
  const revenues = allTransactions.filter(t => t.amount > 0)

  console.log(`💸 Expenses: ${expenses.length} transactions`)
  console.log(`💰 Revenues: ${revenues.length} transactions`)

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const totalRevenue = revenues.reduce((sum, t) => sum + t.amount, 0)

  console.log(`📊 Total Expenses: ₹${totalExpenses.toLocaleString()}`)
  console.log(`📊 Total Revenue: ₹${totalRevenue.toLocaleString()}`)

  // Calculate monthly averages based on actual time period
  const monthlyExpenses = totalExpenses / monthsDiff
  const monthlyRevenue = totalRevenue / monthsDiff

  console.log(`📊 Monthly Expenses: ₹${monthlyExpenses.toLocaleString()}`)
  console.log(`📊 Monthly Revenue: ₹${monthlyRevenue.toLocaleString()}`)

  // GROSS BURN RATE = Total monthly expenses (all cash going out)
  const grossBurnRate = monthlyExpenses

  // NET BURN RATE = Monthly expenses - Monthly revenue
  // Negative net burn means profitable (revenue > expenses)
  const netBurnRate = monthlyExpenses - monthlyRevenue

  // RUNWAY = Cash balance / Net burn rate (in months)
  // If net burn is 0 or negative (profitable), runway is infinite
  let runway: number
  if (netBurnRate <= 0) {
    runway = cashBalance > 0 ? Infinity : 0
  } else {
    runway = cashBalance / netBurnRate
  }

  // Profitability check
  const profitability = netBurnRate <= 0

  // Determine calculation period
  let calculationPeriod: 'last_3_months' | 'last_month' | 'insufficient_data'
  if (monthsDiff >= 2) {
    calculationPeriod = 'last_3_months'
  } else if (monthsDiff >= 0.5) {
    calculationPeriod = 'last_month'
  } else {
    calculationPeriod = 'insufficient_data'
  }

  console.log(`✅ Burn Rate Metrics Calculated:`)
  console.log(`   - Gross Burn: ₹${grossBurnRate.toLocaleString()}/month`)
  console.log(`   - Net Burn: ₹${netBurnRate.toLocaleString()}/month`)
  console.log(`   - Runway: ${runway === Infinity ? '∞' : runway.toFixed(1)} months`)

  return {
    grossBurnRate,
    netBurnRate,
    monthlyRevenue,
    monthlyExpenses,
    runway,
    profitability,
    calculationPeriod,
  }
}

/**
 * Calculate burn rate trend over time to see if burn is increasing or decreasing.
 */
export async function calculateBurnTrend(companyId: string): Promise<{
  current: number
  previous: number
  trend: 'increasing' | 'decreasing' | 'stable'
  percentageChange: number
}> {
  const now = new Date()
  
  // Get current month transactions
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthTxns = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: currentMonthStart },
      amount: { lt: 0 }, // Only expenses
    },
  })
  
  // Get previous month transactions
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthEnd = currentMonthStart
  const previousMonthTxns = await prisma.transaction.findMany({
    where: {
      companyId,
      date: {
        gte: previousMonthStart,
        lt: previousMonthEnd,
      },
      amount: { lt: 0 }, // Only expenses
    },
  })
  
  const currentBurn = currentMonthTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const previousBurn = previousMonthTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  let percentageChange = 0
  
  if (previousBurn > 0) {
    percentageChange = ((currentBurn - previousBurn) / previousBurn) * 100
    
    if (percentageChange > 5) {
      trend = 'increasing'
    } else if (percentageChange < -5) {
      trend = 'decreasing'
    }
  }
  
  return {
    current: currentBurn,
    previous: previousBurn,
    trend,
    percentageChange,
  }
}

/**
 * Get monthly burn breakdown by category.
 */
export async function getBurnByCategory(companyId: string): Promise<{
  category: string
  amount: number
  percentage: number
}[]> {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  
  const expenses = await prisma.transaction.findMany({
    where: {
      companyId,
      amount: { lt: 0 },
      date: { gte: threeMonthsAgo },
    },
    select: {
      category: true,
      amount: true,
    },
  })
  
  // Group by category
  const categoryTotals = new Map<string, number>()
  let totalExpenses = 0
  
  for (const expense of expenses) {
    const amount = Math.abs(expense.amount)
    totalExpenses += amount
    
    const current = categoryTotals.get(expense.category) || 0
    categoryTotals.set(expense.category, current + amount)
  }
  
  // Convert to array with percentages (monthly average)
  const breakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: amount / 3, // Monthly average
      percentage: (amount / totalExpenses) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
  
  return breakdown
}

/**
 * Update company runway in database based on current metrics.
 */
export async function updateCompanyRunway(companyId: string): Promise<number> {
  const metrics = await calculateBurnRateMetrics(companyId)
  
  const runwayMonths = metrics.runway === Infinity ? 999 : Math.floor(metrics.runway)
  
  await prisma.company.update({
    where: { id: companyId },
    data: {
      targetMonths: runwayMonths,
    },
  })
  
  return metrics.runway
}

