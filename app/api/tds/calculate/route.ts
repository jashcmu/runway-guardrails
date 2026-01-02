import { NextResponse } from 'next/server'

/**
 * TDS Calculator & Automation
 * Calculate TDS based on Indian tax laws
 */

// TDS rates by section
const TDS_RATES: { [key: string]: { rate: number; description: string; threshold: number } } = {
  '194C': { rate: 1, description: 'Payment to contractors', threshold: 30000 },
  '194H': { rate: 5, description: 'Commission or brokerage', threshold: 15000 },
  '194I': { rate: 10, description: 'Rent - Plant & Machinery', threshold: 240000 },
  '194IA': { rate: 1, description: 'Transfer of immovable property', threshold: 5000000 },
  '194J': { rate: 10, description: 'Professional/technical services', threshold: 30000 },
  '194LA': { rate: 10, description: 'Compensation on land acquisition', threshold: 250000 },
  '194M': { rate: 5, description: 'Payment to contractors/professionals (small business)', threshold: 5000000 },
  '194O': { rate: 1, description: 'E-commerce participants', threshold: 500000 },
  '195': { rate: 10, description: 'Payment to non-residents', threshold: 0 },
}

// Calculate TDS
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      amount,
      section,
      panAvailable,
      vendorType, // individual, company, professional, contractor
    } = body

    if (!amount || !section) {
      return NextResponse.json(
        { error: 'Amount and TDS section required' },
        { status: 400 }
      )
    }

    const tdsInfo = TDS_RATES[section]
    
    if (!tdsInfo) {
      return NextResponse.json(
        { error: 'Invalid TDS section' },
        { status: 400 }
      )
    }

    // Check if amount exceeds threshold
    if (amount < tdsInfo.threshold) {
      return NextResponse.json({
        tdsRequired: false,
        message: `No TDS required. Amount ₹${amount} is below threshold of ₹${tdsInfo.threshold}`,
        amount,
        threshold: tdsInfo.threshold,
      })
    }

    // Calculate TDS rate
    let tdsRate = tdsInfo.rate
    
    // If PAN not available, TDS rate is 20% (higher rate)
    if (!panAvailable) {
      tdsRate = 20
    }

    // Calculate TDS amount
    const tdsAmount = (amount * tdsRate) / 100
    const netPayable = amount - tdsAmount

    return NextResponse.json({
      tdsRequired: true,
      section,
      description: tdsInfo.description,
      grossAmount: amount,
      tdsRate,
      tdsAmount: Math.round(tdsAmount * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
      panAvailable,
      threshold: tdsInfo.threshold,
      notes: generateTDSNotes(section, panAvailable, vendorType),
    })
  } catch (error) {
    console.error('TDS calculation error:', error)
    return NextResponse.json(
      { error: 'Calculation failed' },
      { status: 500 }
    )
  }
}

// Get all TDS sections and rates
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let sections = Object.entries(TDS_RATES).map(([section, info]) => ({
      section,
      ...info,
    }))

    if (search) {
      sections = sections.filter(
        s =>
          s.section.includes(search.toUpperCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase())
      )
    }

    return NextResponse.json({
      sections,
      note: 'Rates are for FY 2024-25. Always consult a CA for accurate calculations.',
    })
  } catch (error) {
    console.error('Get TDS sections error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch TDS sections' },
      { status: 500 }
    )
  }
}

function generateTDSNotes(section: string, panAvailable: boolean, vendorType?: string): string[] {
  const notes: string[] = []

  if (!panAvailable) {
    notes.push('⚠️ TDS rate is 20% because PAN is not available')
    notes.push('Collect PAN from vendor to reduce TDS rate')
  }

  // Section-specific notes
  switch (section) {
    case '194C':
      notes.push('Applies to payments to contractors')
      notes.push('Single payment threshold: ₹30,000')
      notes.push('Aggregate threshold: ₹1,00,000 per year')
      break
    case '194J':
      notes.push('Applies to professional/technical services')
      notes.push('Includes: CA, lawyers, consultants, freelancers')
      notes.push('Threshold: ₹30,000 per year')
      break
    case '194H':
      notes.push('Applies to commission or brokerage payments')
      notes.push('Threshold: ₹15,000 per year')
      break
    case '194I':
      notes.push('Applies to rent payments')
      notes.push('Different rates for plant/machinery vs land/building')
      break
    case '195':
      notes.push('⚠️ Applies to non-resident payments')
      notes.push('May require Form 15CA/15CB certificate')
      notes.push('Consult CA before payment')
      break
  }

  notes.push('💡 File TDS return quarterly: Q1 (July 31), Q2 (Oct 31), Q3 (Jan 31), Q4 (May 31)')
  notes.push('💡 Issue Form 16A to vendor after TDS payment')

  return notes
}

// Suggest TDS section based on description
export async function PUT(request: Request) {
  try {
    const { description, amount, vendorType } = await request.json()

    if (!description) {
      return NextResponse.json(
        { error: 'Description required' },
        { status: 400 }
      )
    }

    const suggestions = suggestTDSSection(description, vendorType)

    return NextResponse.json({
      suggestions,
      message: 'Review suggestions and select appropriate TDS section',
    })
  } catch (error) {
    console.error('TDS suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to suggest section' },
      { status: 500 }
    )
  }
}

function suggestTDSSection(description: string, vendorType?: string): any[] {
  const desc = description.toLowerCase()
  const suggestions: any[] = []

  // Keyword-based matching
  if (desc.includes('rent') || desc.includes('lease')) {
    suggestions.push({
      section: '194I',
      confidence: 90,
      reason: 'Keywords: rent/lease detected',
      ...TDS_RATES['194I'],
    })
  }

  if (
    desc.includes('professional') ||
    desc.includes('consultant') ||
    desc.includes('freelance') ||
    desc.includes('developer') ||
    desc.includes('designer')
  ) {
    suggestions.push({
      section: '194J',
      confidence: 85,
      reason: 'Keywords: professional services detected',
      ...TDS_RATES['194J'],
    })
  }

  if (
    desc.includes('contractor') ||
    desc.includes('vendor') ||
    desc.includes('supplier')
  ) {
    suggestions.push({
      section: '194C',
      confidence: 75,
      reason: 'Keywords: contractor/vendor detected',
      ...TDS_RATES['194C'],
    })
  }

  if (desc.includes('commission') || desc.includes('brokerage')) {
    suggestions.push({
      section: '194H',
      confidence: 90,
      reason: 'Keywords: commission/brokerage detected',
      ...TDS_RATES['194H'],
    })
  }

  // Vendor type based
  if (vendorType === 'professional') {
    suggestions.push({
      section: '194J',
      confidence: 80,
      reason: 'Vendor type: professional',
      ...TDS_RATES['194J'],
    })
  } else if (vendorType === 'contractor') {
    suggestions.push({
      section: '194C',
      confidence: 80,
      reason: 'Vendor type: contractor',
      ...TDS_RATES['194C'],
    })
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence)

  // If no matches, suggest most common
  if (suggestions.length === 0) {
    suggestions.push({
      section: '194J',
      confidence: 50,
      reason: 'Default suggestion (most common for startups)',
      ...TDS_RATES['194J'],
    })
  }

  return suggestions
}



