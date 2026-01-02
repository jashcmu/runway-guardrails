import { NextRequest, NextResponse } from 'next/server'
import { getBurnTrend } from '@/lib/burn-trends'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const trend = await getBurnTrend(companyId)

    return NextResponse.json(trend, { status: 200 })
  } catch (error) {
    console.error('Trend analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze burn trends',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

