import { prisma } from './prisma'

export interface ReportSchedule {
  companyId: string
  reportType: 'pl' | 'cashflow' | 'gst' | 'tds'
  frequency: 'weekly' | 'monthly' | 'quarterly'
  dayOfWeek?: number // 0-6 for weekly
  dayOfMonth?: number // 1-31 for monthly
}

export async function generateScheduledReport(schedule: ReportSchedule): Promise<any> {
  const now = new Date()
  let startDate: Date
  let endDate: Date = now

  switch (schedule.frequency) {
    case 'weekly':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
      break
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Call the reports API logic
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId: schedule.companyId,
      date: { gte: startDate, lte: endDate },
    },
  })

  switch (schedule.reportType) {
    case 'pl':
      return generatePLReportData(transactions, startDate, endDate)
    case 'cashflow':
      return generateCashFlowReportData(transactions, startDate, endDate)
    case 'gst':
      return generateGSTReportData(transactions, startDate, endDate)
    case 'tds':
      return generateTDSReportData(transactions, startDate, endDate)
    default:
      throw new Error('Invalid report type')
  }
}

function generatePLReportData(transactions: any[], startDate: Date, endDate: Date) {
  const expensesByCategory: Record<string, number> = {}
  let totalExpenses = 0

  for (const txn of transactions) {
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    const category = txn.category
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount
    totalExpenses += amount
  }

  return {
    type: 'profit_loss',
    period: { startDate, endDate },
    expenses: {
      byCategory: expensesByCategory,
      total: totalExpenses,
    },
    revenue: 0,
    netIncome: -totalExpenses,
  }
}

function generateCashFlowReportData(transactions: any[], startDate: Date, endDate: Date) {
  const dailyFlows: Array<{ date: string; amount: number; balance: number }> = []
  let runningBalance = 0

  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const txn of sortedTransactions) {
    const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount))
    runningBalance -= amount
    
    dailyFlows.push({
      date: new Date(txn.date).toISOString().split('T')[0],
      amount: -amount,
      balance: runningBalance,
    })
  }

  return {
    type: 'cash_flow',
    period: { startDate, endDate },
    dailyFlows,
    totalOutflow: Math.abs(runningBalance),
  }
}

function generateGSTReportData(transactions: any[], startDate: Date, endDate: Date) {
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

  return {
    type: 'gst',
    period: { startDate, endDate },
    summary: {
      totalCGST,
      totalSGST,
      totalIGST,
      totalGST,
    },
    transactionCount: transactions.length,
  }
}

function generateTDSReportData(transactions: any[], startDate: Date, endDate: Date) {
  let totalTDS = 0

  for (const txn of transactions) {
    if (txn.tdsAmount) {
      const tds = typeof txn.tdsAmount === 'number' ? txn.tdsAmount : parseFloat(String(txn.tdsAmount))
      totalTDS += tds
    }
  }

  return {
    type: 'tds',
    period: { startDate, endDate },
    totalTDS,
    transactionCount: transactions.length,
  }
}

