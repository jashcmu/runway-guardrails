import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Competitor Benchmarking
 * Compare your metrics against peer startups
 */

// Mock peer data (in production, this would aggregate real anonymized data)
const PEER_BENCHMARKS: { [key: string]: any } = {
  'saas-seed': {
    burnRateP50: 150000,
    burnRateP75: 250000,
    revenueP50: 80000,
    revenueP75: 150000,
    runwayP50: 14,
    runwayP75: 18,
    peerCount: 247,
  },
  'saas-series-a': {
    burnRateP50: 400000,
    burnRateP75: 600000,
    revenueP50: 300000,
    revenueP75: 500000,
    runwayP50: 16,
    runwayP75: 20,
    peerCount: 189,
  },
  'marketplace-seed': {
    burnRateP50: 200000,
    burnRateP75: 350000,
    revenueP50: 100000,
    revenueP75: 200000,
    runwayP50: 12,
    runwayP75: 16,
    peerCount: 156,
  },
  'fintech-seed': {
    burnRateP50: 180000,
    burnRateP75: 300000,
    revenueP50: 120000,
    revenueP75: 220000,
    runwayP50: 15,
    runwayP75: 18,
    peerCount: 203,
  },
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
            },
          },
        },
        revenues: {
          where: {
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
            },
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Calculate company metrics
    const monthlyData = calculateMonthlyMetrics(company.transactions, company.revenues)
    
    const yourBurnRate = monthlyData.averageBurn
    const yourRevenue = monthlyData.averageRevenue
    const yourRunway = yourBurnRate > 0 ? company.cashBalance / yourBurnRate : null

    // Get peer benchmarks
    const industry = company.industry || 'saas'
    const stage = company.fundingStage || 'seed'
    const benchmarkKey = `${industry.toLowerCase()}-${stage.toLowerCase()}`
    
    const peerData = PEER_BENCHMARKS[benchmarkKey] || PEER_BENCHMARKS['saas-seed']

    // Calculate comparisons
    const burnComparison = calculateComparison(yourBurnRate, peerData.burnRateP50, peerData.burnRateP75)
    const revenueComparison = calculateComparison(yourRevenue, peerData.revenueP50, peerData.revenueP75)
    const runwayComparison = yourRunway
      ? calculateComparison(yourRunway, peerData.runwayP50, peerData.runwayP75)
      : null

    // Generate insights
    const insights = generateInsights(
      burnComparison,
      revenueComparison,
      runwayComparison,
      yourBurnRate,
      peerData
    )

    // Store benchmark for historical tracking
    const currentMonth = new Date().toISOString().slice(0, 7)
    await prisma.benchmark.upsert({
      where: {
        companyId_month: {
          companyId,
          month: currentMonth,
        },
      },
      create: {
        companyId,
        month: currentMonth,
        yourBurnRate,
        yourRevenue,
        yourRunway,
        peerBurnP50: peerData.burnRateP50,
        peerBurnP75: peerData.burnRateP75,
        peerRevenueP50: peerData.revenueP50,
        peerRevenueP75: peerData.revenueP75,
        industry: industry,
        fundingStage: stage,
        peerCount: peerData.peerCount,
      },
      update: {
        yourBurnRate,
        yourRevenue,
        yourRunway,
        peerBurnP50: peerData.burnRateP50,
        peerBurnP75: peerData.burnRateP75,
      },
    })

    return NextResponse.json({
      yourMetrics: {
        burnRate: yourBurnRate,
        revenue: yourRevenue,
        runway: yourRunway,
        burnToRevenueRatio: yourRevenue > 0 ? yourBurnRate / yourRevenue : null,
      },
      peerBenchmarks: {
        burnRate: {
          p50: peerData.burnRateP50,
          p75: peerData.burnRateP75,
          yourPercentile: burnComparison.percentile,
        },
        revenue: {
          p50: peerData.revenueP50,
          p75: peerData.revenueP75,
          yourPercentile: revenueComparison.percentile,
        },
        runway: {
          p50: peerData.runwayP50,
          p75: peerData.runwayP75,
          yourPercentile: runwayComparison?.percentile || null,
        },
      },
      comparison: {
        burn: burnComparison,
        revenue: revenueComparison,
        runway: runwayComparison,
      },
      insights,
      metadata: {
        industry,
        fundingStage: stage,
        peerCount: peerData.peerCount,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Benchmarking error:', error)
    return NextResponse.json(
      { error: 'Failed to generate benchmarks' },
      { status: 500 }
    )
  }
}

function calculateMonthlyMetrics(transactions: any[], revenues: any[]) {
  // Group by month
  const monthlyBurn: { [key: string]: number } = {}
  const monthlyRevenue: { [key: string]: number } = {}

  transactions.forEach(txn => {
    const month = new Date(txn.date).toISOString().slice(0, 7)
    monthlyBurn[month] = (monthlyBurn[month] || 0) + txn.amount
  })

  revenues.forEach(rev => {
    const month = new Date(rev.date).toISOString().slice(0, 7)
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + rev.amount
  })

  const burns = Object.values(monthlyBurn)
  const revs = Object.values(monthlyRevenue)

  return {
    averageBurn: burns.length > 0 ? burns.reduce((a, b) => a + b, 0) / burns.length : 0,
    averageRevenue: revs.length > 0 ? revs.reduce((a, b) => a + b, 0) / revs.length : 0,
  }
}

function calculateComparison(yourValue: number, p50: number, p75: number) {
  let status: 'excellent' | 'good' | 'average' | 'below-average' | 'concerning'
  let percentile: number

  if (yourValue <= p50) {
    status = 'excellent'
    percentile = 25
  } else if (yourValue <= p75) {
    status = 'good'
    percentile = 50
  } else if (yourValue <= p75 * 1.2) {
    status = 'average'
    percentile = 75
  } else if (yourValue <= p75 * 1.5) {
    status = 'below-average'
    percentile = 85
  } else {
    status = 'concerning'
    percentile = 95
  }

  const percentDiff = ((yourValue - p50) / p50) * 100

  return {
    status,
    percentile,
    percentDiff: Math.round(percentDiff),
    message: generateComparisonMessage(percentDiff, 'burn'),
  }
}

function generateComparisonMessage(percentDiff: number, metric: string): string {
  if (metric === 'burn') {
    if (percentDiff < -20) return 'Significantly lower than peers - excellent capital efficiency'
    if (percentDiff < 0) return 'Lower than peers - good capital management'
    if (percentDiff < 20) return 'In line with peers'
    if (percentDiff < 50) return 'Higher than peers - consider optimizing'
    return 'Significantly higher than peers - requires attention'
  } else if (metric === 'revenue') {
    if (percentDiff > 50) return 'Significantly higher than peers - excellent growth'
    if (percentDiff > 20) return 'Higher than peers - strong performance'
    if (percentDiff > -20) return 'In line with peers'
    return 'Lower than peers - focus on revenue growth'
  }
  return ''
}

function generateInsights(
  burnComp: any,
  revenueComp: any,
  runwayComp: any,
  yourBurn: number,
  peerData: any
): string[] {
  const insights: string[] = []

  // Burn insights
  if (burnComp.status === 'excellent') {
    insights.push(
      `🏆 Your burn rate is ${Math.abs(burnComp.percentDiff)}% lower than peers - great capital efficiency!`
    )
  } else if (burnComp.status === 'concerning') {
    const savings = yourBurn - peerData.burnRateP50
    insights.push(
      `⚠️ Your burn is ${burnComp.percentDiff}% higher than peers. Reducing to median would save ₹${(savings / 1000).toFixed(0)}k/month.`
    )
  }

  // Revenue insights
  if (revenueComp.status === 'excellent') {
    insights.push(`📈 Revenue outperforming peers by ${revenueComp.percentDiff}%`)
  } else if (revenueComp.status === 'below-average') {
    insights.push(`💡 Revenue ${Math.abs(revenueComp.percentDiff)}% below peers - opportunity to grow`)
  }

  // Runway insights
  if (runwayComp) {
    if (runwayComp.status === 'excellent') {
      insights.push(`✅ Strong runway - above ${peerData.runwayP75} month peer benchmark`)
    } else if (runwayComp.status === 'concerning') {
      insights.push(`⏰ Runway shorter than peers - consider fundraising or reducing burn`)
    }
  }

  // Category-specific insights
  insights.push(
    `📊 Data based on ${peerData.peerCount} similar startups in your segment`
  )

  return insights
}

// Get historical benchmarks
export async function POST(request: Request) {
  try {
    const { companyId } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    const benchmarks = await prisma.benchmark.findMany({
      where: { companyId },
      orderBy: { month: 'desc' },
      take: 12, // Last 12 months
    })

    return NextResponse.json({ benchmarks })
  } catch (error) {
    console.error('Get historical benchmarks error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch benchmarks' },
      { status: 500 }
    )
  }
}




