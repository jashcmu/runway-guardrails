import { prisma } from './prisma'
import { getMonthlyBurnForCompany, getRunwayForCompany } from './calculations'
import { Category } from '@prisma/client'
import { getOpenAIClient } from './openai-client'

export interface SmartAlert {
  id: string
  type: 'burn_increase' | 'burn_decrease' | 'runway_warning' | 'budget_risk' | 'spending_trend' | 'recommendation'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  recommendation?: string
  category?: Category
  actionable: boolean
}

export async function generateSmartAlerts(
  companyId: string,
  cashBalance: number
): Promise<SmartAlert[]> {
  const alerts: SmartAlert[] = []

  // Get current metrics
  const currentBurn = await getMonthlyBurnForCompany(companyId)
  const currentRunway = await getRunwayForCompany(companyId, cashBalance)

  // Get historical burn data
  const now = new Date()
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const recentTransactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: threeMonthsAgo },
    },
  })

  // Calculate burn trend
  const monthlyBurns: Record<string, number> = {}
  for (const txn of recentTransactions) {
    const date = new Date(txn.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    monthlyBurns[monthKey] = (monthlyBurns[monthKey] || 0) + amount
  }

  const burnValues = Object.values(monthlyBurns).sort((a, b) => a - b)
  if (burnValues.length >= 2) {
    const oldestBurn = burnValues[0]
    const newestBurn = burnValues[burnValues.length - 1]
    const burnChange = ((newestBurn - oldestBurn) / oldestBurn) * 100

    if (burnChange > 20) {
      alerts.push({
        id: `burn-increase-${Date.now()}`,
        type: 'burn_increase',
        severity: 'warning',
        title: 'Burn Rate Increased Significantly',
        message: `Your monthly burn rate has increased by ${burnChange.toFixed(0)}% over the last ${burnValues.length} months. Current burn: ₹${currentBurn.toLocaleString('en-IN')}.`,
        recommendation: `Review recent spending and identify areas for cost optimization. Consider reducing non-essential expenses to stabilize burn rate.`,
        actionable: true,
      })
    } else if (burnChange < -15) {
      alerts.push({
        id: `burn-decrease-${Date.now()}`,
        type: 'burn_decrease',
        severity: 'info',
        title: 'Burn Rate Improved',
        message: `Great news! Your burn rate has decreased by ${Math.abs(burnChange).toFixed(0)}% over the last ${burnValues.length} months.`,
        recommendation: `This improvement extends your runway. Consider maintaining this spending level or investing in growth opportunities.`,
        actionable: false,
      })
    }
  }

  // Runway warnings
  if (currentRunway !== null && currentRunway !== Infinity) {
    if (currentRunway < 3) {
      alerts.push({
        id: `runway-critical-${Date.now()}`,
        type: 'runway_warning',
        severity: 'critical',
        title: 'Critical: Runway Below 3 Months',
        message: `Your runway is ${currentRunway.toFixed(1)} months. Immediate action required to secure funding or reduce expenses.`,
        recommendation: `1. Reduce all non-essential spending immediately\n2. Accelerate fundraising efforts\n3. Consider emergency cost-cutting measures\n4. Review and pause non-critical projects`,
        actionable: true,
      })
    } else if (currentRunway < 6) {
      alerts.push({
        id: `runway-warning-${Date.now()}`,
        type: 'runway_warning',
        severity: 'warning',
        title: 'Warning: Runway Below 6 Months',
        message: `Your runway is ${currentRunway.toFixed(1)} months. Start planning for fundraising or cost reduction.`,
        recommendation: `1. Begin fundraising process (takes 3-6 months)\n2. Identify areas to reduce burn by 20-30%\n3. Extend runway through revenue acceleration if possible`,
        actionable: true,
      })
    } else if (currentRunway < 12) {
      alerts.push({
        id: `runway-info-${Date.now()}`,
        type: 'runway_warning',
        severity: 'info',
        title: 'Runway Below 12 Months',
        message: `Your runway is ${currentRunway.toFixed(1)} months. Consider starting fundraising discussions.`,
        recommendation: `Plan ahead: Start networking with investors and prepare pitch materials. Aim to raise funds before runway drops below 6 months.`,
        actionable: true,
      })
    }
  }

  // Budget risk alerts
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

  const budgets = await prisma.budget.findMany({
    where: {
      companyId,
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
  })

  const allTransactions = await prisma.transaction.findMany({
    where: { companyId },
  })

  for (const budget of budgets) {
    const budgetAmount = typeof budget.amount === 'number' ? budget.amount : parseFloat(String(budget.amount))
    const monthTransactions = allTransactions.filter(txn => {
      const date = new Date(txn.date)
      return date.getFullYear() === currentYear && 
             date.getMonth() === currentMonth &&
             txn.category === budget.category
    })
    
    const monthSpend = monthTransactions.reduce((sum, txn) => {
      const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
      return sum + amount
    }, 0)

    const percentage = budgetAmount > 0 ? (monthSpend / budgetAmount) * 100 : 0
    const daysRemaining = Math.floor((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const projectedSpend = monthSpend * (30 / (30 - daysRemaining))

    if (percentage >= 100) {
      alerts.push({
        id: `budget-over-${budget.category}-${Date.now()}`,
        type: 'budget_risk',
        severity: 'critical',
        title: `Over Budget: ${budget.category}`,
        message: `You've exceeded your ${budget.category} budget by ${formatCurrency(monthSpend - budgetAmount)} (${percentage.toFixed(0)}% used).`,
        recommendation: `Immediately stop all non-essential spending in this category. Review and approve any new expenses before processing.`,
        category: budget.category,
        actionable: true,
      })
    } else if (percentage >= 80) {
      alerts.push({
        id: `budget-warning-${budget.category}-${Date.now()}`,
        type: 'budget_risk',
        severity: 'warning',
        title: `Budget Warning: ${budget.category}`,
        message: `You've used ${percentage.toFixed(0)}% of your ${budget.category} budget. Projected to exceed by month end.`,
        recommendation: `Review remaining budget carefully. Consider deferring non-urgent expenses to next month.`,
        category: budget.category,
        actionable: true,
      })
    } else if (projectedSpend > budgetAmount && percentage > 50) {
      alerts.push({
        id: `budget-trend-${budget.category}-${Date.now()}`,
        type: 'budget_risk',
        severity: 'info',
        title: `Budget Trend: ${budget.category}`,
        message: `At current spending rate, you'll exceed your ${budget.category} budget by ${formatCurrency(projectedSpend - budgetAmount)}.`,
        recommendation: `Monitor spending closely. Adjust pace if needed to stay within budget.`,
        category: budget.category,
        actionable: true,
      })
    }
  }

  // Spending trend recommendations
  const categorySpend: Record<string, number> = {}
  for (const txn of recentTransactions) {
    const category = txn.category
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    categorySpend[category] = (categorySpend[category] || 0) + amount
  }

  const totalSpend = Object.values(categorySpend).reduce((sum, amt) => sum + amt, 0)
  const topCategory = Object.entries(categorySpend)
    .sort(([, a], [, b]) => b - a)[0]

  if (topCategory && totalSpend > 0) {
    const [category, amount] = topCategory
    const percentage = (amount / totalSpend) * 100

    if (percentage > 40) {
      alerts.push({
        id: `spending-concentration-${Date.now()}`,
        type: 'spending_trend',
        severity: 'info',
        title: 'Spending Concentration',
        message: `${category} accounts for ${percentage.toFixed(0)}% of your spending. Consider diversifying expenses.`,
        recommendation: `Review if this concentration is intentional. High concentration in one category increases risk if that area needs to be cut.`,
        category: category as Category,
        actionable: false,
      })
    }
  }

  // AI-Powered Predictive Alerts (using OpenAI)
  try {
    const context = {
      currentBurn,
      currentRunway,
      cashBalance,
      recentTransactions: recentTransactions.slice(0, 20).map(t => ({
        category: t.category,
        amount: t.amount,
        date: t.date,
      })),
      categorySpend,
    }

    const prompt = `You are a financial advisor for startups. Analyze this company's spending data and predict future risks or opportunities:

Current Burn Rate: ₹${currentBurn.toLocaleString('en-IN')}/month
Current Runway: ${currentRunway === null || currentRunway === Infinity ? 'Infinite' : `${currentRunway.toFixed(1)} months`}
Cash Balance: ₹${cashBalance.toLocaleString('en-IN')}

Category Spending (last 3 months):
${Object.entries(categorySpend).map(([cat, amt]) => `- ${cat}: ₹${amt.toLocaleString('en-IN')}`).join('\n')}

Based on the trends, provide ONE short predictive insight (max 2 sentences) about a future risk or opportunity. Focus on:
- Seasonal patterns you notice
- Category-specific trends that might escalate
- Timing recommendations for fundraising or cost-cutting
- Growth opportunities based on spending patterns

Return ONLY the prediction text, no formatting.`

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{role:'user', content: prompt}],
      temperature: 0.7,
      max_tokens: 150,
    })

    const prediction = completion.choices[0]?.message?.content?.trim()
    if (prediction && prediction.length > 20) {
      alerts.push({
        id: `ai-prediction-${Date.now()}`,
        type: 'recommendation',
        severity: 'info',
        title: '🤖 AI Prediction',
        message: prediction,
        recommendation: 'This prediction is generated by AI based on your historical spending patterns. Use it as one input for decision-making.',
        actionable: false,
      })
    }
  } catch (error) {
    console.error('AI prediction error:', error)
    // Fail silently - don't block other alerts
  }

  return alerts
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

