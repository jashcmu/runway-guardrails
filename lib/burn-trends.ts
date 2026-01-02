import { Transaction } from '@prisma/client'
import { prisma } from './prisma'

type MonthlyBurnData = {
  month: string
  burn: number
  transactionCount: number
}

type BurnTrend = {
  current: number
  previous: number
  trend: 'increasing' | 'decreasing' | 'stable'
  acceleration: number // Percentage change
  months: MonthlyBurnData[]
}

/**
 * Calculate burn trend over time to detect acceleration or deceleration.
 * Shows whether spending is increasing, stabilizing, or decreasing.
 */
export async function getBurnTrend(companyId: string): Promise<BurnTrend> {
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      date: true,
      amount: true,
    },
    orderBy: {
      date: 'asc',
    },
  })

  // Group by month
  const monthlyTotals = new Map<string, { total: number; count: number }>()

  for (const transaction of transactions) {
    const date = new Date(transaction.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    const amount = typeof transaction.amount === 'number'
      ? transaction.amount
      : parseFloat(String(transaction.amount))
    
    const current = monthlyTotals.get(monthKey) || { total: 0, count: 0 }
    monthlyTotals.set(monthKey, {
      total: current.total + amount,
      count: current.count + 1,
    })
  }

  // Convert to array and sort
  const months: MonthlyBurnData[] = Array.from(monthlyTotals.entries())
    .map(([month, data]) => ({
      month,
      burn: data.total,
      transactionCount: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  if (months.length === 0) {
    return {
      current: 0,
      previous: 0,
      trend: 'stable',
      acceleration: 0,
      months: [],
    }
  }

  const current = months[months.length - 1]?.burn || 0
  const previous = months.length >= 2 ? months[months.length - 2]?.burn || 0 : current

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  let acceleration = 0

  if (previous > 0) {
    acceleration = ((current - previous) / previous) * 100
    
    if (acceleration > 5) {
      trend = 'increasing'
    } else if (acceleration < -5) {
      trend = 'decreasing'
    } else {
      trend = 'stable'
    }
  } else if (current > 0) {
    trend = 'increasing'
    acceleration = 100
  }

  return {
    current,
    previous,
    trend,
    acceleration: Math.round(acceleration * 10) / 10,
    months: months.slice(-6), // Last 6 months
  }
}

