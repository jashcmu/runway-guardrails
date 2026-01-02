import { Category, Transaction, Budget } from '@prisma/client'
import { prisma } from './prisma'
import { calculateMonthlyBurn, calculateRunway } from './calculations'

type TransactionWithAmount = Pick<Transaction, 'date' | 'amount' | 'category'>

/**
 * Get month-to-date spend per category for the current month.
 */
function getMonthToDateSpendByCategory(
  transactions: TransactionWithAmount[],
  year: number,
  month: number
): Map<Category, number> {
  const spendByCategory = new Map<Category, number>()

  for (const transaction of transactions) {
    const date = new Date(transaction.date)
    if (date.getFullYear() === year && date.getMonth() === month) {
      const amount = typeof transaction.amount === 'number'
        ? transaction.amount
        : parseFloat(String(transaction.amount))

      const current = spendByCategory.get(transaction.category) || 0
      spendByCategory.set(transaction.category, current + amount)
    }
  }

  return spendByCategory
}

/**
 * Calculate runway impact: before and after budget overrun.
 * Projects monthly overrun based on current spending rate.
 */
async function calculateRunwayImpact(
  companyId: string,
  cashBalance: number,
  mtdSpend: number,
  budgetAmount: number,
  currentYear: number,
  currentMonth: number
): Promise<{ before: number; after: number }> {
  // Get all historical transactions for burn calculation
  const allTransactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      date: true,
      amount: true,
      expenseType: true,
      frequency: true,
      endDate: true,
    },
  })

  const currentMonthlyBurn = calculateMonthlyBurn(allTransactions.map(t => ({
    amount: parseFloat(String(t.amount)),
    date: t.date,
    expenseType: t.expenseType || 'one-time',
    frequency: t.frequency,
    endDate: t.endDate
  })))
  const runwayBefore = calculateRunway(cashBalance, currentMonthlyBurn)

  // Project monthly overrun: calculate daily rate and project to full month
  const now = new Date()
  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const daysElapsed = Math.max(1, Math.floor((now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)))
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  const projectedMonthlySpend = (mtdSpend / daysElapsed) * daysInMonth
  const projectedMonthlyOverrun = Math.max(0, projectedMonthlySpend - budgetAmount)

  // Calculate burn after: add projected monthly overrun to current monthly burn
  const monthlyBurnAfter = currentMonthlyBurn + projectedMonthlyOverrun
  const runwayAfter = calculateRunway(cashBalance, monthlyBurnAfter)

  return { before: runwayBefore, after: runwayAfter }
}

/**
 * Check budgets against month-to-date spend and create alerts at 80% and 100% thresholds.
 * Prevents duplicate alerts for the same category, threshold, and month.
 */
export async function checkBudgetsAndCreateAlerts(
  companyId: string,
  cashBalance: number
): Promise<void> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  // Get active budgets for current month
  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

  const activeBudgets = await prisma.budget.findMany({
    where: {
      companyId,
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
  })

  if (activeBudgets.length === 0) {
    return
  }

  // Get all transactions for the company
  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    select: {
      date: true,
      amount: true,
      category: true,
    },
  })

  // Get month-to-date spend by category
  const mtdSpendByCategory = getMonthToDateSpendByCategory(
    transactions,
    currentYear,
    currentMonth
  )

  // Check each budget against thresholds
  for (const budget of activeBudgets) {
    const budgetAmount = typeof budget.amount === 'number'
      ? budget.amount
      : parseFloat(String(budget.amount))

    const mtdSpend = mtdSpendByCategory.get(budget.category) || 0
    const percentage = (mtdSpend / budgetAmount) * 100

    // Check 80% threshold
    if (percentage >= 80 && percentage < 100) {
      await createAlertIfNotExists(
        companyId,
        budget.category,
        80,
        monthKey,
        mtdSpend,
        budgetAmount,
        cashBalance,
        currentYear,
        currentMonth
      )
    }

    // Check 100% threshold
    if (percentage >= 100) {
      await createAlertIfNotExists(
        companyId,
        budget.category,
        100,
        monthKey,
        mtdSpend,
        budgetAmount,
        cashBalance,
        currentYear,
        currentMonth
      )
    }
  }
}

/**
 * Create an alert if one doesn't already exist for this category/threshold/month combination.
 */
async function createAlertIfNotExists(
  companyId: string,
  category: Category,
  threshold: number,
  monthKey: string,
  mtdSpend: number,
  budgetAmount: number,
  cashBalance: number,
  currentYear: number,
  currentMonth: number
): Promise<void> {
  // Check if alert already exists
  const existingAlert = await prisma.alert.findFirst({
    where: {
      companyId,
      category,
      threshold,
      monthKey,
    },
  })

  if (existingAlert) {
    return // Prevent duplicate
  }

  // Calculate runway impact
  const runwayImpact = await calculateRunwayImpact(
    companyId,
    cashBalance,
    mtdSpend,
    budgetAmount,
    currentYear,
    currentMonth
  )

  // Create alert message with runway impact
  const percentage = ((mtdSpend / budgetAmount) * 100).toFixed(1)
  const thresholdText = threshold === 100 ? 'exceeded' : 'reached'
  const runwayBeforeMonths = runwayImpact.before === Infinity
    ? '∞'
    : runwayImpact.before.toFixed(1)
  const runwayAfterMonths = runwayImpact.after === Infinity
    ? '∞'
    : runwayImpact.after.toFixed(1)

  // Determine risk level based on runway impact
  let riskLevel: 'safe' | 'risky' | 'dangerous' = 'safe'
  const runwayBeforeNum = runwayImpact.before === Infinity ? 999 : runwayImpact.before
  const runwayAfterNum = runwayImpact.after === Infinity ? 999 : runwayImpact.after
  
  if (runwayAfterNum < 6) {
    riskLevel = 'dangerous'
  } else if (runwayAfterNum < 12) {
    riskLevel = 'risky'
  } else {
    riskLevel = 'safe'
  }

  // Create survival-focused message with forced awareness
  const runwayDecrease = runwayBeforeNum - runwayAfterNum
  const runwayDecreaseText = runwayDecrease > 0 
    ? `This reduces your runway by ${runwayDecrease.toFixed(1)} months.`
    : ''
  
  let survivalMessage = ''
  if (riskLevel === 'dangerous') {
    survivalMessage = `⚠️ DANGEROUS: This spending threatens financial survival. Runway drops to ${runwayAfterMonths} months. Immediate action required.`
  } else if (riskLevel === 'risky') {
    survivalMessage = `⚠️ RISKY: Runway drops to ${runwayAfterMonths} months. ${runwayDecreaseText} Consider cost reduction.`
  } else {
    survivalMessage = `Runway remains healthy at ${runwayAfterMonths} months. ${runwayDecreaseText}`
  }

  const message = `Budget ${thresholdText}: ${category} category has spent ${percentage}% of budget ($${mtdSpend.toFixed(2)} / $${budgetAmount.toFixed(2)}). ` +
    `${survivalMessage} Runway: ${runwayBeforeMonths} months → ${runwayAfterMonths} months.`

  const severity = threshold === 100 ? 'high' : riskLevel === 'dangerous' ? 'high' : 'medium'

  await prisma.alert.create({
    data: {
      companyId,
      message,
      severity,
      // @ts-ignore - riskLevel field will be available after database migration
      riskLevel,
      category,
      threshold,
      monthKey,
    },
  })
}

