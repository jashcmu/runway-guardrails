/**
 * Transaction Validator
 * Validates transactions before saving to ensure data integrity
 * 
 * Validates:
 * - Amount (must be non-zero)
 * - Date (not too far in the future)
 * - Description (not empty)
 * - Company exists
 * - Category is valid
 * - Currency is valid
 */

import { prisma } from '../prisma'
import { Category } from '@prisma/client'

// Types
export interface TransactionInput {
  companyId: string
  amount: number
  category: Category
  description?: string | null
  date: Date
  currency?: string
  vendorName?: string | null
  expenseType?: string
  frequency?: string | null
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

// Valid currencies
const VALID_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED']

// Valid expense types
const VALID_EXPENSE_TYPES = ['one-time', 'recurring']

// Valid frequencies
const VALID_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', null, undefined]

/**
 * Validate a transaction before saving
 */
export async function validateTransaction(
  input: TransactionInput
): Promise<ValidationResult> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 1. Validate amount
  if (input.amount === 0) {
    errors.push({
      field: 'amount',
      message: 'Transaction amount cannot be zero',
      code: 'ZERO_AMOUNT'
    })
  }

  if (Math.abs(input.amount) > 100000000000) { // 100 billion limit
    errors.push({
      field: 'amount',
      message: 'Transaction amount exceeds maximum allowed',
      code: 'AMOUNT_TOO_LARGE'
    })
  }

  // Large amount warning
  if (Math.abs(input.amount) > 10000000) { // > 1 crore
    warnings.push({
      field: 'amount',
      message: 'Large transaction amount - please verify',
      code: 'LARGE_AMOUNT'
    })
  }

  // 2. Validate date
  const now = new Date()
  const futureLimit = new Date()
  futureLimit.setDate(futureLimit.getDate() + 7) // Allow up to 7 days in future

  if (input.date > futureLimit) {
    errors.push({
      field: 'date',
      message: 'Transaction date cannot be more than 7 days in the future',
      code: 'FUTURE_DATE'
    })
  }

  const pastLimit = new Date()
  pastLimit.setFullYear(pastLimit.getFullYear() - 10) // 10 years back limit

  if (input.date < pastLimit) {
    errors.push({
      field: 'date',
      message: 'Transaction date is too far in the past',
      code: 'PAST_DATE'
    })
  }

  // Old transaction warning
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  if (input.date < oneYearAgo) {
    warnings.push({
      field: 'date',
      message: 'Transaction is more than a year old',
      code: 'OLD_TRANSACTION'
    })
  }

  // 3. Validate company exists
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true }
  })

  if (!company) {
    errors.push({
      field: 'companyId',
      message: 'Company not found',
      code: 'COMPANY_NOT_FOUND'
    })
  }

  // 4. Validate category
  const validCategories = Object.values(Category)
  if (!validCategories.includes(input.category)) {
    errors.push({
      field: 'category',
      message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      code: 'INVALID_CATEGORY'
    })
  }

  // 5. Validate currency
  const currency = input.currency || 'INR'
  if (!VALID_CURRENCIES.includes(currency)) {
    errors.push({
      field: 'currency',
      message: `Invalid currency. Supported: ${VALID_CURRENCIES.join(', ')}`,
      code: 'INVALID_CURRENCY'
    })
  }

  // 6. Validate expense type if provided
  if (input.expenseType && !VALID_EXPENSE_TYPES.includes(input.expenseType)) {
    errors.push({
      field: 'expenseType',
      message: `Invalid expense type. Must be: ${VALID_EXPENSE_TYPES.join(' or ')}`,
      code: 'INVALID_EXPENSE_TYPE'
    })
  }

  // 7. Validate frequency if provided
  if (input.frequency && !VALID_FREQUENCIES.includes(input.frequency)) {
    errors.push({
      field: 'frequency',
      message: 'Invalid frequency. Must be: weekly, monthly, quarterly, or yearly',
      code: 'INVALID_FREQUENCY'
    })
  }

  // 8. Check for recurring expense without frequency
  if (input.expenseType === 'recurring' && !input.frequency) {
    warnings.push({
      field: 'frequency',
      message: 'Recurring expense without frequency specified',
      code: 'MISSING_FREQUENCY'
    })
  }

  // 9. Validate description (warn if empty for expenses)
  if (input.amount < 0 && (!input.description || input.description.trim() === '')) {
    warnings.push({
      field: 'description',
      message: 'Expense without description',
      code: 'EMPTY_DESCRIPTION'
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate multiple transactions (batch)
 */
export async function validateTransactionsBatch(
  inputs: TransactionInput[]
): Promise<{
  results: Map<number, ValidationResult>
  allValid: boolean
  totalErrors: number
  totalWarnings: number
}> {
  const results = new Map<number, ValidationResult>()
  let totalErrors = 0
  let totalWarnings = 0

  for (let i = 0; i < inputs.length; i++) {
    const result = await validateTransaction(inputs[i])
    results.set(i, result)
    totalErrors += result.errors.length
    totalWarnings += result.warnings.length
  }

  return {
    results,
    allValid: totalErrors === 0,
    totalErrors,
    totalWarnings
  }
}

/**
 * Check for potential duplicate transaction
 */
export async function checkDuplicate(
  input: TransactionInput
): Promise<{
  isDuplicate: boolean
  existingTransactionId?: string
  matchReason?: string
}> {
  // Check for same amount, date, and similar description
  const startDate = new Date(input.date)
  startDate.setDate(startDate.getDate() - 1)
  
  const endDate = new Date(input.date)
  endDate.setDate(endDate.getDate() + 1)

  const existing = await prisma.transaction.findFirst({
    where: {
      companyId: input.companyId,
      amount: input.amount,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      id: true,
      description: true
    }
  })

  if (existing) {
    return {
      isDuplicate: true,
      existingTransactionId: existing.id,
      matchReason: `Same amount (${input.amount}) within 1 day`
    }
  }

  return { isDuplicate: false }
}

/**
 * Sanitize transaction input
 */
export function sanitizeTransactionInput(input: TransactionInput): TransactionInput {
  return {
    ...input,
    description: input.description?.trim().slice(0, 500) || null,
    vendorName: input.vendorName?.trim().slice(0, 200) || null,
    currency: (input.currency || 'INR').toUpperCase(),
    expenseType: input.expenseType || 'one-time'
  }
}
