import { NextRequest, NextResponse } from 'next/server'
import { calculateBurnRateMetrics, calculateBurnTrend, getBurnByCategory } from '@/lib/burn-rate-calculator'

/**
 * GET /api/burn-rate?companyId=xxx
 * 
 * Returns comprehensive burn rate metrics:
 * - Gross Burn Rate (total monthly expenses)
 * - Net Burn Rate (expenses - revenue)
 * - Monthly Revenue
 * - Monthly Expenses
 * - Runway
 * - Profitability status
 * - Burn trend
 * - Category breakdown
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

    // Get comprehensive burn rate metrics
    const metrics = await calculateBurnRateMetrics(companyId)
    
    // Get burn trend
    const trend = await calculateBurnTrend(companyId)
    
    // Get category breakdown
    const categoryBreakdown = await getBurnByCategory(companyId)

    return NextResponse.json({
      success: true,
      metrics: {
        // Gross Burn Rate: Total monthly cash expenses
        grossBurnRate: Math.round(metrics.grossBurnRate),
        grossBurnRateFormatted: `₹${(metrics.grossBurnRate / 100000).toFixed(2)}L`,
        
        // Net Burn Rate: Monthly expenses - Monthly revenue
        netBurnRate: Math.round(metrics.netBurnRate),
        netBurnRateFormatted: `₹${(metrics.netBurnRate / 100000).toFixed(2)}L`,
        
        // Revenue
        monthlyRevenue: Math.round(metrics.monthlyRevenue),
        monthlyRevenueFormatted: `₹${(metrics.monthlyRevenue / 100000).toFixed(2)}L`,
        
        // Expenses
        monthlyExpenses: Math.round(metrics.monthlyExpenses),
        monthlyExpensesFormatted: `₹${(metrics.monthlyExpenses / 100000).toFixed(2)}L`,
        
        // Runway
        runway: metrics.runway === Infinity ? null : metrics.runway,
        runwayFormatted: metrics.runway === Infinity 
          ? '∞ (Profitable)' 
          : `${Math.floor(metrics.runway)} months`,
        
        // Status
        profitability: metrics.profitability,
        calculationPeriod: metrics.calculationPeriod,
      },
      trend: {
        current: Math.round(trend.current),
        previous: Math.round(trend.previous),
        trend: trend.trend,
        percentageChange: Math.round(trend.percentageChange * 10) / 10,
      },
      categoryBreakdown: categoryBreakdown.map(cat => ({
        category: cat.category,
        amount: Math.round(cat.amount),
        amountFormatted: `₹${(cat.amount / 100000).toFixed(2)}L`,
        percentage: Math.round(cat.percentage * 10) / 10,
      })),
      explanation: {
        grossBurnRate: 'Total monthly cash expenses (salaries, rent, subscriptions, etc.)',
        netBurnRate: 'Monthly expenses minus monthly revenue (actual cash loss per month)',
        runway: metrics.profitability 
          ? 'You are profitable! Revenue exceeds expenses.' 
          : 'Months of cash left at current net burn rate',
      },
    })
  } catch (error) {
    console.error('Failed to calculate burn rate:', error)
    return NextResponse.json(
      { error: 'Failed to calculate burn rate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



