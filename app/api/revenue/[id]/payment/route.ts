import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPaymentReceivedJournalEntry } from '@/lib/accounting/journal-entries'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const revenueId = params.id
    const body = await request.json()
    const { amountReceived, paymentDate } = body

    if (!amountReceived || !paymentDate) {
      return NextResponse.json(
        { error: 'Missing required fields: amountReceived, paymentDate' },
        { status: 400 }
      )
    }

    // Get revenue record
    const revenue = await prisma.revenue.findUnique({
      where: { id: revenueId },
    })

    if (!revenue) {
      return NextResponse.json({ error: 'Revenue not found' }, { status: 404 })
    }

    // Calculate new total received
    const newTotalReceived = revenue.amountReceived + amountReceived

    // Determine new status
    let newStatus = 'partial'
    if (newTotalReceived >= revenue.amount) {
      newStatus = 'paid'
    }

    // Update revenue
    const updatedRevenue = await prisma.revenue.update({
      where: { id: revenueId },
      data: {
        amountReceived: newTotalReceived,
        status: newStatus,
      },
    })

    // Create journal entry for payment received
    const journalResult = await createPaymentReceivedJournalEntry(
      revenue.companyId,
      revenueId,
      amountReceived,
      `Payment received - ${revenue.description}`,
      new Date(paymentDate)
    )

    if (!journalResult.success) {
      console.warn(`⚠ Failed to create journal entries: ${journalResult.error}`)
    }

    return NextResponse.json(
      { revenue: updatedRevenue, message: 'Payment recorded successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Record payment error:', error)
    return NextResponse.json(
      { error: 'Failed to record payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



