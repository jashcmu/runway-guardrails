import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Fundraising Calculator
 * Calculates dilution, runway extension, and scenarios for fundraising
 */

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      companyId,
      amountRaising,
      preMoneyValuation,
      currentBurnRate,
    } = body

    if (!companyId || !amountRaising) {
      return NextResponse.json(
        { error: 'Company ID and amount raising required' },
        { status: 400 }
      )
    }

    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        fundraisingRounds: {
          orderBy: { closingDate: 'desc' },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Calculate dilution
    const postMoneyValuation = preMoneyValuation + amountRaising
    const dilution = (amountRaising / postMoneyValuation) * 100

    // Calculate new runway
    const newBalance = company.cashBalance + amountRaising
    const burnRate = currentBurnRate || 0
    const newRunway = burnRate > 0 ? newBalance / burnRate : null
    const currentRunway = burnRate > 0 ? company.cashBalance / burnRate : null
    const runwayExtension = newRunway && currentRunway ? newRunway - currentRunway : null

    // Calculate ownership after dilution
    const totalPreviousRounds = company.fundraisingRounds.reduce(
      (sum, round) => sum + round.amountRaised,
      0
    )

    // Scenarios
    const scenarios = generateScenarios(amountRaising, burnRate, newBalance)

    const result = {
      calculation: {
        amountRaising,
        preMoneyValuation,
        postMoneyValuation,
        dilution: Math.round(dilution * 100) / 100,
        newBalance,
        newRunway: newRunway ? Math.round(newRunway * 10) / 10 : null,
        currentRunway: currentRunway ? Math.round(currentRunway * 10) / 10 : null,
        runwayExtension: runwayExtension ? Math.round(runwayExtension * 10) / 10 : null,
      },
      ownership: {
        foundersAfterRound: Math.round((100 - dilution) * 100) / 100,
        investorsThisRound: Math.round(dilution * 100) / 100,
        totalRaised: totalPreviousRounds + amountRaising,
      },
      scenarios,
      recommendations: generateRecommendations(
        dilution,
        newRunway,
        burnRate,
        company.targetMonths || 18
      ),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Fundraising calculator error:', error)
    return NextResponse.json(
      { error: 'Calculation failed' },
      { status: 500 }
    )
  }
}

function generateScenarios(amountRaising: number, burnRate: number, newBalance: number) {
  return [
    {
      name: 'Conservative Growth',
      burnIncrease: 1.0, // No increase
      description: 'Maintain current burn rate',
      runway: burnRate > 0 ? newBalance / burnRate : null,
      monthsAdded: burnRate > 0 ? amountRaising / burnRate : null,
    },
    {
      name: 'Hire 1 Engineer',
      burnIncrease: 1.2, // 20% increase
      description: 'Add ₹1L/month for new hire',
      runway: burnRate > 0 ? newBalance / (burnRate * 1.2) : null,
      monthsAdded: burnRate > 0 ? amountRaising / (burnRate * 1.2) : null,
    },
    {
      name: 'Aggressive Growth',
      burnIncrease: 1.5, // 50% increase
      description: 'Hire 2-3 people + marketing',
      runway: burnRate > 0 ? newBalance / (burnRate * 1.5) : null,
      monthsAdded: burnRate > 0 ? amountRaising / (burnRate * 1.5) : null,
    },
    {
      name: 'Blitzscaling',
      burnIncrease: 2.0, // 100% increase
      description: 'Double burn for rapid growth',
      runway: burnRate > 0 ? newBalance / (burnRate * 2.0) : null,
      monthsAdded: burnRate > 0 ? amountRaising / (burnRate * 2.0) : null,
    },
  ]
}

function generateRecommendations(
  dilution: number,
  newRunway: number | null,
  burnRate: number,
  targetMonths: number
) {
  const recommendations: string[] = []

  // Dilution recommendations
  if (dilution > 25) {
    recommendations.push(
      `⚠️ High dilution (${dilution.toFixed(1)}%). Consider negotiating higher valuation or raising less.`
    )
  } else if (dilution < 15) {
    recommendations.push(
      `✅ Healthy dilution (${dilution.toFixed(1)}%). Good balance of capital and ownership.`
    )
  } else {
    recommendations.push(
      `👍 Reasonable dilution (${dilution.toFixed(1)}%). Within typical range for early-stage rounds.`
    )
  }

  // Runway recommendations
  if (newRunway) {
    if (newRunway < 12) {
      recommendations.push(
        `⚠️ New runway of ${newRunway.toFixed(1)} months is short. Consider raising more or reducing burn.`
      )
    } else if (newRunway >= 18) {
      recommendations.push(
        `✅ Excellent! ${newRunway.toFixed(1)} months runway gives you time to hit milestones.`
      )
    } else {
      recommendations.push(
        `👍 ${newRunway.toFixed(1)} months runway is adequate. Plan for next round in 12-15 months.`
      )
    }
  }

  // Burn rate recommendations
  if (burnRate > 0) {
    const monthlyBurnInLakhs = (burnRate / 100000).toFixed(1)
    if (burnRate > 500000) {
      recommendations.push(
        `💡 Current burn of ₹${monthlyBurnInLakhs}L/month is high. Focus on capital efficiency.`
      )
    }
  }

  // Strategic recommendations
  recommendations.push(
    `📊 Aim to raise enough for ${targetMonths} months + 3-6 month buffer for fundraising.`
  )

  return recommendations
}

// Save a fundraising round
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      companyId,
      roundName,
      amountRaised,
      preMoneyValuation,
      postMoneyValuation,
      investorNames,
      leadInvestor,
      closingDate,
      dilution,
    } = body

    if (!companyId || !roundName || !amountRaised) {
      return NextResponse.json(
        { error: 'Company ID, round name, and amount required' },
        { status: 400 }
      )
    }

    const round = await prisma.fundraisingRound.create({
      data: {
        companyId,
        roundName,
        amountRaised,
        preMoneyValuation,
        postMoneyValuation,
        investorNames,
        leadInvestor,
        closingDate: new Date(closingDate),
        dilution,
      },
    })

    // Update company cash balance
    await prisma.company.update({
      where: { id: companyId },
      data: {
        cashBalance: {
          increment: amountRaised,
        },
      },
    })

    return NextResponse.json({
      success: true,
      round,
      message: 'Fundraising round saved successfully',
    })
  } catch (error) {
    console.error('Save fundraising round error:', error)
    return NextResponse.json(
      { error: 'Failed to save round' },
      { status: 500 }
    )
  }
}

// Get fundraising history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    const rounds = await prisma.fundraisingRound.findMany({
      where: { companyId },
      orderBy: { closingDate: 'desc' },
    })

    const totalRaised = rounds.reduce((sum, round) => sum + round.amountRaised, 0)
    const totalDilution = rounds.reduce((sum, round) => sum + (round.dilution || 0), 0)

    return NextResponse.json({
      rounds,
      summary: {
        totalRounds: rounds.length,
        totalRaised,
        totalDilution,
        latestRound: rounds[0] || null,
      },
    })
  } catch (error) {
    console.error('Get fundraising rounds error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    )
  }
}




