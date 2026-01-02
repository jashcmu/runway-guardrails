// Comprehensive Financial Data Import Parser
// Handles: INVOICE, BILL, TRANSACTION, INVOICE_PAYMENT, BILL_PAYMENT records
import { PrismaClient, Category } from '@prisma/client'
import Papa from 'papaparse'

const prisma = new PrismaClient()

type RecordType = 'INVOICE' | 'BILL' | 'TRANSACTION' | 'INVOICE_PAYMENT' | 'BILL_PAYMENT'

interface ImportRow {
  record_type: RecordType
  date?: string
  description?: string
  amount: number
  currency: string
  counterparty?: string
  category?: string
  reference_id?: string
  invoice_id?: string
  bill_id?: string
  due_date?: string
  issue_date?: string
  status?: string
  payment_method?: string
  matched_transaction_ref?: string
  notes?: string
}

interface ImportSummary {
  invoicesCreated: number
  billsCreated: number
  transactionsCreated: number
  paymentsLinked: number
  cashBalanceChange: number
  newCashBalance: number
  errors: string[]
}

export async function processComprehensiveImport(
  fileContent: string,
  companyId: string
): Promise<ImportSummary> {
  console.log('📊 Processing comprehensive import...')
  
  // Parse CSV
  const parsedData = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
  }) as Papa.ParseResult<any>

  const summary: ImportSummary = {
    invoicesCreated: 0,
    billsCreated: 0,
    transactionsCreated: 0,
    paymentsLinked: 0,
    cashBalanceChange: 0,
    newCashBalance: 0,
    errors: [],
  }

  // Maps to track created records
  const invoiceMap = new Map<string, string>() // invoice_id -> db id
  const billMap = new Map<string, string>() // bill_id -> db id
  const transactionMap = new Map<string, string>() // reference_id -> db id

  // Get company's current cash balance
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { cashBalance: true },
  })
  const oldCashBalance = company?.cashBalance || 0

  // Process in order: INVOICE, BILL, TRANSACTION, INVOICE_PAYMENT, BILL_PAYMENT
  const rows: ImportRow[] = parsedData.data.map((row: any) => ({
    record_type: row.record_type,
    date: row.date,
    description: row.description,
    amount: parseFloat(row.amount || '0'),
    currency: row.currency || 'INR',
    counterparty: row.counterparty,
    category: row.category,
    reference_id: row.reference_id,
    invoice_id: row.invoice_id,
    bill_id: row.bill_id,
    due_date: row.due_date,
    issue_date: row.issue_date,
    status: row.status,
    payment_method: row.payment_method,
    matched_transaction_ref: row.matched_transaction_ref,
    notes: row.notes,
  }))

  // Phase 1: Create Invoices
  for (const row of rows.filter(r => r.record_type === 'INVOICE')) {
    try {
      // For INVOICES, use the invoice_id column
      const invoiceNumber = row.invoice_id || `INV-${Date.now()}`
      
      const invoice = await prisma.invoice.create({
        data: {
          companyId,
          invoiceNumber: invoiceNumber,
          customerName: row.counterparty || 'Unknown',
          amount: row.amount,
          gstRate: 0,
          gstAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalAmount: row.amount,
          paidAmount: 0,
          balanceAmount: row.amount,
          invoiceDate: row.issue_date ? new Date(row.issue_date) : new Date(),
          dueDate: row.due_date ? new Date(row.due_date) : null,
          status: row.status?.toLowerCase() || 'sent',
          isInterState: false,
        },
      })
      
      // Map the invoice number from CSV to database ID for linking payments
      invoiceMap.set(invoiceNumber, invoice.id)
      summary.invoicesCreated++
      console.log(`✅ Created invoice: ${invoiceNumber}`)
    } catch (error) {
      summary.errors.push(`Invoice ${row.invoice_id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Phase 2: Create Bills
  for (const row of rows.filter(r => r.record_type === 'BILL')) {
    try {
      const categoryMap: { [key: string]: Category } = {
        'CLOUD': Category.Cloud,
        'SAAS': Category.SaaS,
        'MARKETING': Category.Marketing,
        'HIRING': Category.Hiring,
        'GA': Category.G_A,
      }
      
      // For BILLS, use the reference_id column
      const billNumber = row.reference_id || `BILL-${Date.now()}`
      
      const bill = await prisma.bill.create({
        data: {
          companyId,
          billNumber: billNumber,
          vendorName: row.counterparty || 'Unknown',
          subtotal: row.amount,
          taxAmount: 0,
          totalAmount: row.amount,
          paidAmount: 0,
          balanceAmount: row.amount,
          billDate: row.issue_date ? new Date(row.issue_date) : new Date(),
          dueDate: row.due_date ? new Date(row.due_date) : null,
          paymentStatus: 'unpaid',
          status: row.status?.toLowerCase() || 'approved',
          originalFileUrl: '',
          uploadedBy: companyId,
          lineItems: [],
        },
      })
      
      // Map the bill number from CSV to database ID for linking payments
      billMap.set(billNumber, bill.id)
      summary.billsCreated++
      console.log(`✅ Created bill: ${billNumber}`)
    } catch (error) {
      summary.errors.push(`Bill ${row.reference_id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Phase 3: Create Transactions
  for (const row of rows.filter(r => r.record_type === 'TRANSACTION')) {
    try {
      if (!row.date) {
        console.log(`⏭️  Skipping transaction without date: ${row.description}`)
        continue
      }

      const categoryMap: { [key: string]: Category } = {
        'CLOUD': Category.Cloud,
        'SAAS': Category.SaaS,
        'MARKETING': Category.Marketing,
        'HIRING': Category.Hiring,
        'GA': Category.G_A,
        'REVENUE': Category.G_A,
      }

      const transaction = await prisma.transaction.create({
        data: {
          companyId,
          amount: row.amount, // Positive for revenue, negative for expenses
          category: categoryMap[row.category || 'GA'] || Category.G_A,
          description: row.description || row.counterparty || 'Transaction',
          date: new Date(row.date),
          currency: row.currency,
        },
      })
      
      if (row.reference_id) {
        transactionMap.set(row.reference_id, transaction.id)
      }
      
      // Update cash balance change
      summary.cashBalanceChange += row.amount
      summary.transactionsCreated++
      
      console.log(`✅ Created transaction: ${row.reference_id} - ${row.amount > 0 ? '+' : ''}₹${row.amount.toLocaleString()}`)
    } catch (error) {
      summary.errors.push(`Transaction ${row.reference_id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Phase 4: Link Invoice Payments
  for (const row of rows.filter(r => r.record_type === 'INVOICE_PAYMENT')) {
    try {
      const invoiceId = row.invoice_id ? invoiceMap.get(row.invoice_id) : null
      
      if (invoiceId) {
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
        if (invoice) {
          const newPaidAmount = (invoice.paidAmount || 0) + row.amount
          const newBalanceAmount = invoice.totalAmount - newPaidAmount
          const newStatus = newBalanceAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : invoice.status)
          
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: Math.max(0, newBalanceAmount),
              status: newStatus,
              paidDate: newStatus === 'paid' && row.date ? new Date(row.date) : null,
            },
          })
          
          summary.paymentsLinked++
          console.log(`✅ Linked payment to invoice: ${row.invoice_id} - ₹${row.amount.toLocaleString()}`)
        }
      }
    } catch (error) {
      summary.errors.push(`Invoice Payment ${row.reference_id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Phase 5: Link Bill Payments
  for (const row of rows.filter(r => r.record_type === 'BILL_PAYMENT')) {
    try {
      const billId = row.bill_id ? billMap.get(row.bill_id) : null
      
      if (billId) {
        const bill = await prisma.bill.findUnique({ where: { id: billId } })
        if (bill) {
          const newPaidAmount = (bill.paidAmount || 0) + row.amount
          const newBalanceAmount = bill.totalAmount - newPaidAmount
          const newStatus = newBalanceAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid')
          
          await prisma.bill.update({
            where: { id: billId },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: Math.max(0, newBalanceAmount),
              paymentStatus: newStatus,
              paymentDate: newStatus === 'paid' && row.date ? new Date(row.date) : null,
            },
          })
          
          summary.paymentsLinked++
          console.log(`✅ Linked payment to bill: ${row.bill_id} - ₹${row.amount.toLocaleString()}`)
        }
      }
    } catch (error) {
      summary.errors.push(`Bill Payment ${row.reference_id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update company cash balance
  const newCashBalance = oldCashBalance + summary.cashBalanceChange
  await prisma.company.update({
    where: { id: companyId },
    data: { cashBalance: newCashBalance },
  })
  
  summary.newCashBalance = newCashBalance

  console.log('📊 Import Summary:')
  console.log(`  - Invoices Created: ${summary.invoicesCreated}`)
  console.log(`  - Bills Created: ${summary.billsCreated}`)
  console.log(`  - Transactions Created: ${summary.transactionsCreated}`)
  console.log(`  - Payments Linked: ${summary.paymentsLinked}`)
  console.log(`  - Cash Balance Change: ${summary.cashBalanceChange > 0 ? '+' : ''}₹${summary.cashBalanceChange.toLocaleString()}`)
  console.log(`  - New Cash Balance: ₹${summary.newCashBalance.toLocaleString()}`)
  console.log(`  - Errors: ${summary.errors.length}`)

  return summary
}

