import { prisma } from './prisma'
import { Category } from '@prisma/client'

export interface BudgetSuggestion {
  category: Category
  suggestedAmount: number
  currentAmount?: number
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
}

export async function generateSmartBudgetSuggestions(
  companyId: string,
  months: number = 6
): Promise<BudgetSuggestion[]> {
  // Get historical transactions
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
  })

  // Calculate average monthly spend by category
  const categorySpend: Record<string, number[]> = {}
  
  for (const txn of transactions) {
    const category = txn.category
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    
    const date = new Date(txn.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    
    if (!categorySpend[category]) {
      categorySpend[category] = []
    }
    
    // Group by month
    const monthIndex = Math.floor((endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30))
    if (monthIndex >= 0 && monthIndex < months) {
      if (!categorySpend[category][monthIndex]) {
        categorySpend[category][monthIndex] = 0
      }
      categorySpend[category][monthIndex] += amount
    }
  }

  // Get current budgets
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

  const currentBudgets = await prisma.budget.findMany({
    where: {
      companyId,
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
  })

  // Generate suggestions
  const suggestions: BudgetSuggestion[] = []
  const allCategories = Object.values(Category)

  for (const category of allCategories) {
    const monthlySpends = categorySpend[category] || []
    
    if (monthlySpends.length === 0) {
      // No historical data - suggest based on category averages or skip
      continue
    }

    // Calculate statistics
    const validSpends = monthlySpends.filter(s => s > 0)
    if (validSpends.length === 0) continue

    const average = validSpends.reduce((sum, s) => sum + s, 0) / validSpends.length
    const max = Math.max(...validSpends)
    const min = Math.min(...validSpends)
    const variance = validSpends.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / validSpends.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = average > 0 ? stdDev / average : 0

    // Suggest budget: use 90th percentile to account for variability
    const sortedSpends = [...validSpends].sort((a, b) => a - b)
    const percentile90 = sortedSpends[Math.floor(sortedSpends.length * 0.9)]
    const suggestedAmount = Math.max(average, percentile90 * 1.1) // Add 10% buffer

    const currentBudget = currentBudgets.find(b => b.category === category)
    const currentAmount = currentBudget 
      ? (typeof currentBudget.amount === 'number' ? currentBudget.amount : parseFloat(String(currentBudget.amount)))
      : undefined

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    if (validSpends.length >= 3 && coefficientOfVariation < 0.3) {
      confidence = 'high'
    } else if (validSpends.length < 2 || coefficientOfVariation > 0.5) {
      confidence = 'low'
    }

    // Generate reasoning
    let reasoning = `Based on ${validSpends.length} month${validSpends.length > 1 ? 's' : ''} of data, `
    reasoning += `average spending is ${formatCurrency(average)}/month. `
    
    if (coefficientOfVariation > 0.3) {
      reasoning += `Spending varies significantly (${(coefficientOfVariation * 100).toFixed(0)}% variation). `
    }
    
    if (currentAmount) {
      const diff = ((suggestedAmount - currentAmount) / currentAmount) * 100
      if (Math.abs(diff) > 10) {
        reasoning += `Suggested budget is ${diff > 0 ? 'higher' : 'lower'} than current by ${Math.abs(diff).toFixed(0)}%. `
      }
    }
    
    reasoning += `Recommended: ${formatCurrency(suggestedAmount)}/month to cover ${confidence === 'high' ? 'expected' : 'most'} spending patterns.`

    suggestions.push({
      category,
      suggestedAmount: Math.round(suggestedAmount),
      currentAmount,
      reasoning,
      confidence,
    })
  }

  return suggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

