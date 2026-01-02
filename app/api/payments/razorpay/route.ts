import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initializeRazorpay } from '@/lib/razorpay-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, companyId, invoiceId, amount, customerInfo } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const razorpay = initializeRazorpay()
    if (!razorpay) {
      return NextResponse.json({
        error: 'Razorpay not configured',
        message: 'Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables',
      }, { status: 503 })
    }

    if (action === 'create_payment_link') {
      // Create payment link for an invoice
      if (!invoiceId) {
        return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      })

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      const balanceAmount = invoice.balanceAmount || (invoice.totalAmount - (invoice.paidAmount || 0))

      if (balanceAmount <= 0) {
        return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
      }

      // Create payment link
      const paymentLink = await razorpay.createPaymentLink({
        amount: balanceAmount,
        currency: 'INR',
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
        customer: {
          name: customerInfo?.name || invoice.customerName,
          email: customerInfo?.email,
          contact: customerInfo?.phone,
        },
        reference_id: invoice.invoiceNumber,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payments/razorpay/callback`,
      })

      // Update invoice with payment link
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'sent',
        },
      })

      return NextResponse.json({
        success: true,
        paymentLink: paymentLink.short_url,
        paymentLinkId: paymentLink.id,
        amount: balanceAmount,
        message: 'Payment link created successfully',
      })
    } else if (action === 'create_order') {
      // Create order for checkout integration
      const orderAmount = amount || 0
      if (orderAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
      }

      const order = await razorpay.createOrder(
        orderAmount,
        'INR',
        invoiceId || `order_${Date.now()}`
      )

      return NextResponse.json({
        success: true,
        orderId: order.id,
        amount: order.amount / 100, // Convert back to rupees
        currency: order.currency,
      })
    } else if (action === 'verify_payment') {
      // Verify payment signature
      const { orderId, paymentId, signature } = body

      if (!orderId || !paymentId || !signature) {
        return NextResponse.json({
          error: 'Missing required fields: orderId, paymentId, signature',
        }, { status: 400 })
      }

      const isValid = razorpay.verifyPaymentSignature(orderId, paymentId, signature)

      if (!isValid) {
        return NextResponse.json({
          success: false,
          message: 'Invalid payment signature',
        }, { status: 400 })
      }

      // Fetch payment details
      const payment = await razorpay.getPayment(paymentId)

      return NextResponse.json({
        success: true,
        payment,
        message: 'Payment verified successfully',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Razorpay payment error:', error)
    return NextResponse.json(
      {
        error: 'Payment processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
    }

    const razorpay = initializeRazorpay()
    if (!razorpay) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
    }

    const payment = await razorpay.getPayment(paymentId)

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Razorpay get payment error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}



