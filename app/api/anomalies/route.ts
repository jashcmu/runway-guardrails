import { NextRequest, NextResponse } from 'next/server'
import { detectAnomalies } from '@/lib/ai-anomaly'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const anomalies = await detectAnomalies(companyId)

    return NextResponse.json({ anomalies, count: anomalies.length }, { status: 200 })
  } catch (error) {
    console.error('Anomaly detection error:', error)
    return NextResponse.json(
      { error: 'Failed to detect anomalies', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}




