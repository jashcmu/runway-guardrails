import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { trackOverdueInvoices, trackOverdueBills, generateAgingReport } from '@/lib/overdue-tracker'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const action = searchParams.get('action') || 'check'

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (action === 'check') {
      // Check for overdue invoices and bills
      const [invoiceResult, billResult] = await Promise.all([
        trackOverdueInvoices(companyId),
        trackOverdueBills(companyId),
      ])

      return NextResponse.json({
        overdueInvoices: invoiceResult.overdueInvoices,
        totalOverdueAR: invoiceResult.totalOverdueAmount,
        overdueBills: billResult.overdueBills,
        totalOverdueAP: billResult.totalOverdueAmount,
        alertsCreated: invoiceResult.alertsCreated + billResult.alertsCreated,
      })
    } else if (action === 'aging') {
      // Generate aging report
      const agingReport = await generateAgingReport(companyId)
      return NextResponse.json(agingReport)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Overdue tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track overdue payments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, action } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (action === 'run_check') {
      // Manually trigger overdue check
      const [invoiceResult, billResult] = await Promise.all([
        trackOverdueInvoices(companyId),
        trackOverdueBills(companyId),
      ])

      return NextResponse.json({
        success: true,
        overdueInvoices: invoiceResult.overdueInvoices.length,
        overdueBills: billResult.overdueBills.length,
        alertsCreated: invoiceResult.alertsCreated + billResult.alertsCreated,
        message: `Found ${invoiceResult.overdueInvoices.length} overdue invoices and ${billResult.overdueBills.length} overdue bills. Created ${invoiceResult.alertsCreated + billResult.alertsCreated} alerts.`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Overdue check error:', error)
    return NextResponse.json(
      { error: 'Failed to run overdue check', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



