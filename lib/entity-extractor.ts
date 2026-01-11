/**
 * Entity Extractor
 * Extracts structured data from transaction descriptions
 * 
 * Extracts:
 * - Vendor names
 * - Customer names
 * - Invoice/Bill numbers
 * - Payment methods (UPI, NEFT, IMPS, RTGS)
 * - Reference numbers
 * - Keywords for categorization
 */

// Types
export interface ExtractedEntities {
  vendor?: string
  customer?: string
  invoiceNumber?: string
  billNumber?: string
  referenceNumber?: string
  paymentMethod?: PaymentMethod
  upiId?: string
  keywords: string[]
  amount?: number
  extractionConfidence: number
}

export type PaymentMethod = 
  | 'UPI'
  | 'NEFT'
  | 'IMPS'
  | 'RTGS'
  | 'CHEQUE'
  | 'CARD'
  | 'CASH'
  | 'NACH'
  | 'DD'
  | 'WIRE'
  | 'UNKNOWN'

// Common Indian bank transaction prefixes to remove
const TRANSACTION_PREFIXES = [
  'NEFT',
  'IMPS',
  'RTGS',
  'UPI',
  'NACH',
  'ECS',
  'ACH',
  'BIL',
  'POS',
  'ATM',
  'INB',
  'MOB',
  'NET',
  'CHQ',
  'DD',
  'FT',
  'TRF',
  'TRANSFER'
]

// Common suffixes to remove
const TRANSACTION_SUFFIXES = [
  'PAYMENT',
  'TRANSFER',
  'TXN',
  'TRANSACTION',
  'REF',
  'REFERENCE',
  'CREDIT',
  'DEBIT',
  'CR',
  'DR',
  'PVT LTD',
  'PRIVATE LIMITED',
  'LLP',
  'LIMITED',
  'LTD',
  'INC',
  'CORP'
]

// Known vendor patterns for Indian market
const KNOWN_VENDORS: Record<string, string> = {
  'aws': 'Amazon Web Services',
  'amazon web services': 'Amazon Web Services',
  'azure': 'Microsoft Azure',
  'microsoft': 'Microsoft',
  'google cloud': 'Google Cloud Platform',
  'gcp': 'Google Cloud Platform',
  'digitalocean': 'DigitalOcean',
  'github': 'GitHub',
  'gitlab': 'GitLab',
  'slack': 'Slack',
  'zoom': 'Zoom',
  'notion': 'Notion',
  'figma': 'Figma',
  'canva': 'Canva',
  'hubspot': 'HubSpot',
  'salesforce': 'Salesforce',
  'stripe': 'Stripe',
  'razorpay': 'Razorpay',
  'paytm': 'Paytm',
  'phonepe': 'PhonePe',
  'gpay': 'Google Pay',
  'google pay': 'Google Pay',
  'freshworks': 'Freshworks',
  'zoho': 'Zoho',
  'tally': 'Tally',
  'quickbooks': 'QuickBooks',
  'xero': 'Xero',
  'dropbox': 'Dropbox',
  'adobe': 'Adobe',
  'mailchimp': 'Mailchimp',
  'sendgrid': 'SendGrid',
  'twilio': 'Twilio',
  'intercom': 'Intercom',
  'heroku': 'Heroku',
  'vercel': 'Vercel',
  'netlify': 'Netlify',
  'cloudflare': 'Cloudflare',
  'fastly': 'Fastly',
  'mongodb': 'MongoDB',
  'firebase': 'Firebase',
  'supabase': 'Supabase'
}

/**
 * Main extraction function
 */
export function extractEntities(description: string): ExtractedEntities {
  const result: ExtractedEntities = {
    keywords: [],
    extractionConfidence: 0
  }

  if (!description || description.trim().length === 0) {
    return result
  }

  const desc = description.toUpperCase().trim()
  let confidencePoints = 0

  // 1. Extract payment method
  const paymentMethod = extractPaymentMethod(desc)
  if (paymentMethod.method !== 'UNKNOWN') {
    result.paymentMethod = paymentMethod.method
    result.upiId = paymentMethod.upiId
    confidencePoints += 10
  }

  // 2. Extract invoice number
  const invoiceNumber = extractInvoiceNumber(desc)
  if (invoiceNumber) {
    result.invoiceNumber = invoiceNumber
    confidencePoints += 20
  }

  // 3. Extract bill number
  const billNumber = extractBillNumber(desc)
  if (billNumber) {
    result.billNumber = billNumber
    confidencePoints += 20
  }

  // 4. Extract reference number
  const refNumber = extractReferenceNumber(desc)
  if (refNumber) {
    result.referenceNumber = refNumber
    confidencePoints += 10
  }

  // 5. Extract vendor/customer name
  const vendorResult = extractVendorName(description)
  if (vendorResult.name) {
    result.vendor = vendorResult.name
    confidencePoints += vendorResult.isKnown ? 30 : 15
  }

  // 6. Extract keywords
  result.keywords = extractKeywords(description)
  if (result.keywords.length > 0) {
    confidencePoints += 10
  }

  // 7. Extract amount (if embedded in description)
  const amount = extractAmount(desc)
  if (amount) {
    result.amount = amount
    confidencePoints += 5
  }

  result.extractionConfidence = Math.min(100, confidencePoints)
  return result
}

/**
 * Extract payment method from description
 */
function extractPaymentMethod(desc: string): { method: PaymentMethod; upiId?: string } {
  // UPI patterns
  const upiPatterns = [
    /UPI[-\/]?([A-Za-z0-9.@_-]+)/i,
    /([A-Za-z0-9.]+@[a-z]+)/i,  // UPI ID format: name@bank
    /PHONEPE|GPAY|GOOGLE PAY|PAYTM|BHIM/i
  ]

  for (const pattern of upiPatterns) {
    const match = desc.match(pattern)
    if (match) {
      return { 
        method: 'UPI', 
        upiId: match[1]?.includes('@') ? match[1] : undefined 
      }
    }
  }

  // NEFT
  if (/NEFT|NATIONAL ELECTRONIC/i.test(desc)) {
    return { method: 'NEFT' }
  }

  // IMPS
  if (/IMPS|IMMEDIATE PAYMENT/i.test(desc)) {
    return { method: 'IMPS' }
  }

  // RTGS
  if (/RTGS|REAL TIME GROSS/i.test(desc)) {
    return { method: 'RTGS' }
  }

  // NACH/ECS
  if (/NACH|ECS|ELECTRONIC CLEARING/i.test(desc)) {
    return { method: 'NACH' }
  }

  // Cheque
  if (/CHQ|CHEQUE|CHECK|CLG/i.test(desc)) {
    return { method: 'CHEQUE' }
  }

  // Card
  if (/POS|CARD|VISA|MASTERCARD|RUPAY|DEBIT CARD|CREDIT CARD/i.test(desc)) {
    return { method: 'CARD' }
  }

  // Wire transfer
  if (/WIRE|SWIFT|FOREIGN/i.test(desc)) {
    return { method: 'WIRE' }
  }

  // Demand Draft
  if (/\bDD\b|DEMAND DRAFT/i.test(desc)) {
    return { method: 'DD' }
  }

  // Cash
  if (/\bCASH\b|CDM|CASH DEPOSIT/i.test(desc)) {
    return { method: 'CASH' }
  }

  return { method: 'UNKNOWN' }
}

/**
 * Extract invoice number from description
 */
function extractInvoiceNumber(desc: string): string | undefined {
  const patterns = [
    /INV[-#\/]?(\d{4,})/i,
    /INVOICE\s*[-#:\/]?\s*([A-Z0-9-]+)/i,
    /INV[-_]?([A-Z]{2,}\d+)/i,
    /INVOICE\s*NUMBER\s*[-:\/]?\s*([A-Z0-9-]+)/i,
    /#INV([A-Z0-9]+)/i
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Extract bill number from description
 */
function extractBillNumber(desc: string): string | undefined {
  const patterns = [
    /BILL[-#\/]?(\d{4,})/i,
    /BILL\s*[-#:\/]?\s*([A-Z0-9-]+)/i,
    /BILL[-_]?([A-Z]{2,}\d+)/i,
    /BILL\s*NUMBER\s*[-:\/]?\s*([A-Z0-9-]+)/i,
    /PO[-#]?(\d{4,})/i,
    /PURCHASE\s*ORDER\s*[-#:\/]?\s*([A-Z0-9-]+)/i
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Extract reference number from description
 */
function extractReferenceNumber(desc: string): string | undefined {
  const patterns = [
    /REF[-#:\/]?\s*([A-Z0-9]{6,})/i,
    /REFERENCE\s*[-#:\/]?\s*([A-Z0-9]+)/i,
    /TXN[-#:\/]?\s*([A-Z0-9]+)/i,
    /TRANSACTION\s*ID\s*[-:\/]?\s*([A-Z0-9]+)/i,
    /UTR[-#:\/]?\s*([A-Z0-9]+)/i,  // UTR for NEFT/RTGS
    /RRN[-#:\/]?\s*(\d+)/i  // RRN for card transactions
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Extract vendor/customer name from description
 */
function extractVendorName(description: string): { name: string | undefined; isKnown: boolean } {
  const desc = description.toLowerCase()

  // First check known vendors
  for (const [key, value] of Object.entries(KNOWN_VENDORS)) {
    if (desc.includes(key)) {
      return { name: value, isKnown: true }
    }
  }

  // Clean the description
  let cleaned = description.toUpperCase()

  // Remove payment method prefixes
  for (const prefix of TRANSACTION_PREFIXES) {
    cleaned = cleaned.replace(new RegExp(`^${prefix}[-/\\s]*`, 'i'), '')
  }

  // Remove common suffixes
  for (const suffix of TRANSACTION_SUFFIXES) {
    cleaned = cleaned.replace(new RegExp(`\\s*${suffix}\\s*$`, 'i'), '')
  }

  // Remove reference numbers
  cleaned = cleaned.replace(/REF[-#:\/]?\s*[A-Z0-9]+/gi, '')
  cleaned = cleaned.replace(/TXN[-#:\/]?\s*[A-Z0-9]+/gi, '')
  cleaned = cleaned.replace(/UTR[-#:\/]?\s*[A-Z0-9]+/gi, '')

  // Remove dates
  cleaned = cleaned.replace(/\d{2}[-\/]\d{2}[-\/]\d{2,4}/g, '')

  // Remove amounts
  cleaned = cleaned.replace(/RS\.?\s*[\d,]+\.?\d*/gi, '')
  cleaned = cleaned.replace(/INR\.?\s*[\d,]+\.?\d*/gi, '')

  // Remove UPI IDs
  cleaned = cleaned.replace(/[A-Za-z0-9.]+@[a-z]+/gi, '')

  // Clean up
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Extract meaningful words (at least 3 characters)
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3)

  if (words.length > 0) {
    // Take first 3 meaningful words as vendor name
    const name = words.slice(0, 3).join(' ')
    return { name: toTitleCase(name), isKnown: false }
  }

  return { name: undefined, isKnown: false }
}

/**
 * Extract keywords for categorization
 */
function extractKeywords(description: string): string[] {
  const desc = description.toLowerCase()
  const keywords: string[] = []

  // Category keywords
  const categoryKeywords: Record<string, string[]> = {
    hiring: ['salary', 'payroll', 'wages', 'bonus', 'recruitment', 'hr', 'employee', 'staff', 'contractor'],
    marketing: ['marketing', 'advertising', 'ads', 'campaign', 'seo', 'social media', 'promotion', 'branding'],
    saas: ['subscription', 'saas', 'software', 'license', 'app', 'tool', 'platform', 'api'],
    cloud: ['aws', 'azure', 'gcp', 'cloud', 'hosting', 'server', 'infrastructure', 'database'],
    office: ['rent', 'office', 'electricity', 'utilities', 'internet', 'wifi', 'furniture'],
    legal: ['legal', 'lawyer', 'attorney', 'compliance', 'registration', 'trademark', 'patent'],
    travel: ['travel', 'flight', 'hotel', 'cab', 'uber', 'ola', 'taxi', 'transport'],
    tax: ['gst', 'tds', 'income tax', 'tax', 'filing', 'return']
  }

  for (const [category, words] of Object.entries(categoryKeywords)) {
    for (const word of words) {
      if (desc.includes(word)) {
        keywords.push(category)
        break
      }
    }
  }

  // Extract unique keywords
  return [...new Set(keywords)]
}

/**
 * Extract amount from description (sometimes embedded)
 */
function extractAmount(desc: string): number | undefined {
  const patterns = [
    /RS\.?\s*([\d,]+\.?\d*)/i,
    /INR\.?\s*([\d,]+\.?\d*)/i,
    /₹\s*([\d,]+\.?\d*)/,
    /AMOUNT\s*[-:\/]?\s*([\d,]+\.?\d*)/i
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount > 0) {
        return amount
      }
    }
  }

  return undefined
}

/**
 * Convert string to title case
 */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Enhanced entity extraction with AI (optional)
 */
export async function extractEntitiesWithAI(description: string): Promise<ExtractedEntities> {
  // First try regex-based extraction
  const regexResult = extractEntities(description)

  // If confidence is high enough, return regex result
  if (regexResult.extractionConfidence >= 70) {
    return regexResult
  }

  // Try AI extraction if OpenAI is configured
  if (!process.env.OPENAI_API_KEY) {
    return regexResult
  }

  try {
    const { chatCompletion } = await import('./openai-client')

    const prompt = `Extract entities from this Indian bank transaction description:
"${description}"

Return JSON with:
{
  "vendor": "Vendor/merchant name if outgoing payment, or null",
  "customer": "Customer name if incoming payment, or null",
  "invoiceNumber": "Invoice number if mentioned, or null",
  "billNumber": "Bill number if mentioned, or null",
  "referenceNumber": "Reference/transaction number, or null",
  "paymentMethod": "UPI|NEFT|IMPS|RTGS|CHEQUE|CARD|CASH|UNKNOWN",
  "keywords": ["relevant", "keywords"],
  "amount": number or null
}`

    const response = await chatCompletion([
      { role: 'system', content: 'You are an expert at parsing Indian bank transaction descriptions. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ])

    const parsed = JSON.parse(response)

    return {
      vendor: parsed.vendor || regexResult.vendor,
      customer: parsed.customer || regexResult.customer,
      invoiceNumber: parsed.invoiceNumber || regexResult.invoiceNumber,
      billNumber: parsed.billNumber || regexResult.billNumber,
      referenceNumber: parsed.referenceNumber || regexResult.referenceNumber,
      paymentMethod: (parsed.paymentMethod as PaymentMethod) || regexResult.paymentMethod,
      keywords: [...new Set([...(parsed.keywords || []), ...regexResult.keywords])],
      amount: parsed.amount || regexResult.amount,
      extractionConfidence: 85 // AI-enhanced confidence
    }
  } catch (error) {
    console.warn('AI entity extraction failed:', error)
    return regexResult
  }
}

/**
 * Batch entity extraction
 */
export function extractEntitiesBatch(descriptions: string[]): ExtractedEntities[] {
  return descriptions.map(desc => extractEntities(desc))
}

/**
 * Get extraction summary
 */
export function getExtractionSummary(results: ExtractedEntities[]): {
  total: number
  withVendor: number
  withInvoice: number
  withBill: number
  withPaymentMethod: number
  averageConfidence: number
  byPaymentMethod: Record<PaymentMethod, number>
} {
  const summary = {
    total: results.length,
    withVendor: 0,
    withInvoice: 0,
    withBill: 0,
    withPaymentMethod: 0,
    averageConfidence: 0,
    byPaymentMethod: {} as Record<PaymentMethod, number>
  }

  let totalConfidence = 0

  for (const result of results) {
    if (result.vendor) summary.withVendor++
    if (result.invoiceNumber) summary.withInvoice++
    if (result.billNumber) summary.withBill++
    if (result.paymentMethod && result.paymentMethod !== 'UNKNOWN') {
      summary.withPaymentMethod++
      summary.byPaymentMethod[result.paymentMethod] = 
        (summary.byPaymentMethod[result.paymentMethod] || 0) + 1
    }
    totalConfidence += result.extractionConfidence
  }

  summary.averageConfidence = results.length > 0 
    ? totalConfidence / results.length 
    : 0

  return summary
}
