import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

/**
 * Public Dashboard API
 * Allow startups to share their financial metrics publicly
 */

// Get public dashboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Slug required' }, { status: 400 })
    }

    // Find company by public slug
    const company = await prisma.company.findFirst({
      where: { publicSlug: slug },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
            },
          },
          orderBy: { date: 'desc' },
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

    if (!company || !company.isPublic) {
      return NextResponse.json(
        { error: 'Public dashboard not found or disabled' },
        { status: 404 }
      )
    }

    // Calculate metrics
    const monthlyBurn = calculateMonthlyBurn(company.transactions)
    const monthlyRevenue = calculateMonthlyRevenue(company.revenues)
    const runway = monthlyBurn > 0 ? company.cashBalance / monthlyBurn : null

    // Calculate trends
    const burnTrend = calculateTrend(company.transactions)
    const revenueTrend = calculateTrend(company.revenues)

    // Aggregate by category
    const byCategory = company.transactions.reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})

    return NextResponse.json({
      company: {
        name: company.name,
        slug: company.publicSlug,
        industry: company.industry,
        fundingStage: company.fundingStage,
      },
      metrics: {
        runway: runway ? Math.floor(runway * 10) / 10 : null,
        monthlyBurn: Math.floor(monthlyBurn),
        monthlyRevenue: Math.floor(monthlyRevenue),
        cashBalance: Math.floor(company.cashBalance),
        burnMultiple:
          monthlyRevenue > 0 ? Math.floor((monthlyBurn / monthlyRevenue) * 10) / 10 : null,
      },
      trends: {
        burn: burnTrend,
        revenue: revenueTrend,
      },
      spending: {
        byCategory: Object.entries(byCategory).map(([category, amount]) => ({
          category,
          amount: Math.floor(amount as number),
          percentage: Math.floor(((amount as number) / monthlyBurn) * 100),
        })),
      },
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get public dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public dashboard' },
      { status: 500 }
    )
  }
}

// Enable/disable public dashboard
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, isPublic, publicSlug } = body

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // If enabling, ensure public slug is available
    if (isPublic && publicSlug) {
      const existing = await prisma.company.findFirst({
        where: { publicSlug },
      })

      if (existing && existing.id !== companyId) {
        return NextResponse.json(
          { error: 'Public slug already taken' },
          { status: 400 }
        )
      }
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        isPublic,
        publicSlug: isPublic ? publicSlug || null : null,
      },
    })

    return NextResponse.json({
      success: true,
      company,
      message: isPublic ? 'Public dashboard enabled' : 'Public dashboard disabled',
      publicUrl: isPublic
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/public/${company.publicSlug}`
        : null,
    })
  } catch (error) {
    console.error('Toggle public dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to update public dashboard settings' },
      { status: 500 }
    )
  }
}

function calculateMonthlyBurn(transactions: any[]): number {
  if (transactions.length === 0) return 0

  const monthlyData: { [key: string]: number } = {}

  transactions.forEach((t) => {
    const month = new Date(t.date).toISOString().slice(0, 7)
    monthlyData[month] = (monthlyData[month] || 0) + t.amount
  })

  const values = Object.values(monthlyData)
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

function calculateMonthlyRevenue(revenues: any[]): number {
  if (revenues.length === 0) return 0

  const monthlyData: { [key: string]: number } = {}

  revenues.forEach((r) => {
    const month = new Date(r.date).toISOString().slice(0, 7)
    monthlyData[month] = (monthlyData[month] || 0) + r.amount
  })

  const values = Object.values(monthlyData)
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

function calculateTrend(data: any[]): 'increasing' | 'decreasing' | 'stable' {
  if (data.length < 4) return 'stable'

  const monthlyData: { [key: string]: number } = {}

  data.forEach((item) => {
    const month = new Date(item.date).toISOString().slice(0, 7)
    monthlyData[month] = (monthlyData[month] || 0) + (item.amount || 0)
  })

  const sortedMonths = Object.keys(monthlyData).sort()
  if (sortedMonths.length < 2) return 'stable'

  const recent = monthlyData[sortedMonths[sortedMonths.length - 1]]
  const previous = monthlyData[sortedMonths[sortedMonths.length - 2]]

  if (recent > previous * 1.1) return 'increasing'
  if (recent < previous * 0.9) return 'decreasing'
  return 'stable'
}



