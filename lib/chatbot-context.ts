import { prisma } from './prisma'
import { getMonthlyBurnForCompany, getRunwayForCompany } from './calculations'
import { Category } from '@prisma/client'

export interface FinancialContext {
  cashBalance: number
  monthlyBurn: number
  runway: number | null
  budgets: Array<{
    category: string
    amount: number
    startDate: string
    endDate: string
  }>
  recentTransactions: Array<{
    date: string
    amount: number
    category: string
    description: string | null
  }>
  categorySpend: Record<string, number>
}

export async function buildFinancialContext(
  companyId: string,
  cashBalance: number
): Promise<FinancialContext> {
  // Get monthly burn and runway
  const monthlyBurn = await getMonthlyBurnForCompany(companyId)
  const runway = await getRunwayForCompany(companyId, cashBalance)

  // Get active budgets
  const now = new Date()
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

  // Get recent transactions (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })

  // Calculate category spend for current month
  const categorySpend: Record<string, number> = {}
  const allTransactions = await prisma.transaction.findMany({
    where: { companyId },
    select: { date: true, amount: true, category: true },
  })

  for (const transaction of allTransactions) {
    const date = new Date(transaction.date)
    if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
      const category = transaction.category
      const amount = typeof transaction.amount === 'number'
        ? transaction.amount
        : parseFloat(String(transaction.amount))
      categorySpend[category] = (categorySpend[category] || 0) + amount
    }
  }

  return {
    cashBalance,
    monthlyBurn,
    runway: runway === Infinity ? null : runway,
    budgets: budgets.map(b => ({
      category: b.category,
      amount: typeof b.amount === 'number' ? b.amount : parseFloat(String(b.amount)),
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
    })),
    recentTransactions: transactions.map(t => ({
      date: t.date.toISOString(),
      amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)),
      category: t.category,
      description: t.description,
    })),
    categorySpend,
  }
}

export function formatContextForPrompt(context: FinancialContext): string {
  const runwayText = context.runway === null ? 'infinite' : `${context.runway.toFixed(1)} months`
  
  return `Financial Context for Company:
- Cash Balance: ₹${context.cashBalance.toLocaleString('en-IN')}
- Monthly Burn Rate: ₹${context.monthlyBurn.toLocaleString('en-IN')}
- Runway: ${runwayText}

Active Budgets:
${context.budgets.length === 0 ? 'No active budgets set.' : context.budgets.map(b => 
  `- ${b.category}: ₹${b.amount.toLocaleString('en-IN')} (${new Date(b.startDate).toLocaleDateString()} to ${new Date(b.endDate).toLocaleDateString()})`
).join('\n')}

Current Month Spending by Category:
${Object.entries(context.categorySpend).map(([cat, amount]) => 
  `- ${cat}: ₹${amount.toLocaleString('en-IN')}`
).join('\n') || 'No spending this month.'}

Recent Transactions (last 30 days):
${context.recentTransactions.slice(0, 10).map(t => 
  `- ${new Date(t.date).toLocaleDateString()}: ₹${t.amount.toLocaleString('en-IN')} - ${t.category}${t.description ? ` (${t.description})` : ''}`
).join('\n') || 'No recent transactions.'}`
}

