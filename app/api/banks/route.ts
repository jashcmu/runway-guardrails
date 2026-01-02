import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processBankStatement } from '@/lib/enhanced-bank-parser'
import { processComprehensiveImport } from '@/lib/comprehensive-import-parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const companyId = formData.get('companyId') as string
    const bankAccountId = formData.get('bankAccountId') as string | undefined

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Only process CSV for now
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ 
        error: 'Please upload CSV file. PDF support coming soon.',
        hint: 'Export your bank statement as CSV from your bank portal'
      }, { status: 400 })
    }

    const text = await file.text()
    
    // Detect CSV format by checking first line
    const firstLine = text.split('\n')[0].toLowerCase()
    const isComprehensiveFormat = firstLine.includes('record_type')
    
    console.log(`📊 Processing ${isComprehensiveFormat ? 'comprehensive' : 'bank statement'} import...`)
    
    if (isComprehensiveFormat) {
      // Use comprehensive import parser for multi-record format
      const result = await processComprehensiveImport(text, companyId)
      
      console.log(`✅ Comprehensive import processed successfully:
        - Invoices Created: ${result.invoicesCreated}
        - Bills Created: ${result.billsCreated}
        - Transactions: ${result.transactionsCreated}
        - Payments Linked: ${result.paymentsLinked}
        - Cash Change: ₹${result.cashBalanceChange}
        - New Cash Balance: ₹${result.newCashBalance}
        - Errors: ${result.errors.length}
      `)

      return NextResponse.json({
        success: true,
        message: 'Comprehensive import successful! Created invoices, bills, and linked transactions.',
        summary: {
          invoicesCreated: result.invoicesCreated,
          billsCreated: result.billsCreated,
          transactionsCreated: result.transactionsCreated,
          paymentsLinked: result.paymentsLinked,
          cashBalanceChange: result.cashBalanceChange,
          newCashBalance: result.newCashBalance,
          errors: result.errors,
        },
      }, { status: 200 })
    } else {
      // Use bank statement parser for traditional format
      const result = await processBankStatement(text, companyId, bankAccountId)
      
      console.log(`✅ Bank statement processed successfully:
        - Transactions: ${result.newTransactions}
        - Bills Paid: ${result.billsPaid}
        - Invoices Received: ${result.invoicesPaid}
        - Cash Change: ₹${result.cashBalanceChange}
        - New Cash Balance: ₹${result.newCashBalance}
      `)

      return NextResponse.json({
        success: true,
        message: 'Bank statement processed successfully! All transactions auto-categorized.',
        summary: {
          transactionsCreated: result.newTransactions,
          billsMarkedPaid: result.billsPaid,
          invoicesMarkedPaid: result.invoicesPaid,
          cashBalanceChange: result.cashBalanceChange,
          newCashBalance: result.newCashBalance,
        },
        transactions: result.transactions.map(t => ({
          date: t.transaction.date,
          description: t.transaction.description,
          amount: t.transaction.credit > 0 ? t.transaction.credit : -t.transaction.debit,
          type: t.matchType,
          category: t.category,
          matchedId: t.matchedId,
        })),
      }, { status: 200 })
    }

  } catch (error) {
    console.error('Bank import error:', error)
    return NextResponse.json({
      error: 'Failed to import bank statement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Get recent bank imports (could track this in a separate table)
    // For now, return recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      recentImports: recentTransactions.map(t => ({
        date: t.date,
        amount: t.amount,
        description: t.description,
      })),
    }, { status: 200 })
  } catch (error) {
    console.error('Get bank imports error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bank imports' },
      { status: 500 }
    )
  }
}

