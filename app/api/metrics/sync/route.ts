import { NextRequest, NextResponse } from 'next/server'
import { syncAllMetrics } from '@/lib/cash-sync'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Sync all financial metrics
    const metrics = await syncAllMetrics(companyId)

    return NextResponse.json({
      success: true,
      metrics,
    }, { status: 200 })
  } catch (error) {
    console.error('Sync metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to sync metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



