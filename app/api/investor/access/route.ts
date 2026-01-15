import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

/**
 * Investor Dashboard API
 * Read-only access for investors/VCs
 */

// Generate investor access token
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, investorEmail, investorName, accessLevel } = body

    if (!companyId || !investorEmail) {
      return NextResponse.json(
        { error: 'Company ID and investor email required' },
        { status: 400 }
      )
    }

    // Create investor user with read-only role
    const existingCompanyUser = await prisma.companyUser.findFirst({
      where: {
        companyId,
        user: {
          email: investorEmail,
        },
      },
    })

    if (existingCompanyUser) {
      return NextResponse.json(
        { error: 'Investor already has access' },
        { status: 400 }
      )
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: investorEmail },
    })

    if (!user) {
      // Create investor user (no password needed for read-only)
      user = await prisma.user.create({
        data: {
          email: investorEmail,
          name: investorName || 'Investor',
          password: '', // No password for investor-only accounts
        },
      })
    }

    // Grant access
    const companyUser = await prisma.companyUser.create({
      data: {
        companyId,
        userId: user.id,
        role: accessLevel || 'investor_readonly',
      },
    })

    // Generate access link (in production, use JWT or similar)
    const accessToken = Buffer.from(`${companyId}:${user.id}:${Date.now()}`).toString('base64')
    const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/investor/${companyId}?token=${accessToken}`

    // Send email to investor
    await sendInvestorInviteEmail(investorEmail, investorName, accessUrl)

    return NextResponse.json({
      success: true,
      companyUser,
      accessUrl,
      message: `Investor access granted to ${investorEmail}`,
    })
  } catch (error) {
    console.error('Grant investor access error:', error)
    return NextResponse.json(
      { error: 'Failed to grant investor access' },
      { status: 500 }
    )
  }
}

// Get investor dashboard data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const userId = searchParams.get('userId')

    if (!companyId || !userId) {
      return NextResponse.json(
        { error: 'Company ID and user ID required' },
        { status: 400 }
      )
    }

    // Verify investor has access
    const companyUser = await prisma.companyUser.findFirst({
      where: {
        companyId,
        userId,
        role: { contains: 'investor' },
      },
    })

    if (!companyUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get company data (limited fields for investors)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
            },
          },
          orderBy: { date: 'desc' },
        },
        revenues: {
          where: {
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
            },
          },
        },
        alerts: {
          where: {
            severity: { in: ['high', 'critical'] },
          },
          take: 10,
        },
        fundraisingRounds: {
          orderBy: { closingDate: 'desc' },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Calculate metrics
    const metrics = calculateInvestorMetrics(company)

    // Calculate month-over-month trends
    const trends = calculateMonthlyTrends(company.transactions, company.revenues)

    return NextResponse.json({
      company: {
        name: company.name,
        industry: company.industry,
        fundingStage: company.fundingStage,
      },
      metrics,
      trends,
      alerts: company.alerts.map((a) => ({
        id: a.id,
        message: a.message,
        severity: a.severity,
        createdAt: a.createdAt,
      })),
      fundraising: {
        rounds: company.fundraisingRounds.map((r) => ({
          roundName: r.roundName,
          amount: r.amountRaised,
          valuation: r.postMoneyValuation,
          closingDate: r.closingDate,
        })),
        totalRaised: company.fundraisingRounds.reduce(
          (sum, r) => sum + r.amountRaised,
          0
        ),
      },
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get investor dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch investor dashboard' },
      { status: 500 }
    )
  }
}

// Revoke investor access
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const userId = searchParams.get('userId')

    if (!companyId || !userId) {
      return NextResponse.json(
        { error: 'Company ID and user ID required' },
        { status: 400 }
      )
    }

    await prisma.companyUser.deleteMany({
      where: {
        companyId,
        userId,
        role: { contains: 'investor' },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Investor access revoked',
    })
  } catch (error) {
    console.error('Revoke investor access error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke access' },
      { status: 500 }
    )
  }
}

function calculateInvestorMetrics(company: any) {
  // Calculate monthly burn
  const now = new Date()
  const lastMonth = new Date(now.setMonth(now.getMonth() - 1))

  const recentTransactions = company.transactions.filter(
    (t: any) => new Date(t.date) >= lastMonth
  )

  const monthlyBurn = recentTransactions.reduce((sum: number, t: any) => sum + t.amount, 0)
  const runway = monthlyBurn > 0 ? company.cashBalance / monthlyBurn : null

  // Revenue
  const monthlyRevenue = company.revenues
    .filter((r: any) => new Date(r.date) >= lastMonth)
    .reduce((sum: number, r: any) => sum + r.amount, 0)

  // Burn multiple
  const burnMultiple = monthlyRevenue > 0 ? monthlyBurn / monthlyRevenue : null

  // Quick ratio (MRR growth / Net Burn)
  const quickRatio = monthlyRevenue > 0 && monthlyBurn > 0 ? monthlyRevenue / (monthlyBurn - monthlyRevenue) : null

  return {
    cashBalance: company.cashBalance,
    runway: runway ? Math.round(runway * 10) / 10 : null,
    monthlyBurn: Math.round(monthlyBurn),
    monthlyRevenue: Math.round(monthlyRevenue),
    burnMultiple: burnMultiple ? Math.round(burnMultiple * 10) / 10 : null,
    quickRatio: quickRatio ? Math.round(quickRatio * 10) / 10 : null,
    targetMonths: company.targetMonths,
  }
}

function calculateMonthlyTrends(transactions: any[], revenues: any[]) {
  // Group by month (last 6 months)
  const months: { [key: string]: { burn: number; revenue: number } } = {}

  // Initialize last 6 months
  for (let i = 0; i < 6; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const key = date.toISOString().slice(0, 7)
    months[key] = { burn: 0, revenue: 0 }
  }

  // Aggregate transactions
  transactions.forEach((t) => {
    const month = new Date(t.date).toISOString().slice(0, 7)
    if (months[month] !== undefined) {
      months[month].burn += t.amount
    }
  })

  // Aggregate revenues
  revenues.forEach((r) => {
    const month = new Date(r.date).toISOString().slice(0, 7)
    if (months[month] !== undefined) {
      months[month].revenue += r.amount
    }
  })

  // Convert to array and sort
  const trend = Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      burn: Math.round(data.burn),
      revenue: Math.round(data.revenue),
      netBurn: Math.round(data.burn - data.revenue),
    }))

  return trend
}

async function sendInvestorInviteEmail(email: string, name: string, accessUrl: string) {
  // TODO: Implement with email service
  console.log(`Sending investor invite to ${email}`)

  // In production, send actual email
  // await sendgrid.send({
  //   to: email,
  //   from: 'hello@runwayguardrails.com',
  //   subject: 'You have been granted access to portfolio company dashboard',
  //   html: `
  //     <p>Hi ${name},</p>
  //     <p>You have been granted read-only access to a portfolio company's financial dashboard.</p>
  //     <p>Click here to access:</p>
  //     <a href="${accessUrl}">${accessUrl}</a>
  //     <p>This link is secure and only accessible by you.</p>
  //   `
  // })

  return true
}




