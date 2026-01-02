/**
 * Razorpay Integration for Indian Payment Processing
 * Supports UPI, Cards, Net Banking, Wallets
 */

export interface RazorpayConfig {
  keyId: string
  keySecret: string
}

export interface PaymentLinkOptions {
  amount: number // in rupees (will be converted to paise)
  currency?: string
  description: string
  customer?: {
    name: string
    email?: string
    contact?: string
  }
  notify?: {
    sms?: boolean
    email?: boolean
  }
  reminder_enable?: boolean
  callback_url?: string
  callback_method?: 'get' | 'post'
  reference_id?: string // Invoice number, bill number, etc.
}

export interface PaymentLinkResponse {
  id: string
  short_url: string
  amount: number
  currency: string
  description: string
  status: string
  reference_id?: string
  created_at: number
}

export interface PaymentOrder {
  id: string
  entity: string
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: string
  attempts: number
  created_at: number
}

/**
 * Razorpay Client wrapper
 */
export class RazorpayClient {
  private keyId: string
  private keySecret: string
  private baseUrl: string = 'https://api.razorpay.com/v1'

  constructor(config: RazorpayConfig) {
    this.keyId = config.keyId
    this.keySecret = config.keySecret
  }

  /**
   * Create a Payment Link
   * Perfect for invoices - send link to customer via email/SMS
   */
  async createPaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResponse> {
    const amountInPaise = Math.round(options.amount * 100) // Convert to paise

    const payload = {
      amount: amountInPaise,
      currency: options.currency || 'INR',
      description: options.description,
      customer: options.customer,
      notify: options.notify || { sms: true, email: true },
      reminder_enable: options.reminder_enable !== false,
      callback_url: options.callback_url,
      callback_method: options.callback_method || 'get',
      reference_id: options.reference_id,
    }

    try {
      const response = await fetch(`${this.baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Razorpay API error: ${JSON.stringify(error)}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to create payment link:', error)
      throw error
    }
  }

  /**
   * Create a Payment Order (for Checkout integration)
   */
  async createOrder(amount: number, currency: string = 'INR', receipt: string): Promise<PaymentOrder> {
    const amountInPaise = Math.round(amount * 100)

    const payload = {
      amount: amountInPaise,
      currency,
      receipt,
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Razorpay API error: ${JSON.stringify(error)}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to create order:', error)
      throw error
    }
  }

  /**
   * Verify Payment Signature (webhook validation)
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')

    return expectedSignature === signature
  }

  /**
   * Fetch Payment Details
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Razorpay API error: ${JSON.stringify(error)}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to fetch payment:', error)
      throw error
    }
  }

  /**
   * Refund a Payment
   */
  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    const payload: any = {}
    if (amount) {
      payload.amount = Math.round(amount * 100) // Convert to paise
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Razorpay API error: ${JSON.stringify(error)}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to refund payment:', error)
      throw error
    }
  }

  /**
   * Create a Virtual Account (for recurring payments)
   */
  async createVirtualAccount(customerId: string, description: string): Promise<any> {
    const payload = {
      receivers: {
        types: ['bank_account'],
      },
      description,
      customer_id: customerId,
    }

    try {
      const response = await fetch(`${this.baseUrl}/virtual_accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Razorpay API error: ${JSON.stringify(error)}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to create virtual account:', error)
      throw error
    }
  }
}

/**
 * Initialize Razorpay client with environment variables
 */
export function initializeRazorpay(): RazorpayClient | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    console.warn('⚠ Razorpay credentials not found in environment variables')
    return null
  }

  return new RazorpayClient({ keyId, keySecret })
}



