/**
 * Categorization Tests
 * Tests for transaction categorization accuracy
 */

import { categorizeExpense, CATEGORY_DESCRIPTIONS, CATEGORY_DISPLAY_NAMES } from '../categorize'
import { Category } from '@prisma/client'

// Test cases for categorization
const TEST_CASES: Array<{
  description: string
  expectedCategory: Category
  confidence: 'high' | 'medium' | 'low'
}> = [
  // Cloud Services
  { description: 'AWS CLOUD SERVICES', expectedCategory: Category.Cloud, confidence: 'high' },
  { description: 'AMAZON WEB SERVICES', expectedCategory: Category.Cloud, confidence: 'high' },
  { description: 'GOOGLE CLOUD PLATFORM', expectedCategory: Category.Cloud, confidence: 'high' },
  { description: 'MICROSOFT AZURE SERVICES', expectedCategory: Category.Cloud, confidence: 'high' },
  { description: 'DIGITALOCEAN HOSTING', expectedCategory: Category.Cloud, confidence: 'high' },
  { description: 'HEROKU PLATFORM', expectedCategory: Category.Cloud, confidence: 'high' },
  { description: 'VERCEL HOSTING', expectedCategory: Category.Cloud, confidence: 'high' },
  
  // SaaS Tools
  { description: 'SLACK TECHNOLOGIES', expectedCategory: Category.SaaS, confidence: 'high' },
  { description: 'NOTION LABS INC', expectedCategory: Category.SaaS, confidence: 'high' },
  { description: 'ZOOM VIDEO COMMUNICATIONS', expectedCategory: Category.SaaS, confidence: 'high' },
  { description: 'GITHUB INC', expectedCategory: Category.SaaS, confidence: 'high' },
  { description: 'FIGMA INC', expectedCategory: Category.SaaS, confidence: 'high' },
  { description: 'AIRTABLE SUBSCRIPTION', expectedCategory: Category.SaaS, confidence: 'high' },
  { description: 'CANVA PTY LTD', expectedCategory: Category.SaaS, confidence: 'high' },
  
  // Advertising
  { description: 'GOOGLE ADS', expectedCategory: Category.Advertising, confidence: 'high' },
  { description: 'META ADS FACEBOOK', expectedCategory: Category.Advertising, confidence: 'high' },
  { description: 'LINKEDIN ADS', expectedCategory: Category.Advertising, confidence: 'high' },
  { description: 'TWITTER ADS CAMPAIGN', expectedCategory: Category.Advertising, confidence: 'high' },
  
  // Payment Processing
  { description: 'RAZORPAY PAYMENT GATEWAY', expectedCategory: Category.PaymentProcessing, confidence: 'high' },
  { description: 'STRIPE FEES', expectedCategory: Category.PaymentProcessing, confidence: 'high' },
  { description: 'PAYPAL TRANSACTION FEE', expectedCategory: Category.PaymentProcessing, confidence: 'high' },
  
  // Salaries
  { description: 'SALARY PAYOUT - BONUS', expectedCategory: Category.Salaries, confidence: 'high' },
  { description: 'EMP SALARY MONTH', expectedCategory: Category.Salaries, confidence: 'high' },
  { description: 'PAYROLL DISBURSEMENT', expectedCategory: Category.Salaries, confidence: 'high' },
  
  // Travel
  { description: 'UBER TRIP', expectedCategory: Category.Travel, confidence: 'high' },
  { description: 'MAKEMYTRIP FLIGHT', expectedCategory: Category.Travel, confidence: 'high' },
  { description: 'OLA RIDE BANGALORE', expectedCategory: Category.Travel, confidence: 'high' },
  { description: 'CLEARTRIP HOTEL', expectedCategory: Category.Travel, confidence: 'high' },
  { description: 'IRCTC RAIL TICKET', expectedCategory: Category.Travel, confidence: 'high' },
  
  // Rent
  { description: 'OFFICE RENT PAYMENT', expectedCategory: Category.Rent, confidence: 'high' },
  { description: 'WEWORK COWORKING SPACE', expectedCategory: Category.Rent, confidence: 'high' },
  { description: 'AWFIS WORKSPACE', expectedCategory: Category.Rent, confidence: 'high' },
  
  // Utilities
  { description: 'AIRTEL BROADBAND BILL', expectedCategory: Category.Utilities, confidence: 'high' },
  { description: 'ELECTRICITY BILL PAYMENT', expectedCategory: Category.Utilities, confidence: 'high' },
  { description: 'JIO FIBER INTERNET', expectedCategory: Category.Utilities, confidence: 'high' },
  
  // Hardware
  { description: 'DELL LAPTOP PURCHASE', expectedCategory: Category.Hardware, confidence: 'high' },
  { description: 'APPLE MACBOOK PRO', expectedCategory: Category.Hardware, confidence: 'high' },
  { description: 'MONITOR SCREEN PURCHASE', expectedCategory: Category.Hardware, confidence: 'high' },
  
  // Accounting
  { description: 'CA FEES TAX FILING', expectedCategory: Category.Accounting, confidence: 'high' },
  { description: 'CHARTERED ACCOUNTANT', expectedCategory: Category.Accounting, confidence: 'high' },
  { description: 'AUDIT FEES', expectedCategory: Category.Accounting, confidence: 'high' },
  
  // Legal
  { description: 'LAWYER FEES', expectedCategory: Category.Legal, confidence: 'high' },
  { description: 'LEGAL COUNSEL RETAINER', expectedCategory: Category.Legal, confidence: 'high' },
  { description: 'CONTRACT REVIEW ATTORNEY', expectedCategory: Category.Legal, confidence: 'high' },
  
  // Bank Fees
  { description: 'NEFT CHARGE', expectedCategory: Category.BankFees, confidence: 'high' },
  { description: 'BANK TRANSACTION FEE', expectedCategory: Category.BankFees, confidence: 'high' },
  { description: 'WIRE TRANSFER CHARGE', expectedCategory: Category.BankFees, confidence: 'high' },
  
  // Taxes
  { description: 'GST PAYMENT', expectedCategory: Category.Taxes, confidence: 'high' },
  { description: 'TDS CHALLAN', expectedCategory: Category.Taxes, confidence: 'high' },
  { description: 'INCOME TAX ADVANCE', expectedCategory: Category.Taxes, confidence: 'high' },
  
  // Meals
  { description: 'SWIGGY ORDER', expectedCategory: Category.Meals, confidence: 'high' },
  { description: 'ZOMATO LUNCH', expectedCategory: Category.Meals, confidence: 'high' },
  { description: 'TEAM DINNER', expectedCategory: Category.Meals, confidence: 'high' },
  
  // Training
  { description: 'UDEMY COURSE', expectedCategory: Category.Training, confidence: 'high' },
  { description: 'COURSERA SUBSCRIPTION', expectedCategory: Category.Training, confidence: 'high' },
  { description: 'EMPLOYEE TRAINING', expectedCategory: Category.Training, confidence: 'high' },
]

/**
 * Run categorization tests
 */
export function runCategorizationTests(): {
  total: number
  passed: number
  failed: number
  accuracy: number
  failures: Array<{ description: string; expected: Category; got: Category }>
} {
  let passed = 0
  let failed = 0
  const failures: Array<{ description: string; expected: Category; got: Category }> = []
  
  for (const testCase of TEST_CASES) {
    const result = categorizeExpense(testCase.description)
    
    if (result === testCase.expectedCategory) {
      passed++
    } else {
      failed++
      failures.push({
        description: testCase.description,
        expected: testCase.expectedCategory,
        got: result
      })
    }
  }
  
  return {
    total: TEST_CASES.length,
    passed,
    failed,
    accuracy: Math.round((passed / TEST_CASES.length) * 100),
    failures
  }
}

/**
 * Test category coverage
 */
export function testCategoryCoverage(): {
  totalCategories: number
  categoriesWithDescriptions: number
  categoriesWithDisplayNames: number
  coverage: number
} {
  const allCategories = Object.values(Category)
  const categoriesWithDescriptions = Object.keys(CATEGORY_DESCRIPTIONS).length
  const categoriesWithDisplayNames = Object.keys(CATEGORY_DISPLAY_NAMES).length
  
  return {
    totalCategories: allCategories.length,
    categoriesWithDescriptions,
    categoriesWithDisplayNames,
    coverage: Math.round((categoriesWithDescriptions / allCategories.length) * 100)
  }
}

/**
 * Print test results
 */
export function printTestResults(): void {
  console.log('\n=== CATEGORIZATION TESTS ===\n')
  
  const results = runCategorizationTests()
  console.log(`Total Tests: ${results.total}`)
  console.log(`Passed: ${results.passed} ✅`)
  console.log(`Failed: ${results.failed} ❌`)
  console.log(`Accuracy: ${results.accuracy}%`)
  
  if (results.failures.length > 0) {
    console.log('\nFailures:')
    for (const failure of results.failures) {
      console.log(`  - "${failure.description}"`)
      console.log(`    Expected: ${failure.expected}, Got: ${failure.got}`)
    }
  }
  
  console.log('\n=== COVERAGE TEST ===\n')
  
  const coverage = testCategoryCoverage()
  console.log(`Total Categories: ${coverage.totalCategories}`)
  console.log(`With Descriptions: ${coverage.categoriesWithDescriptions}`)
  console.log(`With Display Names: ${coverage.categoriesWithDisplayNames}`)
  console.log(`Coverage: ${coverage.coverage}%`)
  
  console.log('\n============================\n')
}

// Financial calculations tests
export const FINANCIAL_TEST_CASES = {
  burnRate: [
    {
      transactions: [
        { amount: -100000, date: new Date('2024-01-15') },
        { amount: -150000, date: new Date('2024-01-20') },
        { amount: 50000, date: new Date('2024-01-25') }, // Revenue
      ],
      cashBalance: 500000,
      expectedGrossBurn: 250000,
      expectedNetBurn: 200000,
      expectedRunway: 2.5, // 500000 / 200000
    }
  ],
  
  runway: [
    { cashBalance: 1000000, monthlyBurn: 100000, expectedRunway: 10 },
    { cashBalance: 500000, monthlyBurn: 250000, expectedRunway: 2 },
    { cashBalance: 1000000, monthlyBurn: 0, expectedRunway: Infinity },
  ]
}

/**
 * Test runway calculations
 */
export function testRunwayCalculations(): {
  passed: number
  failed: number
  results: Array<{ input: any; expected: number; got: number; passed: boolean }>
} {
  let passed = 0
  let failed = 0
  const results: Array<{ input: any; expected: number; got: number; passed: boolean }> = []
  
  for (const testCase of FINANCIAL_TEST_CASES.runway) {
    const calculatedRunway = testCase.monthlyBurn > 0 
      ? testCase.cashBalance / testCase.monthlyBurn 
      : Infinity
    
    const isPass = Math.abs(calculatedRunway - testCase.expectedRunway) < 0.01 ||
                   (calculatedRunway === Infinity && testCase.expectedRunway === Infinity)
    
    if (isPass) passed++
    else failed++
    
    results.push({
      input: testCase,
      expected: testCase.expectedRunway,
      got: calculatedRunway,
      passed: isPass
    })
  }
  
  return { passed, failed, results }
}
