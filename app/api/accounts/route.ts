import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initializeChartOfAccounts, getAllAccounts, getAccountsByType } from '@/lib/accounting/chart-of-accounts'

// GET - Fetch Chart of Accounts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const type = searchParams.get('type') // Optional: filter by type

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Initialize chart of accounts if not exists
    await initializeChartOfAccounts(companyId)

    // Get accounts
    const accounts = type 
      ? await getAccountsByType(companyId, type)
      : await getAllAccounts(companyId)

    return NextResponse.json({ accounts }, { status: 200 })
  } catch (error) {
    console.error('Get accounts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create default chart of accounts or custom account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, accountCode, name, type, subtype, category, accountGroup, isGSTApplicable } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // If only companyId is provided, initialize default chart of accounts
    if (!accountCode && !name && !type) {
      console.log('🎯 Initializing default chart of accounts...')
      await initializeChartOfAccounts(companyId)
      
      // Fetch all created accounts
      const accounts = await getAllAccounts(companyId)
      
      return NextResponse.json(
        { 
          message: `Successfully created ${accounts.length} default accounts`,
          accounts,
          count: accounts.length
        },
        { status: 201 }
      )
    }

    // Otherwise, create a custom account
    if (!accountCode || !name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields for custom account: accountCode, name, type' },
        { status: 400 }
      )
    }

    // Check if account code already exists
    const existing = await prisma.accountingAccount.findFirst({
      where: {
        companyId,
        accountCode,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `Account code ${accountCode} already exists` },
        { status: 400 }
      )
    }

    // Create account
    const account = await prisma.accountingAccount.create({
      data: {
        companyId,
        accountCode,
        name,
        type,
        subtype,
        category,
        accountGroup,
        isGSTApplicable: isGSTApplicable || false,
        balance: 0,
        isActive: true,
      },
    })

    return NextResponse.json({ account, message: 'Account created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Create account error:', error)
    return NextResponse.json(
      { error: 'Failed to create account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

