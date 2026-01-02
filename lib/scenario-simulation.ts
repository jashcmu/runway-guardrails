import { prisma } from './prisma'
import { getMonthlyBurnForCompany, getRunwayForCompany } from './calculations'
import { Category } from '@prisma/client'

export type ScenarioAction = 
  | { type: 'hire'; count: number; avgSalary: number }
  | { type: 'marketing'; additionalSpend: number }
  | { type: 'vendor'; monthlyCost: number; category: Category }
  | { type: 'revenue_delay'; months: number; monthlyRevenue: number }
  | { type: 'fundraising'; targetMonths: number }
  | { type: 'growth'; revenueGrowthRate: number }
  | { type: 'layoff'; count: number; avgSalary: number }
  | { type: 'pivot'; cutCategory: Category; doubleCategory: Category }

export type ScenarioResult = {
  currentBurn: number
  projectedBurn: number
  currentRunway: number | null
  projectedRunway: number | null
  riskLevel: 'safe' | 'risky' | 'dangerous'
  impact: {
    burnIncrease: number
    runwayDecrease: number | null
    runwayDecreaseMonths: number | null
  }
  message: string
}

/**
 * Simulate the impact of a decision on burn rate and runway.
 * Returns risk level and survival consequences.
 * Enhanced with predictive logic for realistic scenarios.
 */
export async function simulateScenario(
  companyId: string,
  cashBalance: number,
  actions: ScenarioAction[]
): Promise<ScenarioResult> {
  // Get current state
  const currentBurn = await getMonthlyBurnForCompany(companyId)
  const currentRunway = await getRunwayForCompany(companyId, cashBalance)

  // Get historical data for predictive enhancements
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    orderBy: { date: 'desc' },
    take: 100,
  })

  // Calculate projected burn with predictive adjustments
  let additionalMonthlyBurn = 0
  let recommendations: string[] = []

  for (const action of actions) {
    switch (action.type) {
      case 'hire':
        // Hiring has overhead beyond just salary (15-20% for benefits, tools, etc.)
        const salaryMonthly = (action.count * action.avgSalary) / 12
        const overheadMultiplier = 1.18 // 18% overhead per employee
        additionalMonthlyBurn += salaryMonthly * overheadMultiplier
        
        recommendations.push(`💡 Note: Hiring ${action.count} employee(s) includes ~18% overhead for benefits, tools, and workspace`)
        
        // Check if this will strain other categories
        const avgCategorySpend = currentBurn / 4 // Rough estimate
        if (salaryMonthly > avgCategorySpend * 2) {
          recommendations.push(`⚠️ This hire represents 2x your average category spend. Ensure other expenses are controlled.`)
        }
        break

      case 'marketing':
        additionalMonthlyBurn += action.additionalSpend
        
        // Analyze historical marketing spend trends
        const marketingTxns = transactions.filter(t => t.category === 'Marketing')
        if (marketingTxns.length > 0) {
          const avgMarketingSpend = marketingTxns.reduce((sum, t) => sum + t.amount, 0) / marketingTxns.length
          const increase = (action.additionalSpend / avgMarketingSpend) * 100
          if (increase > 50) {
            recommendations.push(`📊 Marketing spend increase of ${increase.toFixed(0)}% is aggressive. Plan for ROI measurement.`)
          }
        }
        break

      case 'vendor':
        additionalMonthlyBurn += action.monthlyCost
        break

      case 'revenue_delay':
        // Revenue delay doesn't increase burn, but reduces runway by delaying income
        recommendations.push(`⏰ Revenue delay of ${action.months} months will reduce effective runway`)
        break

      case 'fundraising':
        // Fundraising scenario - how long until you need to raise?
        const monthsToTarget = action.targetMonths
        recommendations.push(`🎯 Target: ${monthsToTarget} months of runway. You'll need to raise in ~${Math.max(0, monthsToTarget - 6)} months for safety.`)
        break

      case 'growth':
        // Revenue growth scenario - positive impact on burn
        const revenueImpact = (currentBurn * action.revenueGrowthRate) / 100
        additionalMonthlyBurn -= revenueImpact // Revenue reduces burn
        recommendations.push(`📈 ${action.revenueGrowthRate}% revenue growth reduces net burn by ${formatCurrency(revenueImpact)}/month`)
        break

      case 'layoff':
        // Layoff reduces burn
        const layoffSavings = (action.count * action.avgSalary) / 12
        additionalMonthlyBurn -= layoffSavings * 1.18 // Include overhead savings
        recommendations.push(`💼 Layoff of ${action.count} employee(s) saves ${formatCurrency(layoffSavings * 1.18)}/month including overhead`)
        break

      case 'pivot':
        // Pivot: cut one category, double another
        const cutCategorySpend = transactions
          .filter(t => t.category === action.cutCategory)
          .reduce((sum, t) => sum + t.amount, 0) / Math.max(1, transactions.filter(t => t.category === action.cutCategory).length)
        
        const doubleCategorySpend = transactions
          .filter(t => t.category === action.doubleCategory)
          .reduce((sum, t) => sum + t.amount, 0) / Math.max(1, transactions.filter(t => t.category === action.doubleCategory).length)

        additionalMonthlyBurn = additionalMonthlyBurn - cutCategorySpend + doubleCategorySpend
        recommendations.push(`🔄 Pivot: Cut ${action.cutCategory} (-${formatCurrency(cutCategorySpend)}/mo), Double ${action.doubleCategory} (+${formatCurrency(doubleCategorySpend)}/mo)`)
        break
    }
  }

  const projectedBurn = Math.max(0, currentBurn + additionalMonthlyBurn)

  // Calculate projected runway
  let projectedRunway: number
  if (projectedBurn <= 0) {
    projectedRunway = cashBalance > 0 ? Infinity : 0
  } else {
    projectedRunway = cashBalance / projectedBurn
  }

  // Handle revenue delay impact
  const revenueDelayAction = actions.find(a => a.type === 'revenue_delay')
  if (revenueDelayAction && revenueDelayAction.type === 'revenue_delay') {
    // Revenue delay effectively reduces runway by the delay period
    projectedRunway = Math.max(0, projectedRunway - revenueDelayAction.months)
  }

  // Calculate impact
  const burnIncrease = additionalMonthlyBurn
  const runwayDecrease = currentRunway === Infinity 
    ? Infinity 
    : Math.max(0, currentRunway - projectedRunway)
  const runwayDecreaseMonths = currentRunway === Infinity 
    ? (projectedRunway === Infinity ? 0 : Infinity)
    : runwayDecrease

  // Determine risk level with smarter thresholds
  let riskLevel: 'safe' | 'risky' | 'dangerous' = 'safe'
  let message = ''

  if (projectedRunway === Infinity || projectedRunway > 18) {
    riskLevel = 'safe'
    message = `✅ Excellent: Runway remains above 18 months. This is an optimal position for strategic investments. Current: ${currentRunway === Infinity ? '∞' : currentRunway.toFixed(1)}mo → Projected: ${projectedRunway === Infinity ? '∞' : projectedRunway.toFixed(1)}mo.`
  } else if (projectedRunway > 12) {
    riskLevel = 'safe'
    message = `✅ Safe: Runway remains above 12 months (standard for Series A). Burn increases by ${formatCurrency(burnIncrease)}/month. Current: ${currentRunway === Infinity ? '∞' : currentRunway.toFixed(1)}mo → Projected: ${projectedRunway.toFixed(1)}mo.`
  } else if (projectedRunway > 6) {
    riskLevel = 'risky'
    message = `⚠️ Risky: Runway drops to ${projectedRunway.toFixed(1)} months. Burn increases by ${formatCurrency(burnIncrease)}/month. Plan fundraising or cost reduction now.`
  } else if (projectedRunway > 3) {
    riskLevel = 'dangerous'
    message = `🚨 Dangerous: Runway drops to ${projectedRunway.toFixed(1)} months. This threatens financial survival. Start fundraising immediately or cut burn by 30%+.`
  } else {
    riskLevel = 'dangerous'
    message = `🔴 CRITICAL: Runway drops to ${projectedRunway.toFixed(1)} months. Company survival at risk. Emergency measures required: layoffs, pivot, or emergency funding.`
  }

  // Add predictive recommendations
  if (projectedRunway < 6 && projectedRunway > 3) {
    recommendations.push(`⏰ Start fundraising NOW. Typical fundraising takes 3-6 months.`)
  }
  if (burnIncrease > currentBurn * 0.3) {
    recommendations.push(`📊 This increases burn by ${((burnIncrease/currentBurn)*100).toFixed(0)}%. Ensure you have strong growth metrics to justify.`)
  }

  return {
    currentBurn,
    projectedBurn,
    currentRunway: currentRunway === Infinity ? null : currentRunway,
    projectedRunway: projectedRunway === Infinity ? null : projectedRunway,
    riskLevel,
    impact: {
      burnIncrease,
      runwayDecrease: runwayDecrease === Infinity ? null : runwayDecrease,
      runwayDecreaseMonths: runwayDecreaseMonths === Infinity ? null : runwayDecreaseMonths,
    },
    message: `${message}\n\n${recommendations.join('\n')}`,
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

