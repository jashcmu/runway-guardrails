import { NextRequest, NextResponse } from 'next/server'
import { createJournalEntries, getJournalEntries } from '@/lib/accounting/journal-entries'

// GET - Fetch journal entries
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const journalEntries = await getJournalEntries(
      companyId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )

    return NextResponse.json({ journalEntries }, { status: 200 })
  } catch (error) {
    console.error('Get journal entries error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create manual journal entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, date, description, reference, notes, entries } = body

    if (!companyId || !date || !description || !entries) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, date, description, entries' },
        { status: 400 }
      )
    }

    const result = await createJournalEntries({
      companyId,
      date: new Date(date),
      description,
      reference,
      notes,
      entries,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      { journalEntries: result.journalEntries, message: 'Journal entries created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create journal entry error:', error)
    return NextResponse.json(
      { error: 'Failed to create journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



