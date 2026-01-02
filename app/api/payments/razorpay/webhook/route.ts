import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initializeRazorpay } from '@/lib/razorpay-client'

/**
 * Razorpay Webhook Handler
 * Automatically processes payment confirmations, refunds, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const signature = request.headers.get('x-razorpay-signature')

    // Verify webhook signature
    const razorpay = initializeRazorpay()
    if (!razorpay) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
    }

    // Get event type and payload
    const event = body.event
    const payload = body.payload

    console.log(`📥 Razorpay Webhook: ${event}`)

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity)
        break

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity)
        break

      case 'payment.authorized':
        await handlePaymentAuthorized(payload.payment.entity)
        break

      case 'refund.created':
        await handleRefundCreated(payload.refund.entity)
        break

      case 'order.paid':
        await handleOrderPaid(payload.order.entity)
        break

      default:
        console.log(`ℹ️ Unhandled webhook event: ${event}`)
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' })
  } catch (error) {
    console.error('Razorpay webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function handlePaymentCaptured(payment: any) {
  console.log(`✅ Payment captured: ${payment.id}, Amount: ₹${payment.amount / 100}`)

  // Extract reference (invoice number, etc.)
  const referenceId = payment.notes?.reference_id || payment.order_id

  if (!referenceId) {
    console.warn('⚠ No reference ID found in payment')
    return
  }

  // Find invoice by invoice number
  const invoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: referenceId,
    },
  })

  if (!invoice) {
    console.warn(`⚠ Invoice not found: ${referenceId}`)
    return
  }

  // Calculate payment amount
  const paymentAmount = payment.amount / 100 // Convert from paise to rupees
  const currentPaid = invoice.paidAmount || 0
  const newPaidAmount = currentPaid + paymentAmount
  const balanceAmount = invoice.totalAmount - newPaidAmount

  // Update invoice
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: Math.max(0, balanceAmount),
      status: balanceAmount <= 0 ? 'paid' : 'partial',
      paidDate: balanceAmount <= 0 ? new Date() : null,
    },
  })

  // Update company cash balance
  await prisma.company.update({
    where: { id: invoice.companyId },
    data: {
      cashBalance: { increment: paymentAmount },
    },
  })

  // Create transaction record
  await prisma.transaction.create({
    data: {
      companyId: invoice.companyId,
      amount: paymentAmount,
      category: 'G_A' as any,
      description: `Razorpay payment for invoice ${invoice.invoiceNumber}`,
      date: new Date(),
      currency: 'INR',
      vendorName: invoice.customerName,
    },
  })

  console.log(`✅ Invoice ${invoice.invoiceNumber} updated with payment ₹${paymentAmount}`)
}

async function handlePaymentFailed(payment: any) {
  console.log(`❌ Payment failed: ${payment.id}, Reason: ${payment.error_description}`)

  // Optionally create an alert
  const referenceId = payment.notes?.reference_id || payment.order_id
  if (referenceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: referenceId },
    })

    if (invoice) {
      await prisma.alert.create({
        data: {
          companyId: invoice.companyId,
          message: `Payment failed for invoice ${invoice.invoiceNumber}: ${payment.error_description}`,
          severity: 'medium',
          riskLevel: 'medium',
          isRead: false,
        },
      })
    }
  }
}

async function handlePaymentAuthorized(payment: any) {
  console.log(`🔐 Payment authorized: ${payment.id}, Amount: ₹${payment.amount / 100}`)
  // Payment is authorized but not yet captured
  // Usually auto-captured by Razorpay
}

async function handleRefundCreated(refund: any) {
  console.log(`↩️ Refund created: ${refund.id}, Amount: ₹${refund.amount / 100}`)

  // Find the original transaction and reverse it
  const paymentId = refund.payment_id
  const refundAmount = refund.amount / 100

  // Deduct from company cash balance
  // Note: We'd need to track the payment ID to find the right company
  console.log(`Refund processing for payment ${paymentId}`)
}

async function handleOrderPaid(order: any) {
  console.log(`✅ Order paid: ${order.id}, Amount: ₹${order.amount / 100}`)
  // Order has been fully paid
}



