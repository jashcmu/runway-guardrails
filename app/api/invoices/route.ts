import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoicePDF } from '@/lib/invoice-generator'
import { createRevenueJournalEntry, initializeChartOfAccounts } from '@/lib/accounting/journal-entries'
import { updateCashOnInvoicePaid } from '@/lib/cash-sync'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      orderBy: { invoiceDate: 'desc' },
    })

    return NextResponse.json({ invoices }, { status: 200 })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyId,
      invoiceNumber,
      customerName,
      customerGSTIN,
      amount,
      gstRate,
      invoiceDate,
      dueDate,
      items,
      hsnSacCodes,
      placeOfSupply,
      isInterState,
    } = body

    if (!companyId || !invoiceNumber || !customerName || !amount || !gstRate) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, invoiceNumber, customerName, amount, gstRate' },
        { status: 400 }
      )
    }

    // Calculate GST amounts
    const gstAmount = (parseFloat(amount) * parseInt(gstRate)) / 100
    let cgst = 0
    let sgst = 0
    let igst = 0

    if (isInterState) {
      igst = gstAmount
    } else {
      cgst = gstAmount / 2
      sgst = gstAmount / 2
    }

    const totalAmount = parseFloat(amount) + gstAmount

    // Ensure chart of accounts is initialized
    await initializeChartOfAccounts(companyId)

    // Create invoice with proper AR tracking
    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        customerName,
        customerGSTIN: customerGSTIN || null,
        amount: parseFloat(amount),
        gstRate: parseInt(gstRate),
        gstAmount,
        cgst,
        sgst,
        igst,
        totalAmount,
        isInterState: isInterState || false,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'sent', // Start as sent/unpaid
        paidAmount: 0,
        balanceAmount: totalAmount, // Full balance outstanding
        items: items ? JSON.stringify(items) : null,
        hsnSacCodes: hsnSacCodes ? JSON.stringify(hsnSacCodes) : null,
        placeOfSupply: placeOfSupply || null,
      },
    })

    // Create revenue record
    const revenue = await prisma.revenue.create({
      data: {
        companyId,
        invoiceId: invoice.id,
        amount: totalAmount,
        date: invoice.invoiceDate,
        description: `Invoice ${invoiceNumber} - ${customerName}`,
        gstRate: parseInt(gstRate),
        gstAmount,
        amountReceived: 0,
        status: 'pending',
      },
    })

    // Create journal entries for the invoice/revenue
    const journalResult = await createRevenueJournalEntry(
      companyId,
      revenue.id,
      invoice.id,
      totalAmount,
      `Invoice ${invoiceNumber} - ${customerName}`,
      invoice.invoiceDate,
      gstAmount
    )

    if (!journalResult.success) {
      console.warn(`⚠ Failed to create journal entries: ${journalResult.error}`)
    }

    return NextResponse.json({ invoice, revenue }, { status: 201 })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, action, paymentAmount } = body

    if (!invoiceId || !action) {
      return NextResponse.json(
        { error: 'Invoice ID and action are required' },
        { status: 400 }
      )
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (action === 'mark_paid' || action === 'record_payment') {
      const payAmount = parseFloat(paymentAmount || invoice.totalAmount)
      const currentPaid = invoice.paidAmount || 0
      const newPaidAmount = currentPaid + payAmount
      const balanceAmount = invoice.totalAmount - newPaidAmount
      
      // Determine status
      let status = invoice.status
      if (balanceAmount <= 0) {
        status = 'paid'
      } else if (newPaidAmount > 0) {
        status = 'partial'
      }
      
      // Update invoice
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, balanceAmount),
          status,
          paidDate: balanceAmount <= 0 ? new Date() : null,
        },
      })
      
      // Use cash sync service to update cash balance and runway
      const syncResult = await updateCashOnInvoicePaid(
        invoice.companyId,
        invoiceId,
        payAmount
      )
      
      // Update revenue record if exists
      await prisma.revenue.updateMany({
        where: { invoiceId },
        data: {
          status: balanceAmount <= 0 ? 'received' : 'partial',
          amountReceived: newPaidAmount,
        },
      })
      
      // Create transaction record for the payment
      await prisma.transaction.create({
        data: {
          companyId: invoice.companyId,
          amount: payAmount,
          category: 'G_A' as any,
          description: `Payment received for invoice ${invoice.invoiceNumber}`,
          date: new Date(),
          currency: 'INR',
          vendorName: invoice.customerName,
        },
      })
      
      return NextResponse.json({
        invoice: updatedInvoice,
        cashBalance: syncResult.newCashBalance,
        runway: syncResult.runway,
        message: balanceAmount <= 0 ? 'Invoice fully paid' : `Partial payment recorded. Balance: ₹${balanceAmount.toFixed(2)}`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Update invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

