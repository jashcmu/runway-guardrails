import { NextRequest, NextResponse } from 'next/server'
import { calculateTrialBalance } from '@/lib/accounting/trial-balance'
import { getAccountsByType } from '@/lib/accounting/chart-of-accounts'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const reportType = searchParams.get('type') // balance-sheet, pl, trial-balance
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1) // Jan 1
    const end = endDate ? new Date(endDate) : new Date()

    switch (reportType) {
      case 'balance-sheet':
        return await generateBalanceSheet(companyId, end)
      case 'pl':
        return await generateProfitAndLoss(companyId, start, end)
      case 'trial-balance':
        return await generateTrialBalance(companyId, end)
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function generateBalanceSheet(companyId: string, asOfDate: Date) {
  // Get accounts by type
  const [assets, liabilities, equity] = await Promise.all([
    getAccountsByType(companyId, 'Asset'),
    getAccountsByType(companyId, 'Liability'),
    getAccountsByType(companyId, 'Equity'),
  ])

  // Group assets by subtype
  const currentAssets = assets.filter((a) => a.subtype === 'Current Asset')
  const fixedAssets = assets.filter((a) => a.subtype === 'Fixed Asset')

  // Group liabilities
  const currentLiabilities = liabilities.filter((l) => l.subtype === 'Current Liability')
  const longTermLiabilities = liabilities.filter((l) => l.subtype === 'Long-term Liability')

  // Calculate totals
  const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.balance, 0)
  const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + a.balance, 0)
  const totalAssets = totalCurrentAssets + totalFixedAssets

  const totalCurrentLiabilities = currentLiabilities.reduce((sum, l) => sum + l.balance, 0)
  const totalLongTermLiabilities = longTermLiabilities.reduce((sum, l) => sum + l.balance, 0)
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

  const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0)

  return NextResponse.json({
    type: 'balance_sheet',
    asOfDate,
    assets: {
      currentAssets: {
        accounts: currentAssets.map((a) => ({ code: a.accountCode, name: a.name, balance: a.balance })),
        total: totalCurrentAssets,
      },
      fixedAssets: {
        accounts: fixedAssets.map((a) => ({ code: a.accountCode, name: a.name, balance: a.balance })),
        total: totalFixedAssets,
      },
      total: totalAssets,
    },
    liabilities: {
      currentLiabilities: {
        accounts: currentLiabilities.map((l) => ({ code: l.accountCode, name: l.name, balance: l.balance })),
        total: totalCurrentLiabilities,
      },
      longTermLiabilities: {
        accounts: longTermLiabilities.map((l) => ({ code: l.accountCode, name: l.name, balance: l.balance })),
        total: totalLongTermLiabilities,
      },
      total: totalLiabilities,
    },
    equity: {
      accounts: equity.map((e) => ({ code: e.accountCode, name: e.name, balance: e.balance })),
      total: totalEquity,
    },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  })
}

async function generateProfitAndLoss(companyId: string, startDate: Date, endDate: Date) {
  // Get journal entries for the period
  const [revenueAccounts, expenseAccounts] = await Promise.all([
    getAccountsByType(companyId, 'Revenue'),
    getAccountsByType(companyId, 'Expense'),
  ])

  // Get journal entries in period
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      account: true,
    },
  })

  // Calculate revenue and expenses from journal entries
  const revenueByAccount = new Map<string, number>()
  const expenseByAccount = new Map<string, number>()

  for (const entry of journalEntries) {
    if (entry.account.type === 'Revenue') {
      const current = revenueByAccount.get(entry.accountId) || 0
      revenueByAccount.set(entry.accountId, current + entry.credit - entry.debit)
    } else if (entry.account.type === 'Expense') {
      const current = expenseByAccount.get(entry.accountId) || 0
      expenseByAccount.set(entry.accountId, current + entry.debit - entry.credit)
    }
  }

  // Build revenue breakdown
  const revenueBreakdown = revenueAccounts.map((acc) => ({
    code: acc.accountCode,
    name: acc.name,
    amount: revenueByAccount.get(acc.id) || 0,
  })).filter(r => r.amount > 0)

  const totalRevenue = revenueBreakdown.reduce((sum, r) => sum + r.amount, 0)

  // Build expense breakdown by category
  const expenseBreakdown = expenseAccounts.map((acc) => ({
    code: acc.accountCode,
    name: acc.name,
    category: acc.category,
    amount: expenseByAccount.get(acc.id) || 0,
  })).filter(e => e.amount > 0)

  const totalExpenses = expenseBreakdown.reduce((sum, e) => sum + e.amount, 0)

  const grossProfit = totalRevenue - totalExpenses
  const netProfit = grossProfit // Simplified (same as gross for now)

  return NextResponse.json({
    type: 'profit_loss',
    period: { startDate, endDate },
    revenue: {
      breakdown: revenueBreakdown,
      total: totalRevenue,
    },
    expenses: {
      breakdown: expenseBreakdown,
      total: totalExpenses,
    },
    grossProfit,
    ebitda: grossProfit, // Simplified
    netProfit,
  })
}

async function generateTrialBalance(companyId: string, asOfDate: Date) {
  const result = await calculateTrialBalance(companyId, asOfDate)

  return NextResponse.json({
    type: 'trial_balance',
    ...result,
  })
}




