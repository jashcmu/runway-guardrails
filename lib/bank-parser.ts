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
 * UNIVERSAL CSV Parser - Works with ANY bank statement format
 * Intelligently detects columns regardless of naming
 */
export function parseCSVStatement(csvText: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings (non-critical):', result.errors.slice(0, 3))
  }

  console.log(`📄 Found ${result.data.length} rows in CSV`)
  if (result.data.length > 0 && result.data[0]) {
    console.log('📋 Detected columns:', Object.keys(result.data[0] as Record<string, unknown>))
  }

  for (const row of result.data as any[]) {
    try {
      // INTELLIGENT DATE DETECTION
      let date: Date | null = null
      const allKeys = Object.keys(row)
      
      for (const key of allKeys) {
        const lowerKey = key.toLowerCase().trim()
        const value = String(row[key] || '').trim()
        
        if (!value) continue
        
        // Check if this looks like a date field
        if (
          lowerKey.includes('date') || 
          lowerKey.includes('txn') ||
          lowerKey.includes('transaction') ||
          lowerKey.includes('value') ||
          lowerKey === 'date'
        ) {
          date = parseDate(value)
          if (date) {
            console.log(`✓ Date found: ${value} → ${date.toISOString()}`)
            break
          }
        }
      }

      // If no labeled date column, try first column
      if (!date && allKeys.length > 0) {
        const firstValue = String(row[allKeys[0]] || '').trim()
        date = parseDate(firstValue)
        if (date) console.log(`✓ Date from first column: ${firstValue}`)
      }

      if (!date) {
        console.log(`✗ No valid date found in row, skipping`)
        continue
      }

      // INTELLIGENT AMOUNT DETECTION
      let debitAmount = 0
      let creditAmount = 0
      let balance: number | undefined
      
      for (const key of allKeys) {
        const lowerKey = key.toLowerCase().trim()
        const rawValue = String(row[key] || '').trim()
        
        if (!rawValue || rawValue === '-') continue
        
        const value = parseFloat(rawValue.replace(/[,₹\s]/g, ''))
        if (isNaN(value)) continue
        
        // Detect debit/withdrawal columns
        if (
          lowerKey.includes('debit') ||
          lowerKey.includes('withdrawal') ||
          lowerKey.includes('dr ') ||
          lowerKey === 'dr' ||
          lowerKey.includes('paid') ||
          lowerKey.includes('expense')
        ) {
          debitAmount = Math.abs(value)
          console.log(`✓ Debit: ${value}`)
        }
        
        // Detect credit/deposit columns
        if (
          lowerKey.includes('credit') ||
          lowerKey.includes('deposit') ||
          lowerKey.includes('cr ') ||
          lowerKey === 'cr' ||
          lowerKey.includes('received') ||
          lowerKey.includes('income')
        ) {
          creditAmount = Math.abs(value)
          console.log(`✓ Credit: ${value}`)
        }
        
        // Detect balance
        if (lowerKey.includes('balance') || lowerKey.includes('closing')) {
          balance = value
        }
      }

      // If no debit/credit columns, look for single "Amount" column and type indicator
      if (debitAmount === 0 && creditAmount === 0) {
        for (const key of allKeys) {
          const lowerKey = key.toLowerCase().trim()
          const rawValue = String(row[key] || '').trim()
          
          if (lowerKey.includes('amount') && !lowerKey.includes('balance')) {
            const value = parseFloat(rawValue.replace(/[,₹\s]/g, ''))
            if (!isNaN(value) && value !== 0) {
              // Check for type indicator
              let isCredit = false
              for (const typeKey of allKeys) {
                const typeLower = typeKey.toLowerCase().trim()
                const typeValue = String(row[typeKey] || '').toLowerCase().trim()
                
                if (
                  (typeLower.includes('type') || typeLower.includes('cr/dr')) &&
                  (typeValue.includes('cr') || typeValue.includes('credit') || typeValue.includes('deposit'))
                ) {
                  isCredit = true
                  break
                }
              }
              
              if (isCredit) {
                creditAmount = Math.abs(value)
              } else {
                debitAmount = Math.abs(value)
              }
              console.log(`✓ Amount: ${value} (${isCredit ? 'credit' : 'debit'})`)
              break
            }
          }
        }
      }

      // Skip if no valid amount found
      if (debitAmount === 0 && creditAmount === 0) {
        console.log(`✗ No valid amount in row, skipping`)
        continue
      }

      // INTELLIGENT DESCRIPTION DETECTION
      let description = ''
      for (const key of allKeys) {
        const lowerKey = key.toLowerCase().trim()
        const value = String(row[key] || '').trim()
        
        if (
          lowerKey.includes('description') ||
          lowerKey.includes('narration') ||
          lowerKey.includes('particulars') ||
          lowerKey.includes('remarks') ||
          lowerKey.includes('details') ||
          lowerKey.includes('transaction')
        ) {
          if (value && value.length > 3 && !value.match(/^\d+$/)) {
            description = value
            console.log(`✓ Description: ${description.substring(0, 50)}`)
            break
          }
        }
      }

      // If no description found, try to find longest text field
      if (!description) {
        let longestText = ''
        for (const key of allKeys) {
          const value = String(row[key] || '').trim()
          if (value.length > longestText.length && !value.match(/^[\d,.\-₹\s]+$/)) {
            longestText = value
          }
        }
        description = longestText || 'Bank Transaction'
      }

      // Skip opening/closing balance rows
      const descLower = description.toLowerCase()
      if (
        descLower.includes('opening balance') ||
        descLower.includes('closing balance') ||
        descLower.includes('total')
      ) {
        console.log(`✗ Skipping balance row: ${description}`)
        continue
      }

      // Determine transaction type and amount
      const type: 'debit' | 'credit' = creditAmount > 0 ? 'credit' : 'debit'
      const amount = type === 'credit' ? creditAmount : -debitAmount

      transactions.push({
        date,
        description: description || 'Bank Transaction',
        amount,
        type,
        balance,
      })
      
      console.log(`✅ Parsed: ${date.toLocaleDateString()} | ${type} | ${amount} | ${description.substring(0, 30)}`)
    } catch (err) {
      console.warn('⚠️ Error parsing row (continuing):', err instanceof Error ? err.message : err)
    }
  }

  console.log(`\n✅ Successfully parsed ${transactions.length} transactions from CSV\n`)
  return transactions
}

/**
 * ULTRA FLEXIBLE Date Parser
 * Handles virtually ANY date format from any bank
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  dateStr = dateStr.trim()

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  let match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (match) {
    const day = parseInt(match[1])
    const month = parseInt(match[2]) - 1
    const year = parseInt(match[3])
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime()) && year >= 2000 && year <= 2030) return date
  }

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  match = dateStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2]) - 1
    const day = parseInt(match[3])
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime()) && year >= 2000 && year <= 2030) return date
  }

  // DD/MM/YY or DD-MM-YY
  match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/)
  if (match) {
    const day = parseInt(match[1])
    const month = parseInt(match[2]) - 1
    let year = parseInt(match[3])
    year = year < 50 ? 2000 + year : 1900 + year
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // DD Mon YYYY (e.g., "15 Dec 2024", "1 Jan 2025")
  match = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+(\d{4})/i)
  if (match) {
    const day = parseInt(match[1])
    const monthMap: {[key: string]: number} = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    }
    const month = monthMap[match[2].toLowerCase().substring(0, 3)]
    const year = parseInt(match[3])
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // Mon DD, YYYY (e.g., "Dec 15, 2024")
  match = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})/i)
  if (match) {
    const monthMap: {[key: string]: number} = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    }
    const month = monthMap[match[1].toLowerCase().substring(0, 3)]
    const day = parseInt(match[2])
    const year = parseInt(match[3])
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // Try ISO 8601 format
  if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) return parsed
  }

  // Last resort: let JS try to parse it
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2030) {
    return parsed
  }

  return null
}

/**
 * UNIVERSAL PDF Parser - Works with ANY bank PDF
 * Extracts transactions from any PDF format using pattern recognition
 */
export async function parsePDFStatement(pdfBuffer: Buffer): Promise<ParsedTransaction[]> {
  try {
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as any).default || pdfParseModule
    const data = await pdfParse(pdfBuffer)
    const text = data.text

    console.log('📄 PDF Text Length:', text.length, 'chars')
    console.log('📄 PDF Preview (first 500 chars):\n', text.substring(0, 500))

    const transactions: ParsedTransaction[] = []
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

    console.log(`📄 Processing ${lines.length} non-empty lines from PDF...`)

    // Strategy 1: Look for table-like structures (most bank statements)
    // Pattern: Date ... Description ... Amount ... Balance
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Try to find date at start of line
      const dateMatch = line.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i)
      
      if (dateMatch) {
        const date = parseDate(dateMatch[1])
        if (!date) continue

        // Look for amounts in this line and next few lines
        const context = lines.slice(i, Math.min(i + 5, lines.length)).join(' ')
        
        // Find all number patterns (potential amounts)
        const amountMatches = [...context.matchAll(/(?:^|\s)([₹\s]*)([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)(?:\s|$)/g)]
        
        if (amountMatches.length === 0) continue

        // Extract description (text between date and first amount)
        const restOfLine = line.substring(dateMatch[0].length).trim()
        let description = restOfLine.split(/\s+[\d,]+(?:\.\d{2})?/)[0] || ''
        
        // Look ahead for description continuation
        if (description.length < 10 && i + 1 < lines.length) {
          const nextLine = lines[i + 1]
          if (!nextLine.match(/^\d/) && !nextLine.match(/^\s*[\d,]+/)) {
            description += ' ' + nextLine.split(/\s+[\d,]+(?:\.\d{2})?/)[0]
          }
        }

        description = description.trim().substring(0, 100)
        
        // Skip if description looks like a header
        if (
          description.toLowerCase().includes('date') ||
          description.toLowerCase().includes('balance') ||
          description.toLowerCase().includes('particulars') ||
          description.toLowerCase().includes('description') ||
          description.toLowerCase().includes('opening') ||
          description.toLowerCase().includes('closing') ||
          description.toLowerCase().includes('total') ||
          description.length < 3
        ) {
          continue
        }

        // Parse amounts - typically last 2-3 numbers are debit/credit/balance
        const amounts = amountMatches
          .map(m => parseFloat(m[2].replace(/,/g, '')))
          .filter(n => !isNaN(n) && n > 0)

        if (amounts.length === 0) continue

        // Heuristic: 
        // - 1 amount = could be debit or credit (check context)
        // - 2 amounts = likely [debit/credit, balance] or [amount, balance]
        // - 3 amounts = likely [debit, credit, balance]
        
        let debit = 0
        let credit = 0
        let balance: number | undefined

        if (amounts.length >= 3) {
          // 3+ amounts: assume debit, credit, balance
          debit = amounts[0]
          credit = amounts[1]
          balance = amounts[amounts.length - 1]
        } else if (amounts.length === 2) {
          // 2 amounts: amount and balance
          balance = amounts[1]
          
          // Check context for debit/credit indicators
          const contextLower = context.toLowerCase()
          if (
            contextLower.includes('cr') || 
            contextLower.includes('credit') ||
            contextLower.includes('deposit') ||
            contextLower.includes('received')
          ) {
            credit = amounts[0]
          } else {
            debit = amounts[0]
          }
        } else {
          // 1 amount: check context
          const contextLower = context.toLowerCase()
          if (
            contextLower.includes('cr') || 
            contextLower.includes('credit') ||
            contextLower.includes('deposit') ||
            contextLower.includes('received')
          ) {
            credit = amounts[0]
          } else {
            debit = amounts[0]
          }
        }

        // Skip if both debit and credit are present and non-zero (likely header or total)
        if (debit > 0 && credit > 0) {
          continue
        }

        const type: 'debit' | 'credit' = credit > 0 ? 'credit' : 'debit'
        const amount = type === 'credit' ? credit : -debit

        transactions.push({
          date,
          description: description || 'PDF Transaction',
          amount,
          type,
          balance,
        })

        console.log(`✅ PDF: ${date.toLocaleDateString()} | ${type} | ${amount} | ${description.substring(0, 40)}`)
      }
    }

    // Strategy 2: If no transactions found with Strategy 1, try simpler pattern
    // Just extract ALL dates and amounts, pair them up
    if (transactions.length === 0) {
      console.log('📄 Strategy 1 failed, trying Strategy 2 (simple extraction)...')
      
      const allDates: Date[] = []
      const allAmounts: number[] = []
      
      for (const line of lines) {
        // Find dates
        const datePatterns = [
          /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
          /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
          /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi,
        ]
        
        for (const pattern of datePatterns) {
          const matches = [...line.matchAll(pattern)]
          for (const m of matches) {
            const d = parseDate(m[1])
            if (d) allDates.push(d)
          }
        }
        
        // Find amounts
        const amountMatches = [...line.matchAll(/([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/g)]
        for (const m of amountMatches) {
          const num = parseFloat(m[1].replace(/,/g, ''))
          if (!isNaN(num) && num >= 10 && num <= 10000000) {
            allAmounts.push(num)
          }
        }
      }
      
      console.log(`📄 Found ${allDates.length} dates and ${allAmounts.length} amounts`)
      
      // Pair them up
      const minLength = Math.min(allDates.length, allAmounts.length)
      for (let i = 0; i < minLength; i++) {
        transactions.push({
          date: allDates[i],
          description: `Transaction ${i + 1}`,
          amount: -allAmounts[i], // Assume debit by default
          type: 'debit',
        })
      }
    }

    console.log(`\n✅ Successfully parsed ${transactions.length} transactions from PDF\n`)
    return transactions

  } catch (error) {
    console.error('❌ PDF parsing error:', error)
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

