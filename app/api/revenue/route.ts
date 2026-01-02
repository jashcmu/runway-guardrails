import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRevenueJournalEntry, createPaymentReceivedJournalEntry, initializeChartOfAccounts } from '@/lib/accounting/journal-entries'

// POST - Create revenue record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, invoiceId, amount, date, description, gstRate, gstAmount } = body

    if (!companyId || !amount || !date || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, amount, date, description' },
        { status: 400 }
      )
    }

    // Ensure chart of accounts is initialized
    await initializeChartOfAccounts(companyId)

    // Create revenue record
    const revenue = await prisma.revenue.create({
      data: {
        companyId,
        invoiceId: invoiceId || null,
        amount,
        date: new Date(date),
        description,
        gstRate: gstRate || 0,
        gstAmount: gstAmount || 0,
        amountReceived: 0,
        status: 'pending',
      },
    })

    // Create journal entries
    const journalResult = await createRevenueJournalEntry(
      companyId,
      revenue.id,
      invoiceId || null,
      amount,
      description,
      new Date(date),
      gstAmount
    )

    if (!journalResult.success) {
      console.warn(`⚠ Failed to create journal entries: ${journalResult.error}`)
    }

    return NextResponse.json(
      { revenue, message: 'Revenue created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create revenue error:', error)
    return NextResponse.json(
      { error: 'Failed to create revenue', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET - Fetch revenue records
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status') // pending, partial, paid

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const revenues = await prisma.revenue.findMany({
      where: {
        companyId,
        ...(status && { status }),
      },
      include: {
        invoice: true,
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ revenues }, { status: 200 })
  } catch (error) {
    console.error('Fetch revenue error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}




