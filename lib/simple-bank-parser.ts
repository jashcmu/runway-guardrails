/**
 * Universal Bank Statement Parser
 * Handles ANY CSV or PDF format from any bank
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
 * Parse CSV - Ultra flexible, works with ANY format
 */
export function parseCSVStatement(csvText: string): ParsedTransaction[] {
  console.log('🔍 Starting universal CSV parse...')
  console.log('📄 CSV Text Length:', csvText.length, 'chars')
  console.log('📄 CSV Preview (first 500 chars):', csvText.substring(0, 500))
  
  // Remove BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1)
    console.log('📄 Removed UTF-8 BOM')
  }
  
  // Try parsing with PapaParse
  let result: Papa.ParseResult<any>
  try {
    result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(), // Trim whitespace from headers
    })
    
    if (result.errors.length > 0) {
      console.warn('⚠️ PapaParse warnings:', result.errors.slice(0, 5))
    }
  } catch (parseError) {
    console.error('❌ PapaParse failed:', parseError)
    throw new Error(`Failed to parse CSV: ${parseError}`)
  }

  console.log(`📊 Papa parsed ${result.data.length} rows`)
  
  if (result.data.length === 0) {
    console.error('❌ No data rows found in CSV')
    console.error('   CSV content:', csvText.substring(0, 1000))
    return []
  }

  const firstRow = result.data[0] as Record<string, unknown>
  if (!firstRow) {
    console.error('❌ First row is empty')
    return []
  }
  
  const headers = Object.keys(firstRow)
  console.log('📋 ALL Headers found:', JSON.stringify(headers))

  // Smart column detection - find the right columns
  let dateCol: string | null = null
  let descCol: string | null = null
  let debitCol: string | null = null
  let creditCol: string | null = null
  let amountCol: string | null = null
  let balanceCol: string | null = null

  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    
    // Date detection
    if (!dateCol && (
      lower.includes('date') || 
      lower.includes('txn') || 
      lower === 'dt' ||
      lower.includes('time')
    )) {
      dateCol = h
      console.log(`✅ Date column: "${h}"`)
    }
    
    // Description detection
    if (!descCol && (
      lower.includes('desc') || 
      lower.includes('narr') || 
      lower.includes('particular') || 
      lower.includes('detail') ||
      lower.includes('remark') ||
      lower.includes('transaction') && !lower.includes('date') && !lower.includes('type')
    )) {
      descCol = h
      console.log(`✅ Description column: "${h}"`)
    }
    
    // Debit detection
    if (!debitCol && (
      lower.includes('debit') || 
      lower.includes('withdrawal') || 
      lower.includes('dr') ||
      lower.includes('paid') ||
      lower.includes('expense') ||
      lower.includes('out')
    )) {
      debitCol = h
      console.log(`✅ Debit column: "${h}"`)
    }
    
    // Credit detection
    if (!creditCol && (
      lower.includes('credit') || 
      lower.includes('deposit') || 
      lower.includes('cr') ||
      lower.includes('received') ||
      lower.includes('income') ||
      lower.includes('in') && !lower.includes('inter')
    )) {
      creditCol = h
      console.log(`✅ Credit column: "${h}"`)
    }
    
    // Single amount column
    if (!amountCol && (
      lower === 'amount' ||
      lower.includes('amount') && !lower.includes('balance')
    )) {
      amountCol = h
      console.log(`✅ Amount column: "${h}"`)
    }
    
    // Balance detection
    if (!balanceCol && (
      lower.includes('balance') ||
      lower.includes('closing')
    )) {
      balanceCol = h
      console.log(`✅ Balance column: "${h}"`)
    }
  }

  // Fallback: If no date column found, use first column
  if (!dateCol && headers.length > 0) {
    dateCol = headers[0]
    console.log(`⚠️ No date column detected, using first column: "${dateCol}"`)
  }

  // Fallback: If no description, try to find any text column
  if (!descCol) {
    for (const h of headers) {
      if (h !== dateCol && h !== debitCol && h !== creditCol && h !== amountCol && h !== balanceCol) {
        const sampleVal = String((firstRow as Record<string, unknown>)[h] || '')
        if (sampleVal.length > 3 && isNaN(parseFloat(sampleVal.replace(/[,₹\s]/g, '')))) {
          descCol = h
          console.log(`⚠️ Using "${h}" as description (fallback)`)
          break
        }
      }
    }
  }

  console.log('\n📌 Column mapping:')
  console.log(`   Date: ${dateCol || 'NOT FOUND'}`)
  console.log(`   Description: ${descCol || 'NOT FOUND'}`)
  console.log(`   Debit: ${debitCol || 'NOT FOUND'}`)
  console.log(`   Credit: ${creditCol || 'NOT FOUND'}`)
  console.log(`   Amount: ${amountCol || 'NOT FOUND'}`)
  console.log(`   Balance: ${balanceCol || 'NOT FOUND'}\n`)

  const transactions: ParsedTransaction[] = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as Record<string, unknown>
    
    // Get date
    const dateValue = dateCol ? String(row[dateCol] || '').trim() : ''
    const date = parseDate(dateValue)
    
    if (!date) {
      console.log(`⏭️ Row ${i}: Invalid date "${dateValue}"`)
      continue
    }

    // Get description
    let description = descCol ? String(row[descCol] || '').trim() : ''
    if (!description) description = 'Transaction'

    // Skip balance/total rows
    const descLower = description.toLowerCase()
    if (descLower.includes('opening balance') || 
        descLower.includes('closing balance') || 
        descLower === 'total' ||
        descLower === 'totals') {
      console.log(`⏭️ Row ${i}: Skipping balance row "${description}"`)
      continue
    }

    // Get amounts
    let debit = 0
    let credit = 0
    
    if (debitCol) {
      const val = String(row[debitCol] || '').replace(/[,₹\s]/g, '')
      debit = Math.abs(parseFloat(val) || 0)
    }
    
    if (creditCol) {
      const val = String(row[creditCol] || '').replace(/[,₹\s]/g, '')
      credit = Math.abs(parseFloat(val) || 0)
    }

    // If using single amount column
    if (amountCol && debit === 0 && credit === 0) {
      const val = String(row[amountCol] || '').replace(/[,₹\s]/g, '')
      const num = parseFloat(val) || 0
      
      if (num > 0) {
        credit = num
      } else if (num < 0) {
        debit = Math.abs(num)
      }
    }

    // Skip if no amount
    if (debit === 0 && credit === 0) {
      console.log(`⏭️ Row ${i}: No amount found`)
      continue
    }

    const type: 'debit' | 'credit' = credit > 0 ? 'credit' : 'debit'
    const amount = type === 'credit' ? credit : -debit

    // Get balance if available
    let balance: number | undefined
    if (balanceCol) {
      const val = String(row[balanceCol] || '').replace(/[,₹\s]/g, '')
      balance = parseFloat(val) || undefined
    }

    transactions.push({
      date,
      description,
      amount,
      type,
      balance,
    })

    console.log(`✅ Row ${i}: ${date.toLocaleDateString()} | ${type} | ${Math.abs(amount)} | ${description.substring(0, 30)}`)
  }

  console.log(`\n🎉 Successfully parsed ${transactions.length} transactions from CSV\n`)
  return transactions
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  dateStr = dateStr.trim()

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  let m = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    if (!isNaN(d.getTime())) return d
  }

  // YYYY-MM-DD or YYYY/MM/DD
  m = dateStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    if (!isNaN(d.getTime())) return d
  }

  // DD Mon YYYY (e.g., "15 Dec 2024")
  m = dateStr.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+(\d{4})/i)
  if (m) {
    const monthMap: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    }
    const d = new Date(parseInt(m[3]), monthMap[m[2].toLowerCase().substring(0, 3)], parseInt(m[1]))
    if (!isNaN(d.getTime())) return d
  }

  // Try JS native parsing as last resort
  const d = new Date(dateStr)
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2030) {
    return d
  }

  return null
}

/**
 * Parse PDF - Extract transactions from any PDF
 */
export async function parsePDFStatement(pdfBuffer: Buffer): Promise<ParsedTransaction[]> {
  console.log('🔍 Starting PDF parse...')
  
  try {
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as any).default || pdfParseModule
    const data = await pdfParse(pdfBuffer)
    const text: string = data.text

    console.log(`📄 PDF extracted ${text.length} characters`)
    console.log('📄 PDF Preview:', text.substring(0, 500))

    const transactions: ParsedTransaction[] = []
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5)

    console.log(`📊 Processing ${lines.length} lines from PDF...`)

    for (const line of lines) {
      // Skip header-like lines
      const lineLower = line.toLowerCase()
      if (lineLower.includes('date') && lineLower.includes('description') ||
          lineLower.includes('particulars') ||
          lineLower.includes('opening balance') ||
          lineLower.includes('closing balance')) {
        continue
      }

      // Look for date pattern at start of line
      const dateMatch = line.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/)
      if (!dateMatch) continue

      const date = parseDate(dateMatch[1])
      if (!date) continue

      // Look for amounts (numbers with optional commas)
      const amountMatches = [...line.matchAll(/([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/g)]
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(n => !isNaN(n) && n >= 10)

      if (amountMatches.length === 0) continue

      // Description is text between date and first amount
      const afterDate = line.substring(dateMatch[0].length).trim()
      let description = afterDate.split(/\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?/)[0].trim()
      if (!description || description.length < 2) description = 'PDF Transaction'

      // Determine type from context
      const isCredit = lineLower.includes('cr') || lineLower.includes('credit') || lineLower.includes('deposit')
      const type: 'debit' | 'credit' = isCredit ? 'credit' : 'debit'
      const amount = type === 'credit' ? amountMatches[0] : -amountMatches[0]

      transactions.push({
        date,
        description,
        amount,
        type,
      })
    }

    console.log(`🎉 Parsed ${transactions.length} transactions from PDF`)
    return transactions

  } catch (error) {
    console.error('❌ PDF parse error:', error)
    throw error
  }
}
