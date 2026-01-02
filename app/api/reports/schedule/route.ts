import { NextRequest, NextResponse } from 'next/server'
import { generateScheduledReport, ReportSchedule } from '@/lib/auto-reports'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, reportType, frequency, dayOfWeek, dayOfMonth } = body

    if (!companyId || !reportType || !frequency) {
      return NextResponse.json(
        { error: 'companyId, reportType, and frequency are required' },
        { status: 400 }
      )
    }

    const schedule: ReportSchedule = {
      companyId,
      reportType,
      frequency,
      dayOfWeek,
      dayOfMonth,
    }

    const report = await generateScheduledReport(schedule)

    return NextResponse.json({
      message: 'Report generated successfully',
      report,
      schedule,
    }, { status: 200 })
  } catch (error) {
    console.error('Schedule report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate scheduled report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

