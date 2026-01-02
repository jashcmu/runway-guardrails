import { prisma } from '@/lib/prisma'
import { calculateTrialBalance, getAccountBalancesByType } from '@/lib/accounting/trial-balance'

/**
 * AI-Powered Financial Health Score
 * Analyzes company's financial health across multiple dimensions
 */

export interface FinancialHealthScore {
  overall: number // 0-100
  breakdown: {
    liquidity: number // Cash runway, quick ratio
    profitability: number // Margins, growth
    efficiency: number // Burn multiple, capital efficiency
    growth: number // Revenue growth, expense growth
  }
  recommendations: string[]
  alerts: string[]
  trend: 'improving' | 'stable' | 'declining'
}

/**
 * Calculate financial health score
 */
export async function calculateFinancialHealthScore(
  companyId: string
): Promise<FinancialHealthScore> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  if (!company) {
    throw new Error('Company not found')
  }

  // Get account balances
  const balances = await getAccountBalancesByType(companyId)

  // Get recent transactions (last 3 months)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const [recentExpenses, recentRevenues] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        companyId,
        date: { gte: threeMonthsAgo },
      },
    }),
    prisma.revenue.findMany({
      where: {
        companyId,
        date: { gte: threeMonthsAgo },
      },
    }),
  ])

  // Calculate metrics
  const totalRevenue = recentRevenues.reduce((sum, r) => sum + r.amount, 0) / 3 // Monthly avg
  const totalExpenses = recentExpenses.reduce((sum, e) => sum + e.amount, 0) / 3 // Monthly avg
  const monthlyBurn = totalExpenses - totalRevenue

  // LIQUIDITY SCORE (0-100)
  let liquidityScore = 0
  const currentAssets = balances.Asset
  const currentLiabilities = balances.Liability
  const quickRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 1

  // Runway months
  const runwayMonths = monthlyBurn > 0 ? company.cashBalance / monthlyBurn : 999

  if (runwayMonths >= 24) liquidityScore = 100
  else if (runwayMonths >= 18) liquidityScore = 90
  else if (runwayMonths >= 12) liquidityScore = 80
  else if (runwayMonths >= 9) liquidityScore = 70
  else if (runwayMonths >= 6) liquidityScore = 50
  else if (runwayMonths >= 3) liquidityScore = 30
  else liquidityScore = 10

  // Quick ratio bonus
  if (quickRatio >= 2) liquidityScore = Math.min(100, liquidityScore + 10)
  else if (quickRatio < 1) liquidityScore = Math.max(0, liquidityScore - 20)

  // PROFITABILITY SCORE (0-100)
  let profitabilityScore = 50 // Default

  if (totalRevenue > 0) {
    const netMargin = ((totalRevenue - totalExpenses) / totalRevenue) * 100

    if (netMargin >= 30) profitabilityScore = 100
    else if (netMargin >= 20) profitabilityScore = 90
    else if (netMargin >= 10) profitabilityScore = 75
    else if (netMargin >= 0) profitabilityScore = 60
    else if (netMargin >= -20) profitabilityScore = 40
    else if (netMargin >= -50) profitabilityScore = 20
    else profitabilityScore = 10
  } else {
    // No revenue yet (early stage)
    profitabilityScore = 30
  }

  // EFFICIENCY SCORE (0-100)
  let efficiencyScore = 50

  if (totalRevenue > 0) {
    const burnMultiple = monthlyBurn / totalRevenue

    if (burnMultiple <= 0) efficiencyScore = 100 // Profitable
    else if (burnMultiple <= 1) efficiencyScore = 90
    else if (burnMultiple <= 2) efficiencyScore = 70
    else if (burnMultiple <= 3) efficiencyScore = 50
    else if (burnMultiple <= 5) efficiencyScore = 30
    else efficiencyScore = 10
  }

  // GROWTH SCORE (0-100)
  let growthScore = 50 // Default

  // Compare last month vs previous month
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

  const [lastMonthRevenues, previousMonthRevenues] = await Promise.all([
    prisma.revenue.findMany({
      where: {
        companyId,
        date: { gte: oneMonthAgo },
      },
    }),
    prisma.revenue.findMany({
      where: {
        companyId,
        date: { gte: threeMonthsAgo, lt: oneMonthAgo },
      },
    }),
  ])

  const lastMonthRev = lastMonthRevenues.reduce((sum, r) => sum + r.amount, 0)
  const prevMonthRev = previousMonthRevenues.reduce((sum, r) => sum + r.amount, 0) / 2 // Avg

  if (prevMonthRev > 0) {
    const growth = ((lastMonthRev - prevMonthRev) / prevMonthRev) * 100

    if (growth >= 50) growthScore = 100
    else if (growth >= 30) growthScore = 90
    else if (growth >= 20) growthScore = 80
    else if (growth >= 10) growthScore = 70
    else if (growth >= 0) growthScore = 60
    else if (growth >= -10) growthScore = 40
    else growthScore = 20
  }

  // OVERALL SCORE
  const overall = Math.round(
    liquidityScore * 0.35 + profitabilityScore * 0.25 + efficiencyScore * 0.25 + growthScore * 0.15
  )

  // RECOMMENDATIONS
  const recommendations: string[] = []

  if (liquidityScore < 50) {
    recommendations.push('⚠️ Low cash runway - Consider fundraising or reducing burn')
  }
  if (profitabilityScore < 40) {
    recommendations.push('💡 Focus on improving margins or reducing costs')
  }
  if (efficiencyScore < 50) {
    recommendations.push('📊 High burn multiple - Optimize capital efficiency')
  }
  if (growthScore < 60) {
    recommendations.push('📈 Revenue growth slowing - Focus on customer acquisition')
  }

  if (overall >= 80) {
    recommendations.push('✨ Strong financial health - Keep up the good work!')
  }

  // ALERTS
  const alerts: string[] = []

  if (runwayMonths < 3) {
    alerts.push('🚨 CRITICAL: Less than 3 months runway remaining!')
  } else if (runwayMonths < 6) {
    alerts.push('⚠️ WARNING: Less than 6 months runway remaining')
  }

  if (quickRatio < 1) {
    alerts.push('⚠️ Current liabilities exceed current assets')
  }

  if (totalRevenue === 0 && totalExpenses > 0) {
    alerts.push('💡 No revenue recorded - Consider tracking revenue or sales')
  }

  // TREND
  const trend: 'improving' | 'stable' | 'declining' =
    overall >= 70 ? 'improving' : overall >= 50 ? 'stable' : 'declining'

  return {
    overall,
    breakdown: {
      liquidity: Math.round(liquidityScore),
      profitability: Math.round(profitabilityScore),
      efficiency: Math.round(efficiencyScore),
      growth: Math.round(growthScore),
    },
    recommendations,
    alerts,
    trend,
  }
}




