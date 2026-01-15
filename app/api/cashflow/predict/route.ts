import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

/**
 * Predictive Cash Flow Forecasting
 * Uses historical data + ML-like algorithm to predict future cash flow
 */

interface PredictionMonth {
  month: string
  date: Date
  predictedBurn: number
  predictedRevenue: number
  predictedBalance: number
  confidence: number
  factors: {
    historicalAverage: number
    trend: 'increasing' | 'decreasing' | 'stable'
    seasonality: number
    recurringExpenses: number
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const months = parseInt(searchParams.get('months') || '6')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // Get company data with correct relationships
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 500, // Last 500 transactions for cash flow analysis
        },
        invoices: {
          where: {
            status: { not: 'paid' } // Unpaid invoices (future AR collections)
          },
          orderBy: { dueDate: 'asc' },
        },
        bills: {
          where: {
            paymentStatus: { not: 'paid' } // Unpaid bills (future AP payments)
          },
          orderBy: { dueDate: 'asc' },
        },
        subscriptions: {
          where: { status: 'active' }, // Active subscriptions for recurring burn
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Calculate predictions
    const predictions = await generatePredictions(company, months)

    // Store predictions in database for historical tracking
    await storePredictions(companyId, predictions)

    return NextResponse.json({
      companyId,
      currentBalance: company.cashBalance,
      predictions,
      generatedAt: new Date().toISOString(),
      modelVersion: 'v1.0',
    })
  } catch (error) {
    console.error('Cash flow prediction error:', error)
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    )
  }
}

async function generatePredictions(company: any, monthsAhead: number): Promise<PredictionMonth[]> {
  const predictions: PredictionMonth[] = []
  
  // Analyze historical CASH transactions (not AR/AP)
  const historical = analyzeHistoricalCashFlow(company.transactions)
  
  // Get active subscriptions for recurring burn
  const recurringBurn = company.subscriptions?.reduce(
    (sum: number, sub: any) => {
      // Convert to monthly amount based on billing cycle
      const amount = sub.amount || 0
      const cycle = sub.billingCycle || 'monthly'
      if (cycle === 'monthly') return sum + amount
      if (cycle === 'quarterly') return sum + (amount / 3)
      if (cycle === 'yearly') return sum + (amount / 12)
      return sum + amount
    },
    0
  ) || 0

  let currentBalance = company.cashBalance

  // Map invoices and bills to future months for projections
  const futureARbyMonth: { [key: string]: number } = {}
  const futureAPbyMonth: { [key: string]: number } = {}

  // Project AR collections (invoices due)
  company.invoices?.forEach((inv: any) => {
    if (inv.dueDate && inv.balanceAmount > 0) {
      const monthKey = new Date(inv.dueDate).toISOString().slice(0, 7)
      futureARbyMonth[monthKey] = (futureARbyMonth[monthKey] || 0) + inv.balanceAmount
    }
  })

  // Project AP payments (bills due)
  company.bills?.forEach((bill: any) => {
    if (bill.dueDate && bill.balanceAmount > 0) {
      const monthKey = new Date(bill.dueDate).toISOString().slice(0, 7)
      futureAPbyMonth[monthKey] = (futureAPbyMonth[monthKey] || 0) + bill.balanceAmount
    }
  })

  for (let i = 1; i <= monthsAhead; i++) {
    const futureDate = new Date()
    futureDate.setMonth(futureDate.getMonth() + i)
    const monthKey = futureDate.toISOString().slice(0, 7) // YYYY-MM

    // Predict burn with trend adjustment
    const trendMultiplier = historical.trend === 'increasing' ? 1.05 : 
                           historical.trend === 'decreasing' ? 0.95 : 1.0
    
    const seasonalityFactor = getSeasonalityFactor(futureDate.getMonth())
    
    // Base prediction on historical expenses + recurring subscriptions
    const predictedBurn = 
      (historical.averageExpenses * trendMultiplier * seasonalityFactor) +
      recurringBurn

    // Predict revenue from historical + known AR due this month
    const predictedRevenue = 
      (historical.averageRevenue * trendMultiplier) +
      (futureARbyMonth[monthKey] || 0)

    // Include AP payments due this month in burn
    const predictedAPPayments = futureAPbyMonth[monthKey] || 0

    // Calculate future balance
    currentBalance = currentBalance + predictedRevenue - predictedBurn - predictedAPPayments

    // Confidence decreases the further out we predict
    const confidence = Math.max(95 - (i * 10), 40)

    predictions.push({
      month: monthKey,
      date: futureDate,
      predictedBurn: predictedBurn + predictedAPPayments, // Total cash out
      predictedRevenue,
      predictedBalance: currentBalance,
      confidence,
      factors: {
        historicalAverage: historical.averageExpenses,
        trend: historical.trend,
        seasonality: seasonalityFactor,
        recurringExpenses: recurringBurn,
      },
    })
  }

  return predictions
}

function analyzeHistoricalCashFlow(transactions: any[]) {
  // Separate expenses (negative) and revenue (positive) from CASH transactions
  const monthlyExpenses: { [key: string]: number } = {}
  const monthlyRevenue: { [key: string]: number } = {}
  
  transactions.forEach(txn => {
    const monthKey = new Date(txn.date).toISOString().slice(0, 7)
    
    if (txn.amount < 0) {
      // Expense (cash out)
      monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + Math.abs(txn.amount)
    } else if (txn.amount > 0) {
      // Revenue (cash in)
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + txn.amount
    }
  })

  // Calculate average expenses
  const expenseValues = Object.values(monthlyExpenses)
  const averageExpenses = expenseValues.length > 0
    ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length
    : 0

  // Calculate average revenue
  const revenueValues = Object.values(monthlyRevenue)
  const averageRevenue = revenueValues.length > 0
    ? revenueValues.reduce((a, b) => a + b, 0) / revenueValues.length
    : 0

  // Calculate trend based on expenses
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  if (expenseValues.length >= 3) {
    const recent = expenseValues.slice(0, 3).reduce((a, b) => a + b, 0) / 3
    const older = expenseValues.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, expenseValues.slice(3, 6).length)
    
    if (recent > older * 1.1) trend = 'increasing'
    else if (recent < older * 0.9) trend = 'decreasing'
  }

  return {
    averageExpenses,
    averageRevenue,
    trend,
    monthCount: expenseValues.length,
  }
}

function getSeasonalityFactor(month: number): number {
  // Simple seasonality model (can be enhanced with actual data)
  // Months are 0-indexed (0 = January)
  
  // Higher spending in: March (year-end), June, December
  const seasonalFactors = [
    1.0,  // January
    1.0,  // February
    1.15, // March (fiscal year-end)
    1.0,  // April
    1.0,  // May
    1.1,  // June
    1.0,  // July
    1.0,  // August
    1.0,  // September
    1.05, // October (Diwali)
    1.1,  // November
    1.15, // December (holiday season)
  ]
  
  return seasonalFactors[month] || 1.0
}

async function storePredictions(companyId: string, predictions: PredictionMonth[]) {
  try {
    // Store each prediction in database
    for (const pred of predictions) {
      // Check if prediction already exists
      const existing = await prisma.cashFlowPrediction.findFirst({
        where: {
          companyId,
          predictionDate: pred.date,
        },
      })

      if (existing) {
        // Update existing
        await prisma.cashFlowPrediction.update({
          where: { id: existing.id },
          data: {
            predictedBurn: pred.predictedBurn,
            predictedRevenue: pred.predictedRevenue,
            predictedBalance: pred.predictedBalance,
            confidence: pred.confidence,
            factors: JSON.stringify(pred.factors),
          },
        })
      } else {
        // Create new
        await prisma.cashFlowPrediction.create({
          data: {
            companyId,
            predictionDate: pred.date,
            predictedBurn: pred.predictedBurn,
            predictedRevenue: pred.predictedRevenue,
            predictedBalance: pred.predictedBalance,
            confidence: pred.confidence,
            modelVersion: 'v1.0',
            factors: JSON.stringify(pred.factors),
          },
        })
      }
    }
  } catch (error) {
    console.error('Failed to store predictions:', error)
    // Don't fail the request if storage fails
  }
}

