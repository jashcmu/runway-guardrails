import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const reportType = searchParams.get('type') || 'pl' // pl, cashflow, gst, tds

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam ? new Date(startDateParam) : new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    switch (reportType) {
      case 'pl':
        return generatePLReport(companyId, startDate, endDate)
      case 'cashflow':
        return generateCashFlowReport(companyId, startDate, endDate)
      case 'gst':
        return generateGSTReport(companyId, startDate, endDate)
      case 'tds':
        return generateTDSReport(companyId, startDate, endDate)
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

async function generatePLReport(companyId: string, startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
  })

  const expensesByCategory: Record<string, number> = {}
  let totalExpenses = 0

  for (const txn of transactions) {
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    const category = txn.category
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount
    totalExpenses += amount
  }

  return NextResponse.json({
    type: 'profit_loss',
    period: { startDate, endDate },
    expenses: {
      byCategory: expensesByCategory,
      total: totalExpenses,
    },
    // Revenue would come from invoices or separate revenue transactions
    revenue: 0,
    netIncome: -totalExpenses,
  })
}

async function generateCashFlowReport(companyId: string, startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  const dailyFlows: Array<{ date: string; amount: number; balance: number }> = []
  let runningBalance = 0

  for (const txn of transactions) {
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    runningBalance -= amount // Expenses reduce balance
    
    dailyFlows.push({
      date: txn.date.toISOString().split('T')[0],
      amount: -amount,
      balance: runningBalance,
    })
  }

  return NextResponse.json({
    type: 'cash_flow',
    period: { startDate, endDate },
    dailyFlows,
    totalOutflow: Math.abs(runningBalance),
  })
}

async function generateGSTReport(companyId: string, startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
      gstRate: { not: null },
    },
  })

  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0
  let totalGST = 0

  for (const txn of transactions) {
    if (txn.gstAmount) {
      const gstAmount = typeof txn.gstAmount === 'number' ? txn.gstAmount : parseFloat(String(txn.gstAmount))
      totalGST += gstAmount
      
      if (txn.cgst) {
        const cgst = typeof txn.cgst === 'number' ? txn.cgst : parseFloat(String(txn.cgst))
        totalCGST += cgst
      }
      if (txn.sgst) {
        const sgst = typeof txn.sgst === 'number' ? txn.sgst : parseFloat(String(txn.sgst))
        totalSGST += sgst
      }
      if (txn.igst) {
        const igst = typeof txn.igst === 'number' ? txn.igst : parseFloat(String(txn.igst))
        totalIGST += igst
      }
    }
  }

  return NextResponse.json({
    type: 'gst',
    period: { startDate, endDate },
    summary: {
      totalCGST,
      totalSGST,
      totalIGST,
      totalGST,
    },
    transactionCount: transactions.length,
  })
}

async function generateTDSReport(companyId: string, startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
      tdsAmount: { not: null },
    },
  })

  let totalTDS = 0

  for (const txn of transactions) {
    if (txn.tdsAmount) {
      const tds = typeof txn.tdsAmount === 'number' ? txn.tdsAmount : parseFloat(String(txn.tdsAmount))
      totalTDS += tds
    }
  }

  return NextResponse.json({
    type: 'tds',
    period: { startDate, endDate },
    totalTDS,
    transactionCount: transactions.length,
  })
}

