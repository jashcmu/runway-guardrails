/**
 * Universal Bank Statement Parser
 * Handles ANY CSV, PDF, or Excel format from any Indian bank
 * 
 * Supported Banks (auto-detected):
 * - HDFC Bank
 * - ICICI Bank
 * - SBI (State Bank of India)
 * - Axis Bank
 * - Kotak Mahindra Bank
 * - Yes Bank
 * - IndusInd Bank
 * - Federal Bank
 * - IDFC First Bank
 * - RBL Bank
 * - And many more...
 */

import Papa from 'papaparse'

export interface ParsedTransaction {
  date: Date
  description: string
  amount: number
  type: 'debit' | 'credit'
  balance?: number
  // Enhanced fields
  referenceNumber?: string
  paymentMethod?: string
  bankName?: string
  rawData?: Record<string, unknown>
}

// Bank-specific column mappings for better detection
const BANK_COLUMN_PATTERNS: Record<string, { date: string[], desc: string[], debit: string[], credit: string[], balance: string[] }> = {
  'HDFC': {
    date: ['date', 'transaction date', 'txn date', 'value date'],
    desc: ['narration', 'description', 'particulars'],
    debit: ['withdrawal amt', 'debit', 'withdrawal', 'dr'],
    credit: ['deposit amt', 'credit', 'deposit', 'cr'],
    balance: ['closing balance', 'balance']
  },
  'ICICI': {
    date: ['transaction date', 'date', 'value date'],
    desc: ['transaction remarks', 'description', 'remarks', 'particulars'],
    debit: ['withdrawal amount', 'debit', 'dr amount'],
    credit: ['deposit amount', 'credit', 'cr amount'],
    balance: ['balance', 'running balance']
  },
  'SBI': {
    date: ['txn date', 'transaction date', 'value date'],
    desc: ['description', 'narration', 'particulars'],
    debit: ['debit', 'withdrawal', 'dr'],
    credit: ['credit', 'deposit', 'cr'],
    balance: ['balance', 'closing balance']
  },
  'AXIS': {
    date: ['tran date', 'transaction date', 'value date'],
    desc: ['particulars', 'description', 'narration'],
    debit: ['debit', 'dr', 'withdrawal'],
    credit: ['credit', 'cr', 'deposit'],
    balance: ['balance', 'init. br.']
  },
  'KOTAK': {
    date: ['date', 'transaction date'],
    desc: ['description', 'particulars', 'narration'],
    debit: ['dr amount', 'debit', 'withdrawal'],
    credit: ['cr amount', 'credit', 'deposit'],
    balance: ['balance']
  },
  'DEFAULT': {
    date: ['date', 'txn date', 'transaction date', 'value date', 'dt', 'posting date'],
    desc: ['description', 'narration', 'particulars', 'details', 'remarks', 'transaction', 'memo'],
    debit: ['debit', 'withdrawal', 'dr', 'paid', 'expense', 'out', 'withdrawal amt', 'dr amount'],
    credit: ['credit', 'deposit', 'cr', 'received', 'income', 'in', 'deposit amt', 'cr amount'],
    balance: ['balance', 'closing balance', 'running balance', 'available balance']
  }
}

/**
 * Detect bank from CSV headers or content
 */
function detectBank(headers: string[], sampleContent: string): string {
  const headerStr = headers.join(' ').toLowerCase()
  const contentLower = sampleContent.toLowerCase()
  
  if (headerStr.includes('hdfc') || contentLower.includes('hdfc bank')) return 'HDFC'
  if (headerStr.includes('icici') || contentLower.includes('icici bank')) return 'ICICI'
  if (headerStr.includes('sbi') || contentLower.includes('state bank')) return 'SBI'
  if (headerStr.includes('axis') || contentLower.includes('axis bank')) return 'AXIS'
  if (headerStr.includes('kotak') || contentLower.includes('kotak')) return 'KOTAK'
  
  return 'DEFAULT'
}

/**
 * Parse Excel file - Convert to CSV first
 */
export async function parseExcelStatement(buffer: Buffer): Promise<ParsedTransaction[]> {
  try {
    // Dynamic import xlsx
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to CSV
    const csvText = XLSX.utils.sheet_to_csv(sheet)
    console.log(`📊 Converted Excel sheet "${sheetName}" to CSV (${csvText.length} chars)`)
    
    return parseCSVStatement(csvText)
  } catch (error) {
    console.error('❌ Excel parsing failed:', error)
    throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse CSV - Ultra flexible, works with ANY format
 * Auto-detects bank format and column mappings
 */
export function parseCSVStatement(csvText: string): ParsedTransaction[] {
  console.error('🔍 Starting universal CSV parse...')
  console.error('📄 CSV Text Length:', csvText.length, 'chars')
  console.error('📄 CSV Preview (first 500 chars):', csvText.substring(0, 500))
  
  // Remove BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1)
    console.log('📄 Removed UTF-8 BOM')
  }
  
  // Clean up common issues
  csvText = csvText
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/^\s*\n/gm, '') // Remove blank lines at start
  
  // Try parsing with PapaParse
  let result: Papa.ParseResult<any>
  try {
    result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/[\r\n]/g, ''), // Trim whitespace from headers
    })
    
    if (result.errors.length > 0) {
      console.warn('⚠️ PapaParse warnings:', result.errors.slice(0, 5))
    }
  } catch (parseError) {
    console.error('❌ PapaParse failed:', parseError)
    throw new Error(`Failed to parse CSV: ${parseError}`)
  }

  console.error(`📊 Papa parsed ${result.data.length} rows`)
  
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
  console.error('📋 ALL Headers found:', JSON.stringify(headers))
  
  // Detect bank
  const detectedBank = detectBank(headers, csvText)
  console.log(`🏦 Detected bank format: ${detectedBank}`)
  
  const bankPatterns = BANK_COLUMN_PATTERNS[detectedBank] || BANK_COLUMN_PATTERNS['DEFAULT']

  // Smart column detection using bank-specific patterns
  let dateCol: string | null = null
  let descCol: string | null = null
  let debitCol: string | null = null
  let creditCol: string | null = null
  let amountCol: string | null = null
  let balanceCol: string | null = null
  let refCol: string | null = null

  // Helper function to match column patterns
  const matchColumn = (header: string, patterns: string[]): boolean => {
    const lower = header.toLowerCase().trim()
    return patterns.some(p => lower === p || lower.includes(p))
  }

  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    
    // Date detection (using bank patterns first, then generic)
    if (!dateCol && matchColumn(h, bankPatterns.date)) {
      dateCol = h
      console.log(`✅ Date column: "${h}"`)
    }
    
    // Description detection
    if (!descCol && matchColumn(h, bankPatterns.desc)) {
      descCol = h
      console.log(`✅ Description column: "${h}"`)
    }
    
    // Debit detection
    if (!debitCol && matchColumn(h, bankPatterns.debit)) {
      debitCol = h
      console.log(`✅ Debit column: "${h}"`)
    }
    
    // Credit detection
    if (!creditCol && matchColumn(h, bankPatterns.credit)) {
      creditCol = h
      console.log(`✅ Credit column: "${h}"`)
    }
    
    // Single amount column
    if (!amountCol && (
      lower === 'amount' ||
      (lower.includes('amount') && !lower.includes('balance') && !lower.includes('debit') && !lower.includes('credit'))
    )) {
      amountCol = h
      console.log(`✅ Amount column: "${h}"`)
    }
    
    // Balance detection
    if (!balanceCol && matchColumn(h, bankPatterns.balance)) {
      balanceCol = h
      console.log(`✅ Balance column: "${h}"`)
    }
    
    // Reference number detection
    if (!refCol && (
      lower.includes('reference') ||
      lower.includes('ref') ||
      lower.includes('txn id') ||
      lower.includes('transaction id') ||
      lower.includes('utr')
    )) {
      refCol = h
      console.log(`✅ Reference column: "${h}"`)
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
    
    console.error(`\n📋 Row ${i}: Raw row data:`, JSON.stringify(row).substring(0, 200))
    
    // Get date
    const dateValue = dateCol ? String(row[dateCol] || '').trim() : ''
    console.error(`   Date column "${dateCol}": "${dateValue}"`)
    const date = parseDate(dateValue)
    
    if (!date) {
      console.error(`⏭️ Row ${i}: Invalid date "${dateValue}"`)
      continue
    }

    // Get description
    let description = descCol ? String(row[descCol] || '').trim() : ''
    console.error(`   Description column "${descCol}": "${description}"`)
    if (!description) {
      // Try to find description in any column
      for (const key of headers) {
        const val = String(row[key] || '').trim()
        if (val && val.length > 5 && !val.match(/^[\d,.\-₹\s]+$/)) {
          description = val
          console.error(`   Found description in column "${key}": "${description}"`)
          break
        }
      }
      if (!description) description = 'Transaction'
    }

    // Skip ONLY actual balance/total rows (exact matches or starts with)
    const descLower = description.toLowerCase().trim()
    const isOpeningBalance = descLower === 'opening balance' || descLower.startsWith('opening balance')
    const isClosingBalance = descLower === 'closing balance' || descLower.startsWith('closing balance')
    const isTotal = descLower === 'total' || descLower === 'totals' || descLower.startsWith('total ')
    
    if (isOpeningBalance || isClosingBalance || isTotal) {
      console.error(`⏭️ Row ${i}: Skipping balance/total row "${description}"`)
      continue
    }
    
    console.error(`✅ Row ${i}: Processing "${description.substring(0, 40)}"`)

    // Get amounts
    let debit = 0
    let credit = 0
    
    if (debitCol) {
      const rawVal = String(row[debitCol] || '')
      const val = rawVal.replace(/[,₹\s]/g, '')
      debit = Math.abs(parseFloat(val) || 0)
      console.error(`   Debit column "${debitCol}": raw="${rawVal}", parsed=${debit}`)
    }
    
    if (creditCol) {
      const rawVal = String(row[creditCol] || '')
      const val = rawVal.replace(/[,₹\s]/g, '')
      credit = Math.abs(parseFloat(val) || 0)
      console.error(`   Credit column "${creditCol}": raw="${rawVal}", parsed=${credit}`)
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
    
    // Get reference number if available
    let referenceNumber: string | undefined
    if (refCol) {
      referenceNumber = String(row[refCol] || '').trim() || undefined
    }
    
    // Detect payment method from description
    const paymentMethod = detectPaymentMethod(description)

    transactions.push({
      date,
      description,
      amount,
      type,
      balance,
      referenceNumber,
      paymentMethod,
      bankName: detectedBank !== 'DEFAULT' ? detectedBank : undefined,
      rawData: row as Record<string, unknown>
    })

    console.log(`✅ Row ${i}: ${date.toLocaleDateString()} | ${type} | ${Math.abs(amount)} | ${description.substring(0, 30)}`)
  }

  console.log(`\n🎉 Successfully parsed ${transactions.length} transactions from CSV (Bank: ${detectedBank})\n`)
  return transactions
}

/**
 * Detect payment method from transaction description
 */
function detectPaymentMethod(description: string): string | undefined {
  const desc = description.toUpperCase()
  
  if (desc.includes('UPI') || desc.includes('GPAY') || desc.includes('PHONEPE') || desc.includes('PAYTM') || desc.includes('BHIM')) {
    return 'UPI'
  }
  if (desc.includes('NEFT')) return 'NEFT'
  if (desc.includes('RTGS')) return 'RTGS'
  if (desc.includes('IMPS')) return 'IMPS'
  if (desc.includes('CHEQUE') || desc.includes('CHQ') || desc.includes('CLG')) return 'Cheque'
  if (desc.includes('ATM') || desc.includes('CASH')) return 'Cash'
  if (desc.includes('POS') || desc.includes('DEBIT CARD') || desc.includes('VISA') || desc.includes('RUPAY')) return 'Debit Card'
  if (desc.includes('CREDIT CARD') || desc.includes('CC ') || desc.includes('MASTERCARD')) return 'Credit Card'
  if (desc.includes('ECS') || desc.includes('NACH')) return 'ECS/NACH'
  if (desc.includes('DD') || desc.includes('DEMAND DRAFT')) return 'Demand Draft'
  
  return undefined
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
 * Parse PDF - Extract transactions from any PDF with multiple fallback methods
 */
export async function parsePDFStatement(pdfBuffer: Buffer): Promise<ParsedTransaction[]> {
  console.log('🔍 Starting PDF parse...')

  try {
    // Method 1: Try pdftotext command line tool with layout mode (most reliable)
    try {
      const { execSync } = await import('child_process')
      const fs = await import('fs')
      const os = await import('os')
      const path = await import('path')
      
      // Write buffer to temp file
      const tempFile = path.join(os.tmpdir(), `pdf-parse-${Date.now()}.pdf`)
      fs.writeFileSync(tempFile, pdfBuffer)
      
      // Run pdftotext with -layout to preserve table structure
      const text = execSync(`pdftotext -layout "${tempFile}" -`, { encoding: 'utf8', timeout: 30000 })
      
      // Clean up temp file
      fs.unlinkSync(tempFile)
      
      console.log(`📄 PDF extracted ${text.length} characters using pdftotext -layout`)
      console.log('📄 PDF Preview:', text.substring(0, 500))

      const transactions = parseBankStatementText(text)
      if (transactions.length > 0) {
        console.log(`🎉 Parsed ${transactions.length} transactions from PDF using pdftotext`)
        return transactions
      }
    } catch (pdftotextError: any) {
      console.warn('⚠️ pdftotext failed, trying fallback:', pdftotextError.message)
    }

    // Method 2: Try pdf-parse library
    try {
      const pdfParseModule = await import('pdf-parse')
      const pdfParse = (pdfParseModule as any).default || pdfParseModule
      const data = await pdfParse(pdfBuffer)
      const text: string = data.text

      console.log(`📄 PDF extracted ${text.length} characters using pdf-parse`)
      console.log('📄 PDF Preview:', text.substring(0, 500))

      const transactions = parseBankStatementText(text)
      if (transactions.length > 0) {
        console.log(`🎉 Parsed ${transactions.length} transactions from PDF using pdf-parse`)
        return transactions
      }
    } catch (pdfParseError: any) {
      console.warn('⚠️ pdf-parse failed:', pdfParseError.message)
    }

    console.error('❌ All PDF parsing methods failed to extract transactions')
    return []

  } catch (error) {
    console.error('❌ PDF parsing failed:', error)
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse bank statement text extracted from PDF
 * Handles both layout-formatted tables and messy extractions
 */
function parseBankStatementText(text: string): ParsedTransaction[] {
  console.log('📊 Parsing bank statement text...')
  
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n')
  
  // Pattern for table rows: Date followed by description and amounts
  // Format: DD/MM/YYYY   Description                    Debit    Credit    Balance
  const tableRowPattern = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s{2,}([\d,.]+)?\s*([\d,.]+)?\s*([\d,.]+)?$/
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    
    // Try to match table row format
    const match = trimmedLine.match(tableRowPattern)
    if (match) {
      const dateStr = match[1]
      const description = match[2].trim()
      
      // Parse amounts - could be in debit, credit, or balance columns
      const amounts: number[] = []
      for (let i = 3; i <= 5; i++) {
        if (match[i]) {
          const amount = parseFloat(match[i].replace(/,/g, ''))
          if (!isNaN(amount) && amount > 0) {
            amounts.push(amount)
          }
        }
      }
      
      const date = parseDate(dateStr)
      if (!date) continue
      
      // Skip opening/closing balance
      const descLower = description.toLowerCase()
      if (descLower.includes('opening balance') || descLower.includes('closing balance')) {
        continue
      }
      
      // Skip if no transaction amount (only balance)
      if (amounts.length === 0) continue
      if (amounts.length === 1 && descLower.includes('balance')) continue
      
      // Determine type and amount
      let type: 'debit' | 'credit'
      let amount: number
      
      // The transaction amount is the first amount (debit or credit)
      // The last amount is usually the balance
      const txnAmount = amounts[0]
      
      // Check description context to determine type
      const isCredit = descLower.includes('customer payment') || 
                       descLower.includes('received') || 
                       descLower.includes('credit') ||
                       descLower.includes('deposit') ||
                       descLower.includes('refund') ||
                       descLower.includes('collection')
      
      // If description suggests credit or if the line structure suggests credit column
      // In the layout format, credit amounts appear after debit column
      if (isCredit) {
        type = 'credit'
        amount = txnAmount
      } else {
        type = 'debit'
        amount = -txnAmount
      }
      
      transactions.push({
        date,
        description,
        amount,
        type,
      })
      
      console.log(`✅ ${date.toISOString().split('T')[0]} | ${type} | ₹${Math.abs(amount)} | ${description}`)
      continue
    }
    
    // Fallback: Try simpler date-based parsing for non-layout text
    const simpleDateMatch = trimmedLine.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (simpleDateMatch) {
      const dateStr = simpleDateMatch[1]
      const rest = trimmedLine.substring(dateStr.length).trim()
      
      // Extract amounts from the rest
      const amountMatches = rest.match(/[\d,]+\.\d{2}/g)
      if (!amountMatches || amountMatches.length === 0) continue
      
      const amounts = amountMatches.map(a => parseFloat(a.replace(/,/g, ''))).filter(a => !isNaN(a) && a > 0)
      if (amounts.length === 0) continue
      
      // Extract description (text before first amount)
      const firstAmountIndex = rest.search(/[\d,]+\.\d{2}/)
      const description = rest.substring(0, firstAmountIndex).trim()
      
      if (!description || description.length < 2) continue
      
      const descLower = description.toLowerCase()
      if (descLower.includes('opening balance') || descLower.includes('closing balance')) continue
      
      const date = parseDate(dateStr)
      if (!date) continue
      
      const txnAmount = amounts[0]
      const isCredit = descLower.includes('customer payment') || descLower.includes('received')
      
      transactions.push({
        date,
        description,
        amount: isCredit ? txnAmount : -txnAmount,
        type: isCredit ? 'credit' : 'debit',
      })
      
      console.log(`✅ ${date.toISOString().split('T')[0]} | ${isCredit ? 'credit' : 'debit'} | ₹${txnAmount} | ${description}`)
    }
  }
  
  console.log(`🎉 Parsed ${transactions.length} transactions from bank statement`)
  return transactions
}

