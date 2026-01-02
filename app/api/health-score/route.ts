import { NextRequest, NextResponse } from 'next/server'
import { calculateFinancialHealthScore } from '@/lib/ai-insights'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const healthScore = await calculateFinancialHealthScore(companyId)

    return NextResponse.json({ healthScore }, { status: 200 })
  } catch (error) {
    console.error('Health score calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate health score', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}




