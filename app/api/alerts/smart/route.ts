import { NextRequest, NextResponse } from 'next/server'
import { generateSmartAlerts } from '@/lib/smart-alerts'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const cashBalance = searchParams.get('cashBalance')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!cashBalance || isNaN(parseFloat(cashBalance))) {
      return NextResponse.json({ error: 'Valid cashBalance is required' }, { status: 400 })
    }

    const alerts = await generateSmartAlerts(companyId, parseFloat(cashBalance))

    return NextResponse.json({ alerts }, { status: 200 })
  } catch (error) {
    console.error('Smart alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to generate smart alerts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

