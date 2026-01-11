/**
 * Simple, Reliable Bank Statement Parser
 * Works with ANY CSV or PDF - minimal assumptions
 */

import Papa from 'papaparse'

export interface ParsedTransaction {
  date: Date
  description: string
  amount: number
  type: 'debit' | 'credit'
  balance?: number
}

/**
 * Parse CSV - Works with ANY format
 */
export function parseCSVStatement(csvText: string): ParsedTransaction[] {
  console.log('🔍 Starting CSV parse...')
  
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  console.log(`Found ${result.data.length} rows`)
  
  if (result.data.length === 0) {
    console.error('❌ No data in CSV')
    return []
  }

  const firstRow = result.data[0] as any
  const headers = Object.keys(firstRow)
  console.log('CSV Headers:', headers)

  const transactions: ParsedTransaction[] = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as any
    
    // Find date column
    let dateValue: string | null = null
    for (const header of headers) {
      const h = header.toLowerCase()
      if (h.includes('date') || h.includes('txn')) {
        dateValue = row[header]
        if (dateValue) break
      }
    }
    
    if (!dateValue) dateValue = row[headers[0]] // Try first column
    if (!dateValue) continue
    
    const date = parseDate(dateValue)
    if (!date) continue

    // Find description
    let description = ''
    for (const header of headers) {
      const h = header.toLowerCase()
      if (h.includes('desc') || h.includes('narr') || h.includes('particular') || h.includes('detail')) {
        description = String(row[header] || '').trim()
        if (description) break
      }
    }
    if (!description) description = 'Transaction'

    // Skip balance rows
    if (description.toLowerCase().includes('balance') || description.toLowerCase().includes('total')) {
      continue
    }

    // Find amounts
    let debit = 0
    let credit = 0
    
    for (const header of headers) {
      const h = header.toLowerCase()
      const val = String(row[header] || '').replace(/[,₹\s]/g, '')
      const num = parseFloat(val)
      
      if (isNaN(num) || num === 0) continue
      
      if (h.includes('debit') || h.includes('withdrawal') || h.includes('dr')) {
        debit = Math.abs(num)
      } else if (h.includes('credit') || h.includes('deposit') || h.includes('cr')) {
        credit = Math.abs(num)
      }
    }

    if (debit === 0 && credit === 0) continue

    const type: 'debit' | 'credit' = credit > 0 ? 'credit' : 'debit'
    const amount = type === 'credit' ? credit : -debit

    transactions.push({
      date,
      description,
      amount,
      type,
    })
  }

  console.log(`✅ Parsed ${transactions.length} transactions`)
  return transactions
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  dateStr = dateStr.trim()

  // DD/MM/YYYY or DD-MM-YYYY
  let m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    if (!isNaN(d.getTime())) return d
  }

  // YYYY-MM-DD
  m = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    if (!isNaN(d.getTime())) return d
  }

  // Try standard parsing
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d

  return null
}

/**
 * Parse PDF
 */
export async function parsePDFStatement(pdfBuffer: Buffer): Promise<ParsedTransaction[]> {
  console.log('🔍 Starting PDF parse...')
  
  try {
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as any).default || pdfParseModule
    const data = await pdfParse(pdfBuffer)
    const text = data.text

    console.log(`PDF text length: ${text.length} chars`)

    const transactions: ParsedTransaction[] = []
    const lines = text.split('\n')

    for (const line of lines) {
      // Look for date pattern
      const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
      if (!dateMatch) continue

      const date = parseDate(dateMatch[1])
      if (!date) continue

      // Look for amounts (numbers with optional commas and decimals)
      const amounts = [...line.matchAll(/([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/g)]
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(n => !isNaN(n) && n >= 10)

      if (amounts.length === 0) continue

      // Description is text before numbers
      let description = line.substring(0, line.indexOf(dateMatch[0]) + dateMatch[0].length)
      description = description.replace(dateMatch[0], '').trim()
      if (!description || description.length < 3) description = 'PDF Transaction'

      const amount = amounts[0]
      const type: 'debit' | 'credit' = line.toLowerCase().includes('cr') ? 'credit' : 'debit'

      transactions.push({
        date,
        description,
        amount: type === 'credit' ? amount : -amount,
        type,
      })
    }

    console.log(`✅ Parsed ${transactions.length} transactions from PDF`)
    return transactions

  } catch (error) {
    console.error('❌ PDF parse error:', error)
    throw error
  }
}
