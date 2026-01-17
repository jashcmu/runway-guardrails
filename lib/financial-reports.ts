/**
 * Enhanced Financial Reports Module
 * Generates P&L, Balance Sheet, Cash Flow with period comparisons
 * Indian Accounting Standards (Ind AS) compliant
 */

import { prisma } from './prisma'
import { Category } from '@prisma/client'
import { CATEGORY_DISPLAY_NAMES, CATEGORY_GROUPS, getCategoryGroup } from './categorize'

// Enhanced interfaces with comparison support
export interface ProfitLossReport {
  period: string
  startDate: Date
  endDate: Date
  
  revenue: {
    total: number
    byCategory: Record<string, number>
    details: Array<{ date: Date; description: string; amount: number }>
  }
  
  expenses: {
    total: number
    byCategory: Record<string, number>
    byGroup: Record<string, number>
    details: Array<{ date: Date; description: string; amount: number; category: string; group: string }>
  }
  
  grossProfit: number
  netProfit: number
  profitMargin: number
  
  // Period comparison (optional)
  comparison?: {
    previousPeriod: string
    revenue: { current: number; previous: number; change: number; changePercent: number }
    expenses: { current: number; previous: number; change: number; changePercent: number }
    netProfit: { current: number; previous: number; change: number; changePercent: number }
    categoryChanges: Array<{ category: string; current: number; previous: number; changePercent: number }>
  }
}

export interface BalanceSheetReport {
  asOfDate: Date
  
  assets: {
    current: {
      cash: number
      accountsReceivable: number
      otherCurrentAssets: number
      total: number
    }
    fixed: {
      equipment: number
      accumulatedDepreciation: number
      total: number
    }
    total: number
  }
  
  liabilities: {
    current: {
      accountsPayable: number
      deferredRevenue: number
      accruedExpenses: number
      total: number
    }
    longTerm: {
      total: number
    }
    total: number
  }
  
  equity: {
    retainedEarnings: number
    currentPeriodEarnings: number
    total: number
  }
  
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
}

export interface CashFlowReport {
  period: string
  startDate: Date
  endDate: Date
  
  operating: {
    cashFromOperations: number
    cashPaidToSuppliers: number
    cashPaidToEmployees: number
    cashPaidForOther: number
    netCashFromOperating: number
    details: Array<{ category: string; amount: number }>
  }
  
  investing: {
    equipmentPurchases: number
    netCashFromInvesting: number
  }
  
  financing: {
    fundsRaised: number
    loanRepayments: number
    netCashFromFinancing: number
  }
  
  netCashChange: number
  openingCash: number
  closingCash: number
}

export interface FinancialReportPackage {
  profitLoss: ProfitLossReport
  balanceSheet: BalanceSheetReport
  cashFlow: CashFlowReport
  generatedAt: Date
  companyName: string
  currency: string
  period: { start: Date; end: Date }
}

/**
 * Generate Profit & Loss Statement with all categories
 */
export async function generateProfitLoss(
  companyId: string,
  startDate: Date,
  endDate: Date,
  includeComparison: boolean = true
): Promise<ProfitLossReport> {
  // Get all transactions in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  // Get invoices (revenue)
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      invoiceDate: { gte: startDate, lte: endDate },
      status: { in: ['paid', 'partial'] },
    },
  })

  // Calculate Revenue
  const revenueTotal = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
  const revenueDetails = invoices.map(inv => ({
    date: inv.invoiceDate,
    description: `Invoice ${inv.invoiceNumber} - ${inv.customerName}`,
    amount: inv.paidAmount || 0,
  }))

  // Calculate Expenses by Category (supporting all new categories)
  const expenses = transactions.filter(t => t.amount < 0)
  const expenseTotal = Math.abs(expenses.reduce((sum, exp) => sum + exp.amount, 0))

  // Initialize all categories
  const expensesByCategory: Record<string, number> = {}
  const expensesByGroup: Record<string, number> = {}
  
  for (const cat of Object.values(Category)) {
    expensesByCategory[cat] = 0
  }

  const expenseDetails = expenses.map(exp => {
    const amount = Math.abs(exp.amount)
    const category = exp.category
    const group = getCategoryGroup(category)
    
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount
    expensesByGroup[group] = (expensesByGroup[group] || 0) + amount
    
    return {
      date: exp.date,
      description: exp.description || 'Expense',
      amount,
      category,
      group,
    }
  })

  // Calculate Profit
  const grossProfit = revenueTotal - expenseTotal
  const netProfit = grossProfit
  const profitMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0

  // Generate comparison with previous period if requested
  let comparison = undefined
  if (includeComparison) {
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDate = new Date(prevEndDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodDays + 1)
    
    const prevReport = await generateProfitLossBasic(companyId, prevStartDate, prevEndDate)
    
    if (prevReport) {
      const categoryChanges: Array<{ category: string; current: number; previous: number; changePercent: number }> = []
      
      for (const cat of Object.keys(expensesByCategory)) {
        const current = expensesByCategory[cat] || 0
        const previous = prevReport.expensesByCategory[cat] || 0
        if (current > 0 || previous > 0) {
          categoryChanges.push({
            category: cat,
            current,
            previous,
            changePercent: previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0)
          })
        }
      }
      
      comparison = {
        previousPeriod: `${prevStartDate.toISOString().split('T')[0]} to ${prevEndDate.toISOString().split('T')[0]}`,
        revenue: {
          current: revenueTotal,
          previous: prevReport.revenueTotal,
          change: revenueTotal - prevReport.revenueTotal,
          changePercent: prevReport.revenueTotal > 0 ? ((revenueTotal - prevReport.revenueTotal) / prevReport.revenueTotal) * 100 : 0
        },
        expenses: {
          current: expenseTotal,
          previous: prevReport.expenseTotal,
          change: expenseTotal - prevReport.expenseTotal,
          changePercent: prevReport.expenseTotal > 0 ? ((expenseTotal - prevReport.expenseTotal) / prevReport.expenseTotal) * 100 : 0
        },
        netProfit: {
          current: netProfit,
          previous: prevReport.netProfit,
          change: netProfit - prevReport.netProfit,
          changePercent: prevReport.netProfit !== 0 ? ((netProfit - prevReport.netProfit) / Math.abs(prevReport.netProfit)) * 100 : 0
        },
        categoryChanges: categoryChanges.sort((a, b) => b.current - a.current)
      }
    }
  }

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    startDate,
    endDate,
    revenue: {
      total: revenueTotal,
      byCategory: { Sales: revenueTotal },
      details: revenueDetails,
    },
    expenses: {
      total: expenseTotal,
      byCategory: expensesByCategory,
      byGroup: expensesByGroup,
      details: expenseDetails,
    },
    grossProfit,
    netProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    comparison
  }
}

/**
 * Basic P&L for comparison (no recursion)
 */
async function generateProfitLossBasic(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{ revenueTotal: number; expenseTotal: number; netProfit: number; expensesByCategory: Record<string, number> } | null> {
  try {
    const [transactions, invoices] = await Promise.all([
      prisma.transaction.findMany({
        where: { companyId, date: { gte: startDate, lte: endDate } },
      }),
      prisma.invoice.findMany({
        where: {
          companyId,
          invoiceDate: { gte: startDate, lte: endDate },
          status: { in: ['paid', 'partial'] },
        },
      })
    ])

    const revenueTotal = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
    const expenses = transactions.filter(t => t.amount < 0)
    const expenseTotal = Math.abs(expenses.reduce((sum, exp) => sum + exp.amount, 0))
    
    const expensesByCategory: Record<string, number> = {}
    for (const exp of expenses) {
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Math.abs(exp.amount)
    }

    return {
      revenueTotal,
      expenseTotal,
      netProfit: revenueTotal - expenseTotal,
      expensesByCategory
    }
  } catch {
    return null
  }
}

/**
 * Generate Balance Sheet
 */
export async function generateBalanceSheet(
  companyId: string,
  asOfDate: Date
): Promise<BalanceSheetReport> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  const cashBalance = company?.cashBalance || 0

  // Accounts Receivable
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['sent', 'partial', 'overdue'] },
      invoiceDate: { lte: asOfDate },
    },
  })

  const accountsReceivable = unpaidInvoices.reduce(
    (sum, inv) => sum + ((inv.balanceAmount !== null && inv.balanceAmount !== undefined) 
      ? inv.balanceAmount 
      : (inv.totalAmount - (inv.paidAmount || 0))),
    0
  )

  // Accounts Payable
  const unpaidBills = await prisma.bill.findMany({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
      billDate: { lte: asOfDate },
    },
  })

  const accountsPayable = unpaidBills.reduce((sum, bill) => sum + bill.balanceAmount, 0)

  // Deferred Revenue
  const subscriptions = await prisma.subscription.findMany({
    where: { companyId, status: 'active' },
  })

  const deferredRevenue = subscriptions.reduce((sum, sub) => sum + sub.deferredRevenue, 0)

  // Calculate Retained Earnings
  const [allInvoices, allExpenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['paid', 'partial'] },
        invoiceDate: { lte: asOfDate },
      },
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        amount: { lt: 0 },
        date: { lte: asOfDate },
      },
    })
  ])

  const totalRevenue = allInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
  const totalExpenses = Math.abs(allExpenses.reduce((sum, exp) => sum + exp.amount, 0))
  const retainedEarnings = totalRevenue - totalExpenses

  // Calculate current period earnings
  const currentMonthStart = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1)
  const currentPeriodEarnings = await calculatePeriodEarnings(companyId, currentMonthStart, asOfDate)

  // Assemble Balance Sheet
  const currentAssets = cashBalance + accountsReceivable
  const totalAssets = currentAssets

  const currentLiabilities = accountsPayable + deferredRevenue
  const totalLiabilities = currentLiabilities

  const equity = retainedEarnings
  const totalLiabilitiesAndEquity = totalLiabilities + equity

  return {
    asOfDate,
    assets: {
      current: {
        cash: cashBalance,
        accountsReceivable,
        otherCurrentAssets: 0,
        total: currentAssets,
      },
      fixed: {
        equipment: 0,
        accumulatedDepreciation: 0,
        total: 0,
      },
      total: totalAssets,
    },
    liabilities: {
      current: {
        accountsPayable,
        deferredRevenue,
        accruedExpenses: 0,
        total: currentLiabilities,
      },
      longTerm: { total: 0 },
      total: totalLiabilities,
    },
    equity: {
      retainedEarnings: retainedEarnings - currentPeriodEarnings,
      currentPeriodEarnings,
      total: equity,
    },
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
  }
}

async function calculatePeriodEarnings(companyId: string, startDate: Date, endDate: Date): Promise<number> {
  const [invoices, transactions] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { in: ['paid', 'partial'] },
      },
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
      },
    })
  ])

  const revenue = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
  const expenses = Math.abs(transactions.reduce((sum, t) => sum + t.amount, 0))
  return revenue - expenses
}

/**
 * Generate Cash Flow Statement with all new categories
 */
export async function generateCashFlow(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowReport> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  // Group expenses by category for detailed breakdown
  const expensesByCategory: Record<string, number> = {}
  
  // Personnel categories (employees)
  const employeeCategories: Category[] = [Category.Hiring, Category.Salaries, Category.Benefits, Category.Training]
  
  // Operating categories (suppliers)
  const supplierCategories: Category[] = [
    Category.SaaS, Category.Cloud, Category.Marketing, Category.Rent, Category.Utilities,
    Category.OfficeSupplies, Category.Equipment, Category.Maintenance, Category.Legal,
    Category.Accounting, Category.Consulting, Category.ProfessionalServices,
    Category.Travel, Category.Meals, Category.Entertainment, Category.Advertising,
    Category.Sales, Category.Events, Category.CustomerSupport, Category.Subscriptions
  ]
  
  // Operating Activities
  const cashFromCustomers = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  let cashPaidToSuppliers = 0
  let cashPaidToEmployees = 0
  let cashPaidForOther = 0

  for (const t of transactions) {
    if (t.amount >= 0) continue
    
    const amount = Math.abs(t.amount)
    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + amount
    
    if (employeeCategories.includes(t.category)) {
      cashPaidToEmployees += amount
    } else if (supplierCategories.includes(t.category)) {
      cashPaidToSuppliers += amount
    } else {
      cashPaidForOther += amount
    }
  }

  const netCashFromOperating = cashFromCustomers - cashPaidToSuppliers - cashPaidToEmployees - cashPaidForOther

  // Equipment purchases (investing)
  const equipmentPurchases = (expensesByCategory[Category.Hardware] || 0) + (expensesByCategory[Category.Equipment] || 0)
  const netCashFromInvesting = -equipmentPurchases

  // Financing (from fundraising rounds if any)
  const fundraisingRounds = await prisma.fundraisingRound.findMany({
    where: {
      companyId,
      closingDate: { gte: startDate, lte: endDate },
    },
  })
  const fundsRaised = fundraisingRounds.reduce((sum, round) => sum + round.amountRaised, 0)
  const netCashFromFinancing = fundsRaised

  const netCashChange = netCashFromOperating + netCashFromInvesting + netCashFromFinancing
  const closingCash = company?.cashBalance || 0
  const openingCash = closingCash - netCashChange

  // Build details array
  const details = Object.entries(expensesByCategory)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    startDate,
    endDate,
    operating: {
      cashFromOperations: cashFromCustomers,
      cashPaidToSuppliers,
      cashPaidToEmployees,
      cashPaidForOther,
      netCashFromOperating,
      details,
    },
    investing: {
      equipmentPurchases,
      netCashFromInvesting,
    },
    financing: {
      fundsRaised,
      loanRepayments: 0,
      netCashFromFinancing,
    },
    netCashChange,
    openingCash,
    closingCash,
  }
}

/**
 * Generate comprehensive Financial Report Package
 */
export async function generateFinancialReportPackage(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<FinancialReportPackage> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  const [profitLoss, balanceSheet, cashFlow] = await Promise.all([
    generateProfitLoss(companyId, startDate, endDate, true),
    generateBalanceSheet(companyId, endDate),
    generateCashFlow(companyId, startDate, endDate),
  ])

  return {
    profitLoss,
    balanceSheet,
    cashFlow,
    generatedAt: new Date(),
    companyName: company?.name || 'Unknown',
    currency: 'INR',
    period: { start: startDate, end: endDate }
  }
}

/**
 * Generate custom report with specific metrics
 */
export async function generateCustomReport(
  companyId: string,
  options: {
    startDate: Date
    endDate: Date
    metrics: string[]
    groupBy?: 'category' | 'vendor' | 'month'
    categories?: Category[]
  }
): Promise<Record<string, any>> {
  const { startDate, endDate, metrics, groupBy, categories } = options
  
  const result: Record<string, any> = {
    period: { start: startDate, end: endDate },
    generatedAt: new Date(),
  }
  
  // Get transactions
  const whereClause: any = {
    companyId,
    date: { gte: startDate, lte: endDate },
  }
  
  if (categories && categories.length > 0) {
    whereClause.category = { in: categories }
  }
  
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
  })
  
  // Calculate requested metrics
  for (const metric of metrics) {
    switch (metric) {
      case 'total_spend':
        result.totalSpend = Math.abs(
          transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
        )
        break
      
      case 'total_revenue':
        result.totalRevenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
        break
      
      case 'transaction_count':
        result.transactionCount = transactions.length
        break
      
      case 'by_category':
        const byCategory: Record<string, number> = {}
        for (const t of transactions) {
          if (t.amount < 0) {
            byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount)
          }
        }
        result.byCategory = byCategory
        break
      
      case 'by_vendor':
        const byVendor: Record<string, number> = {}
        for (const t of transactions) {
          if (t.amount < 0) {
            const vendor = t.vendorName || 'Unknown'
            byVendor[vendor] = (byVendor[vendor] || 0) + Math.abs(t.amount)
          }
        }
        result.byVendor = Object.fromEntries(
          Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 20)
        )
        break
      
      case 'by_month':
        const byMonth: Record<string, { spend: number; revenue: number }> = {}
        for (const t of transactions) {
          const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
          if (!byMonth[monthKey]) {
            byMonth[monthKey] = { spend: 0, revenue: 0 }
          }
          if (t.amount < 0) {
            byMonth[monthKey].spend += Math.abs(t.amount)
          } else {
            byMonth[monthKey].revenue += t.amount
          }
        }
        result.byMonth = byMonth
        break
    }
  }
  
  return result
}
