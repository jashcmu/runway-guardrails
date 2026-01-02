import { PrismaClient, Category } from '@prisma/client'

const prisma = new PrismaClient()

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
    hiring: number
    marketing: number
    saas: number
    cloud: number
    g_a: number
    details: Array<{ date: Date; description: string; amount: number; category: string }>
  }
  
  grossProfit: number
  netProfit: number
  profitMargin: number // %
}

export interface BalanceSheetReport {
  asOfDate: Date
  
  assets: {
    current: {
      cash: number
      accountsReceivable: number
      total: number
    }
    total: number
  }
  
  liabilities: {
    current: {
      accountsPayable: number
      deferredRevenue: number
      total: number
    }
    total: number
  }
  
  equity: {
    retainedEarnings: number
    total: number
  }
  
  totalLiabilitiesAndEquity: number
}

export interface CashFlowReport {
  period: string
  startDate: Date
  endDate: Date
  
  operating: {
    cashFromOperations: number
    cashPaidToSuppliers: number
    cashPaidToEmployees: number
    netCashFromOperating: number
  }
  
  investing: {
    netCashFromInvesting: number
  }
  
  financing: {
    netCashFromFinancing: number
  }
  
  netCashChange: number
  openingCash: number
  closingCash: number
}

/**
 * Generate Profit & Loss Statement (Income Statement)
 * Indian Accounting Standard compliant
 */
export async function generateProfitLoss(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<ProfitLossReport> {
  // Get all transactions in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  })

  // Get invoices (revenue)
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      invoiceDate: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ['paid', 'partial'] }, // Only recognized revenue
    },
  })

  // Calculate Revenue
  const revenueTotal = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
  const revenueDetails = invoices.map(inv => ({
    date: inv.invoiceDate,
    description: `Invoice ${inv.invoiceNumber} - ${inv.customerName}`,
    amount: inv.paidAmount || 0,
  }))

  // Calculate Expenses by Category
  const expenses = transactions.filter(t => t.amount < 0)
  const expenseTotal = Math.abs(expenses.reduce((sum, exp) => sum + exp.amount, 0))

  const expensesByCategory: Record<string, number> = {
    Hiring: 0,
    Marketing: 0,
    SaaS: 0,
    Cloud: 0,
    G_A: 0,
  }

  const expenseDetails = expenses.map(exp => {
    const amount = Math.abs(exp.amount)
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + amount
    return {
      date: exp.date,
      description: exp.description || 'Expense',
      amount,
      category: exp.category,
    }
  })

  // Calculate Profit
  const grossProfit = revenueTotal - expenseTotal
  const netProfit = grossProfit // For now, no other income/expenses
  const profitMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0

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
      hiring: expensesByCategory.Hiring || 0,
      marketing: expensesByCategory.Marketing || 0,
      saas: expensesByCategory.SaaS || 0,
      cloud: expensesByCategory.Cloud || 0,
      g_a: expensesByCategory.G_A || 0,
      details: expenseDetails,
    },
    grossProfit,
    netProfit,
    profitMargin,
  }
}

/**
 * Generate Balance Sheet
 * Indian Accounting Standard compliant
 */
export async function generateBalanceSheet(
  companyId: string,
  asOfDate: Date
): Promise<BalanceSheetReport> {
  // Get company
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  const cashBalance = company?.cashBalance || 0

  // Calculate Accounts Receivable (AR) - Unpaid invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['sent', 'partial', 'overdue'] },
      invoiceDate: { lte: asOfDate },
    },
  })

  const accountsReceivable = unpaidInvoices.reduce(
    (sum, inv) => sum + ((inv.balanceAmount !== null && inv.balanceAmount !== undefined) ? inv.balanceAmount : (inv.totalAmount - (inv.paidAmount || 0))),
    0
  )

  // Calculate Accounts Payable (AP) - Unpaid bills
  const unpaidBills = await prisma.bill.findMany({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
      billDate: { lte: asOfDate },
    },
  })

  const accountsPayable = unpaidBills.reduce(
    (sum, bill) => sum + bill.balanceAmount,
    0
  )

  // Calculate Deferred Revenue (from subscriptions)
  const subscriptions = await prisma.subscription.findMany({
    where: {
      companyId,
      status: 'active',
    },
  })

  const deferredRevenue = subscriptions.reduce(
    (sum, sub) => sum + sub.deferredRevenue,
    0
  )

  // Calculate Retained Earnings (cumulative profit/loss)
  const allTimeRevenue = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['paid', 'partial'] },
      invoiceDate: { lte: asOfDate },
    },
  })

  const totalRevenue = allTimeRevenue.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)

  const allTimeExpenses = await prisma.transaction.findMany({
    where: {
      companyId,
      amount: { lt: 0 },
      date: { lte: asOfDate },
    },
  })

  const totalExpenses = Math.abs(allTimeExpenses.reduce((sum, exp) => sum + exp.amount, 0))

  const retainedEarnings = totalRevenue - totalExpenses

  // Assemble Balance Sheet
  const currentAssets = cashBalance + accountsReceivable
  const totalAssets = currentAssets

  const currentLiabilities = accountsPayable + deferredRevenue
  const totalLiabilities = currentLiabilities

  const equity = retainedEarnings

  return {
    asOfDate,
    assets: {
      current: {
        cash: cashBalance,
        accountsReceivable,
        total: currentAssets,
      },
      total: totalAssets,
    },
    liabilities: {
      current: {
        accountsPayable,
        deferredRevenue,
        total: currentLiabilities,
      },
      total: totalLiabilities,
    },
    equity: {
      retainedEarnings: equity,
      total: equity,
    },
    totalLiabilitiesAndEquity: totalLiabilities + equity,
  }
}

/**
 * Generate Cash Flow Statement
 */
export async function generateCashFlow(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowReport> {
  // Get opening cash balance
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  // Get all transactions in period
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  })

  // Operating Activities
  const cashFromCustomers = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const cashPaidToSuppliers = Math.abs(
    transactions
      .filter(t => t.amount < 0 && (t.category === Category.SaaS || t.category === Category.Cloud || t.category === Category.Marketing || t.category === Category.G_A))
      .reduce((sum, t) => sum + t.amount, 0)
  )

  const cashPaidToEmployees = Math.abs(
    transactions
      .filter(t => t.amount < 0 && t.category === Category.Hiring)
      .reduce((sum, t) => sum + t.amount, 0)
  )

  const netCashFromOperating = cashFromCustomers - cashPaidToSuppliers - cashPaidToEmployees

  // For now, no investing or financing activities
  const netCashFromInvesting = 0
  const netCashFromFinancing = 0

  const netCashChange = netCashFromOperating + netCashFromInvesting + netCashFromFinancing
  const closingCash = company?.cashBalance || 0
  const openingCash = closingCash - netCashChange

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    startDate,
    endDate,
    operating: {
      cashFromOperations: cashFromCustomers,
      cashPaidToSuppliers,
      cashPaidToEmployees,
      netCashFromOperating,
    },
    investing: {
      netCashFromInvesting,
    },
    financing: {
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
): Promise<{
  profitLoss: ProfitLossReport
  balanceSheet: BalanceSheetReport
  cashFlow: CashFlowReport
  generatedAt: Date
}> {
  const [profitLoss, balanceSheet, cashFlow] = await Promise.all([
    generateProfitLoss(companyId, startDate, endDate),
    generateBalanceSheet(companyId, endDate),
    generateCashFlow(companyId, startDate, endDate),
  ])

  return {
    profitLoss,
    balanceSheet,
    cashFlow,
    generatedAt: new Date(),
  }
}



