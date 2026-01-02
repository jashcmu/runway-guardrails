import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Calculate investor-grade metrics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      )
    }

    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Get transactions for burn rate calculation
    const transactions = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
    })

    // Calculate date ranges
    const now = new Date()
    const lastMonth = new Date(now)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const last3Months = new Date(now)
    last3Months.setMonth(last3Months.getMonth() - 3)
    const last6Months = new Date(now)
    last6Months.setMonth(last6Months.getMonth() - 6)

    // Transactions in different time periods
    const txnsLastMonth = transactions.filter(t => new Date(t.date) >= lastMonth)
    const txnsLast3Months = transactions.filter(t => new Date(t.date) >= last3Months)
    const txnsLast6Months = transactions.filter(t => new Date(t.date) >= last6Months)

    // 1. Net Burn Rate (average monthly burn)
    let netBurnRate = 0
    if (txnsLast3Months.length > 0) {
      const totalBurn = txnsLast3Months.reduce((sum, t) => sum + t.amount, 0)
      const monthsCount = Math.max(1, Math.ceil((now.getTime() - last3Months.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      netBurnRate = totalBurn / monthsCount
    }

    // 2. Gross Burn (total expenses without revenue offset)
    const grossBurn = netBurnRate // Since we don't have revenue tracking yet

    // 3. Runway (months of cash left)
    const runway = netBurnRate > 0 ? company.cashBalance / netBurnRate : null

    // 4. Cash Coverage Ratio (how many months of expenses can be covered)
    const cashCoverageRatio = netBurnRate > 0 ? company.cashBalance / netBurnRate : null

    // 5. Burn Multiple (Net burn / Net new ARR - for efficiency)
    // For now, we'll set this as N/A since we don't track revenue yet
    const burnMultiple = null
    const burnMultipleNote = 'Requires revenue tracking'

    // 6. Capital Efficiency (ARR / Total raised)
    // For now, N/A
    const capitalEfficiency = null
    const capitalEfficiencyNote = 'Requires fundraising data'

    // 7. Monthly Burn Trend (last 6 months)
    const monthlyBurnTrend: { month: string; burn: number; transactions: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now)
      monthStart.setMonth(monthStart.getMonth() - i)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      
      const monthEnd = new Date(monthStart)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      
      const monthTxns = transactions.filter(t => {
        const txDate = new Date(t.date)
        return txDate >= monthStart && txDate < monthEnd
      })
      
      const monthBurn = monthTxns.reduce((sum, t) => sum + t.amount, 0)
      
      monthlyBurnTrend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        burn: monthBurn,
        transactions: monthTxns.length,
      })
    }

    // 8. Burn Acceleration (comparing last month to previous month)
    const currentMonthTxns = txnsLastMonth
    const currentMonthBurn = currentMonthTxns.reduce((sum, t) => sum + t.amount, 0)
    
    const previousMonth = new Date(lastMonth)
    previousMonth.setMonth(previousMonth.getMonth() - 1)
    const previousMonthTxns = transactions.filter(t => {
      const txDate = new Date(t.date)
      return txDate >= previousMonth && txDate < lastMonth
    })
    const previousMonthBurn = previousMonthTxns.reduce((sum, t) => sum + t.amount, 0)
    
    const burnAcceleration = previousMonthBurn > 0 
      ? ((currentMonthBurn - previousMonthBurn) / previousMonthBurn) * 100 
      : 0

    // 9. Quick Ratio (for SaaS - requires MRR tracking)
    const quickRatio = null
    const quickRatioNote = 'Requires MRR tracking'

    // 10. Days of Cash Remaining
    const dailyBurn = netBurnRate / 30
    const daysOfCash = dailyBurn > 0 ? Math.floor(company.cashBalance / dailyBurn) : null

    // 11. Projected cash depletion date
    let cashDepletionDate = null
    if (runway !== null && runway > 0) {
      const depletionDate = new Date()
      depletionDate.setMonth(depletionDate.getMonth() + Math.floor(runway))
      cashDepletionDate = depletionDate.toISOString()
    }

    // 12. Efficiency Score (how well they're managing burn)
    // Lower burn acceleration + higher runway = better score (0-100)
    let efficiencyScore = 50 // default neutral
    if (runway !== null) {
      if (runway > 18) efficiencyScore += 30 // Excellent runway
      else if (runway > 12) efficiencyScore += 20 // Good runway
      else if (runway > 6) efficiencyScore += 10 // Okay runway
      else efficiencyScore -= 20 // Critical runway
    }
    if (burnAcceleration < 0) efficiencyScore += 20 // Decreasing burn is good
    else if (burnAcceleration > 20) efficiencyScore -= 20 // Rapidly increasing burn is bad
    
    efficiencyScore = Math.max(0, Math.min(100, efficiencyScore))

    // 13. Risk Level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (runway === null || runway > 12) riskLevel = 'low'
    else if (runway > 6) riskLevel = 'medium'
    else if (runway > 3) riskLevel = 'high'
    else riskLevel = 'critical'

    // 14. Recommendations based on metrics
    const recommendations: string[] = []
    if (runway !== null && runway < 6) {
      recommendations.push('⚠️ URGENT: Runway below 6 months. Consider fundraising or reducing burn.')
    }
    if (burnAcceleration > 30) {
      recommendations.push('📈 Burn rate increased by ' + burnAcceleration.toFixed(1) + '% last month. Review expenses.')
    }
    if (runway !== null && runway > 18) {
      recommendations.push('✅ Strong runway position. Good time for strategic investments.')
    }
    if (currentMonthBurn === 0) {
      recommendations.push('💡 No expenses recorded yet. Add transactions to see meaningful metrics.')
    }

    // Return all metrics
    return NextResponse.json({
      metrics: {
        // Core metrics
        cashBalance: company.cashBalance,
        netBurnRate,
        grossBurn,
        runway,
        
        // Efficiency metrics
        cashCoverageRatio,
        burnMultiple,
        burnMultipleNote,
        capitalEfficiency,
        capitalEfficiencyNote,
        quickRatio,
        quickRatioNote,
        
        // Trend metrics
        monthlyBurnTrend,
        burnAcceleration,
        currentMonthBurn,
        previousMonthBurn,
        
        // Projections
        daysOfCash,
        cashDepletionDate,
        
        // Scoring
        efficiencyScore,
        riskLevel,
        recommendations,
      },
      summary: {
        runway: runway !== null ? `${runway.toFixed(1)} months` : 'Infinite',
        burnRate: `₹${(netBurnRate / 100000).toFixed(1)}L/month`,
        riskLevel,
        daysLeft: daysOfCash,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('Metrics calculation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}



