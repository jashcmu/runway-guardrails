import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Razorpay Payment Callback Handler
 * Redirects user after payment completion
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const paymentLinkId = searchParams.get('razorpay_payment_link_id')
    const paymentLinkStatus = searchParams.get('razorpay_payment_link_status')
    const paymentLinkReferenceId = searchParams.get('razorpay_payment_link_reference_id')

    console.log(`📥 Payment callback: ${paymentLinkStatus} for reference ${paymentLinkReferenceId}`)

    if (paymentLinkStatus === 'paid') {
      // Payment successful
      const successUrl = new URL('/dashboard/invoices', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      successUrl.searchParams.set('payment', 'success')
      successUrl.searchParams.set('reference', paymentLinkReferenceId || '')
      return NextResponse.redirect(successUrl)
    } else {
      // Payment failed or cancelled
      const failureUrl = new URL('/dashboard/invoices', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      failureUrl.searchParams.set('payment', 'failed')
      failureUrl.searchParams.set('reference', paymentLinkReferenceId || '')
      return NextResponse.redirect(failureUrl)
    }
  } catch (error) {
    console.error('Payment callback error:', error)
    // Redirect to dashboard with error
    const errorUrl = new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    errorUrl.searchParams.set('error', 'payment_callback_failed')
    return NextResponse.redirect(errorUrl)
  }
}

export async function POST(request: NextRequest) {
  // Handle POST callback (if configured)
  return GET(request)
}



