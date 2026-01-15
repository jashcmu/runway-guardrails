import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { processBankStatement } from '@/lib/enhanced-bank-parser'
import { processComprehensiveImport } from '@/lib/comprehensive-import-parser'

export async function POST(request: NextRequest) {
  // CRITICAL: Log immediately to verify function is called
  console.error('=== BANK UPLOAD API CALLED ===')
  console.error('Timestamp:', new Date().toISOString())
  
  try {
    const formData = await request.formData()
    console.error('FormData received')
    
    const file = formData.get('file') as File
    const companyId = formData.get('companyId') as string
    const bankAccountId = formData.get('bankAccountId') as string | undefined

    console.error('File:', file ? `${file.name} (${file.size} bytes)` : 'NULL')
    console.error('Company ID:', companyId || 'NULL')
    console.error('Bank Account ID:', bankAccountId || 'NULL')

    if (!file) {
      console.error('ERROR: No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!companyId) {
      console.error('ERROR: No companyId provided')
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isPDF = fileName.endsWith('.pdf')

    console.error(`File type check: CSV=${isCSV}, PDF=${isPDF}, fileName=${fileName}`)

    if (!isCSV && !isPDF) {
      console.error('ERROR: Unsupported file format')
      return NextResponse.json({ 
        error: 'Unsupported file format. Please upload CSV or PDF file.',
        hint: 'Accepted formats: .csv, .pdf'
      }, { status: 400 })
    }

    console.error(`📊 Processing ${isCSV ? 'CSV' : 'PDF'} file: ${file.name}`)

    let text = ''
    
    if (isCSV) {
      text = await file.text()
      console.error(`CSV text loaded: ${text.length} characters`)
    }
    
    // Detect CSV format by checking first line
    const firstLine = isCSV ? text.split('\n')[0].toLowerCase() : ''
    const isComprehensiveFormat = firstLine.includes('record_type')
    
    console.error(`Format detection: comprehensive=${isComprehensiveFormat}, firstLine=${firstLine.substring(0, 100)}`)
    
    if (isComprehensiveFormat) {
      console.error('Using comprehensive import parser')
      // Use comprehensive import parser for multi-record format
      const result = await processComprehensiveImport(text, companyId)
      
      console.error(`✅ Comprehensive import processed successfully:
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
      // Use bank statement parser for CSV or PDF
      console.error(`\n🚀 Starting bank statement processing...`)
      console.error(`   File: ${file.name}`)
      console.error(`   Type: ${isCSV ? 'CSV' : 'PDF'}`)
      console.error(`   Company ID: ${companyId}`)
      console.error(`   File size: ${file.size} bytes`)
      
      if (isCSV) {
        console.error(`   CSV preview (first 200 chars): ${text.substring(0, 200)}`)
      }
      
      let result
      try {
        if (isCSV) {
          console.error(`📄 Calling processBankStatement with CSV text (${text.length} chars)`)
          result = await processBankStatement(text, companyId, bankAccountId)
        } else {
          const buffer = await file.arrayBuffer().then(buf => Buffer.from(buf))
          console.error(`📄 Calling processBankStatement with PDF buffer (${buffer.length} bytes)`)
          result = await processBankStatement(buffer, companyId, bankAccountId, true)
        }
        
        console.error(`\n📊 Processing Result:`)
        console.error(`   - newTransactions: ${result.newTransactions}`)
        console.error(`   - billsPaid: ${result.billsPaid}`)
        console.error(`   - invoicesPaid: ${result.invoicesPaid}`)
        console.error(`   - cashBalanceChange: ${result.cashBalanceChange}`)
        console.error(`   - newCashBalance: ${result.newCashBalance}`)
        console.error(`   - duplicatesSkipped: ${result.duplicatesSkipped}`)
        console.error(`   - needsReviewCount: ${result.needsReviewCount}`)
        console.error(`   - transactions array length: ${result.transactions.length}`)
        
        if (result.newTransactions === 0) {
          console.error(`⚠️ WARNING: 0 transactions created! This might indicate a parsing issue.`)
        }
        
      } catch (processError) {
        console.error(`❌ Error in processBankStatement:`, processError)
        console.error(`Error stack:`, processError instanceof Error ? processError.stack : 'No stack')
        throw processError
      }

      console.error(`✅ Returning success response with ${result.newTransactions} transactions`)
      
      return NextResponse.json({
        success: true,
        message: `${isCSV ? 'CSV' : 'PDF'} bank statement processed successfully! All transactions auto-categorized.`,
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
    console.error('=== BANK IMPORT ERROR ===')
    console.error('Error:', error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
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

