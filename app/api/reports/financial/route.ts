import { NextRequest, NextResponse } from 'next/server'
import {
  generateProfitLoss,
  generateBalanceSheet,
  generateCashFlow,
  generateFinancialReportPackage,
} from '@/lib/financial-reports'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const reportType = searchParams.get('type') || 'all'
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Default to current month if no dates provided
    const endDate = endDateStr ? new Date(endDateStr) : new Date()
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    if (reportType === 'profit-loss' || reportType === 'p&l') {
      const report = await generateProfitLoss(companyId, startDate, endDate)
      return NextResponse.json(report)
    } else if (reportType === 'balance-sheet') {
      const report = await generateBalanceSheet(companyId, endDate)
      return NextResponse.json(report)
    } else if (reportType === 'cash-flow') {
      const report = await generateCashFlow(companyId, startDate, endDate)
      return NextResponse.json(report)
    } else if (reportType === 'all' || reportType === 'package') {
      // Generate all reports in one go
      const package_ = await generateFinancialReportPackage(companyId, startDate, endDate)
      return NextResponse.json(package_)
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
    console.error('Financial report generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate financial report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, reportType, startDate, endDate, format = 'json' } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const end = endDate ? new Date(endDate) : new Date()

    // Generate report package
    const reportPackage = await generateFinancialReportPackage(companyId, start, end)

    if (format === 'pdf') {
      // TODO: Generate PDF format
      return NextResponse.json({
        error: 'PDF format not yet implemented',
        message: 'Please use format: json for now',
      }, { status: 501 })
    }

    return NextResponse.json(reportPackage)
  } catch (error) {
    console.error('Financial report generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate financial report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}



