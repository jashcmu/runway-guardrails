import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

/**
 * Stripe & Razorpay Integration
 * Auto-sync revenue from payment gateways
 */

// Connect payment gateway
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, provider, apiKey, apiSecret } = body

    if (!companyId || !provider || !apiKey) {
      return NextResponse.json(
        { error: 'Company ID, provider, and API key required' },
        { status: 400 }
      )
    }

    if (!['stripe', 'razorpay'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Use "stripe" or "razorpay"' },
        { status: 400 }
      )
    }

    // Test connection
    const testResult = await testPaymentGateway(provider, apiKey, apiSecret)
    
    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error || 'Invalid credentials' },
        { status: 400 }
      )
    }

    // Save integration
    const integration = await prisma.integration.upsert({
      where: {
        companyId_provider: {
          companyId,
          provider,
        },
      },
      create: {
        companyId,
        provider,
        status: 'connected',
        apiKey, // TODO: Encrypt in production
        refreshToken: apiSecret, // TODO: Encrypt in production
        lastSyncAt: new Date(),
        syncFrequency: 'daily',
      },
      update: {
        status: 'connected',
        apiKey,
        refreshToken: apiSecret,
        lastSyncAt: new Date(),
      },
    })

    // Trigger initial sync
    await syncPaymentGateway(companyId, provider, apiKey, apiSecret)

    return NextResponse.json({
      success: true,
      integration,
      message: `${provider} connected successfully`,
    })
  } catch (error) {
    console.error('Connect payment gateway error:', error)
    return NextResponse.json(
      { error: 'Failed to connect payment gateway' },
      { status: 500 }
    )
  }
}

// Sync transactions from payment gateway
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const provider = searchParams.get('provider')

    if (!companyId || !provider) {
      return NextResponse.json(
        { error: 'Company ID and provider required' },
        { status: 400 }
      )
    }

    // Get integration
    const integration = await prisma.integration.findUnique({
      where: {
        companyId_provider: {
          companyId,
          provider,
        },
      },
    })

    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: `${provider} not connected` },
        { status: 400 }
      )
    }

    // Sync transactions
    const result = await syncPaymentGateway(
      companyId,
      provider,
      integration.apiKey || '',
      integration.refreshToken || ''
    )

    // Update last sync time
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sync payment gateway error:', error)
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    )
  }
}

// Disconnect payment gateway
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const provider = searchParams.get('provider')

    if (!companyId || !provider) {
      return NextResponse.json(
        { error: 'Company ID and provider required' },
        { status: 400 }
      )
    }

    await prisma.integration.update({
      where: {
        companyId_provider: {
          companyId,
          provider,
        },
      },
      data: {
        status: 'disconnected',
        apiKey: null,
        refreshToken: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${provider} disconnected`,
    })
  } catch (error) {
    console.error('Disconnect payment gateway error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect payment gateway' },
      { status: 500 }
    )
  }
}

async function testPaymentGateway(
  provider: string,
  apiKey: string,
  apiSecret?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (provider === 'stripe') {
      // Test Stripe connection
      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        return { success: false, error: 'Invalid Stripe API key' }
      }

      return { success: true }
    } else if (provider === 'razorpay') {
      // Test Razorpay connection
      if (!apiSecret) {
        return { success: false, error: 'Razorpay requires both key and secret' }
      }

      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
      
      const response = await fetch('https://api.razorpay.com/v1/payments', {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      })

      if (!response.ok) {
        return { success: false, error: 'Invalid Razorpay credentials' }
      }

      return { success: true }
    }

    return { success: false, error: 'Unsupported provider' }
  } catch (error) {
    return { success: false, error: 'Connection test failed' }
  }
}

async function syncPaymentGateway(
  companyId: string,
  provider: string,
  apiKey: string,
  apiSecret?: string
) {
  try {
    let transactions: any[] = []

    if (provider === 'stripe') {
      transactions = await fetchStripeTransactions(apiKey)
    } else if (provider === 'razorpay') {
      transactions = await fetchRazorpayTransactions(apiKey, apiSecret || '')
    }

    // Save transactions as revenue
    let imported = 0
    let skipped = 0

    for (const txn of transactions) {
      try {
        // Check if already imported
        const existing = await prisma.revenue.findFirst({
          where: {
            companyId,
            description: {
              contains: txn.externalId,
            },
          },
        })

        if (existing) {
          skipped++
          continue
        }

        // Create revenue record
        await prisma.revenue.create({
          data: {
            companyId,
            amount: txn.amount,
            date: txn.date,
            description: `${provider} payment ${txn.externalId}`,
            gstRate: 18, // Default GST
            gstAmount: txn.amount * 0.18,
            amountReceived: txn.amount,
            status: 'paid',
          },
        })

        imported++
      } catch (error) {
        console.error(`Failed to import transaction ${txn.externalId}:`, error)
        skipped++
      }
    }

    return {
      success: true,
      provider,
      imported,
      skipped,
      total: transactions.length,
      message: `Synced ${imported} transactions from ${provider}`,
    }
  } catch (error) {
    console.error('Sync error:', error)
    throw error
  }
}

async function fetchStripeTransactions(apiKey: string): Promise<any[]> {
  try {
    // Fetch last 30 days of payments
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

    const response = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${thirtyDaysAgo}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch Stripe transactions')
    }

    const data = await response.json()

    return data.data
      .filter((charge: any) => charge.paid && charge.status === 'succeeded')
      .map((charge: any) => ({
        externalId: charge.id,
        amount: charge.amount / 100, // Convert from cents
        date: new Date(charge.created * 1000),
        description: charge.description || 'Stripe payment',
        customerEmail: charge.billing_details?.email,
      }))
  } catch (error) {
    console.error('Fetch Stripe transactions error:', error)
    return []
  }
}

async function fetchRazorpayTransactions(
  apiKey: string,
  apiSecret: string
): Promise<any[]> {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

    // Fetch last 30 days of payments
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

    const response = await fetch(
      `https://api.razorpay.com/v1/payments?count=100`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch Razorpay transactions')
    }

    const data = await response.json()

    return data.items
      .filter((payment: any) => payment.status === 'captured')
      .filter((payment: any) => payment.created_at >= thirtyDaysAgo)
      .map((payment: any) => ({
        externalId: payment.id,
        amount: payment.amount / 100, // Convert from paise
        date: new Date(payment.created_at * 1000),
        description: payment.description || 'Razorpay payment',
        customerEmail: payment.email,
      }))
  } catch (error) {
    console.error('Fetch Razorpay transactions error:', error)
    return []
  }
}




