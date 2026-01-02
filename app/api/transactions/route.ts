import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'
import { categorizeExpense } from '@/lib/categorize'
import { createExpenseJournalEntry, initializeChartOfAccounts } from '@/lib/accounting/journal-entries'

// POST - Create a new transaction (expense)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, date, description, amount, category, type, expenseType, frequency } = body

    // Validate required fields
    if (!companyId || !date || !description || amount === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, date, description, amount, category' },
        { status: 400 }
      )
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = Object.values(Category)
    if (!validCategories.includes(category as Category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate expense type
    const validExpenseTypes = ['one-time', 'recurring']
    const finalExpenseType = expenseType || 'recurring'
    if (!validExpenseTypes.includes(finalExpenseType)) {
      return NextResponse.json(
        { error: `Invalid expenseType. Must be 'one-time' or 'recurring'` },
        { status: 400 }
      )
    }

    // Validate frequency for recurring expenses
    const validFrequencies = ['monthly', 'quarterly', 'yearly', 'weekly']
    const finalFrequency = frequency || 'monthly'
    if (finalExpenseType === 'recurring' && !validFrequencies.includes(finalFrequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be: ${validFrequencies.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Calculate next due date for recurring expenses
    let nextDueDate = null
    if (finalExpenseType === 'recurring') {
      const transactionDate = new Date(date)
      switch (finalFrequency) {
        case 'monthly':
          nextDueDate = new Date(transactionDate.setMonth(transactionDate.getMonth() + 1))
          break
        case 'quarterly':
          nextDueDate = new Date(transactionDate.setMonth(transactionDate.getMonth() + 3))
          break
        case 'yearly':
          nextDueDate = new Date(transactionDate.setFullYear(transactionDate.getFullYear() + 1))
          break
        case 'weekly':
          nextDueDate = new Date(transactionDate.setDate(transactionDate.getDate() + 7))
          break
      }
    }

    // AUTO-CATEGORIZE if description is provided
    let finalCategory = category as Category
    if (description) {
      finalCategory = categorizeExpense(description)
      console.log(`✓ Auto-categorized "${description}" → ${finalCategory}`)
    }

    // Ensure chart of accounts is initialized
    await initializeChartOfAccounts(companyId)

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        companyId,
        date: new Date(date),
        description,
        amount: parseFloat(amount.toString()),
        category: finalCategory, // Use auto-categorized
        currency: 'INR',
        expenseType: finalExpenseType,
        frequency: finalExpenseType === 'recurring' ? finalFrequency : null,
        nextDueDate,
        gstRate: 0,
      },
    })

    // UPDATE CASH BALANCE AUTOMATICALLY
    // Expenses are negative (reduce cash), Revenue is positive (increase cash)
    const cashImpact = transaction.amount
    await prisma.company.update({
      where: { id: companyId },
      data: {
        cashBalance: {
          increment: cashImpact
        }
      }
    })

    console.log(`💰 Cash balance updated: ${cashImpact > 0 ? '+' : ''}₹${cashImpact.toLocaleString()}`)

    // Create journal entries for double-entry accounting
    const journalResult = await createExpenseJournalEntry(
      companyId,
      transaction.id,
      transaction.amount,
      finalCategory,
      description,
      new Date(date),
      transaction.gstAmount || undefined
    )

    if (!journalResult.success) {
      console.warn(`⚠ Failed to create journal entries: ${journalResult.error}`)
      // Don't fail the transaction creation, just log the warning
    }

    return NextResponse.json(
      { 
        transaction, 
        message: 'Transaction added successfully. Cash balance updated.' 
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET - Fetch transactions for a company
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      )
    }

    const transactions = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      take: 100, // Limit to last 100 transactions
    })

    return NextResponse.json({ transactions }, { status: 200 })
  } catch (error) {
    console.error('Fetch transactions error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

