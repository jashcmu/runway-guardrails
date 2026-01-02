import { NextRequest, NextResponse } from 'next/server'
import { simulateScenario, ScenarioAction } from '@/lib/scenario-simulation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, cashBalance, actions } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (cashBalance === undefined || cashBalance === null) {
      return NextResponse.json({ error: 'cashBalance is required' }, { status: 400 })
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: 'actions array is required' }, { status: 400 })
    }

    const result = await simulateScenario(companyId, cashBalance, actions as ScenarioAction[])

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Scenario simulation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to simulate scenario',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

