import { prisma } from '@/lib/prisma'

/**
 * Default Chart of Accounts for Indian Companies
 * Following Indian Accounting Standards and Balance Sheet format
 */

export interface AccountTemplate {
  accountCode: string
  name: string
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  subtype?: string
  category?: string
  accountGroup?: string
  isGSTApplicable: boolean
}

export const DEFAULT_CHART_OF_ACCOUNTS: AccountTemplate[] = [
  // ASSETS - Code 1000-1999
  // Current Assets
  {
    accountCode: '1000',
    name: 'Cash',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Cash and Cash Equivalents',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1010',
    name: 'Bank - HDFC',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Cash and Cash Equivalents',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1011',
    name: 'Bank - ICICI',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Cash and Cash Equivalents',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1012',
    name: 'Bank - Axis',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Cash and Cash Equivalents',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1013',
    name: 'Bank - SBI',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Cash and Cash Equivalents',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1020',
    name: 'Razorpay / Payment Gateway',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Cash and Cash Equivalents',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1100',
    name: 'Accounts Receivable',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Receivables',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1110',
    name: 'GST Input Credit Receivable',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Tax Receivables',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1120',
    name: 'TDS Receivable',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Tax Receivables',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  {
    accountCode: '1200',
    name: 'Prepaid Expenses',
    type: 'Asset',
    subtype: 'Current Asset',
    category: 'Prepayments',
    accountGroup: 'Current Assets',
    isGSTApplicable: false,
  },
  
  // Fixed Assets
  {
    accountCode: '1500',
    name: 'Computer Equipment',
    type: 'Asset',
    subtype: 'Fixed Asset',
    category: 'Property, Plant & Equipment',
    accountGroup: 'Fixed Assets',
    isGSTApplicable: true,
  },
  {
    accountCode: '1510',
    name: 'Office Furniture',
    type: 'Asset',
    subtype: 'Fixed Asset',
    category: 'Property, Plant & Equipment',
    accountGroup: 'Fixed Assets',
    isGSTApplicable: true,
  },
  {
    accountCode: '1520',
    name: 'Accumulated Depreciation',
    type: 'Asset',
    subtype: 'Fixed Asset',
    category: 'Contra Asset',
    accountGroup: 'Fixed Assets',
    isGSTApplicable: false,
  },

  // LIABILITIES - Code 2000-2999
  // Current Liabilities
  {
    accountCode: '2000',
    name: 'Accounts Payable',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2100',
    name: 'GST Payable - CGST',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Tax Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2101',
    name: 'GST Payable - SGST',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Tax Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2102',
    name: 'GST Payable - IGST',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Tax Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2110',
    name: 'TDS Payable',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Tax Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2120',
    name: 'PF Payable',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Statutory Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2121',
    name: 'ESI Payable',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Statutory Payables',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  {
    accountCode: '2200',
    name: 'Salaries Payable',
    type: 'Liability',
    subtype: 'Current Liability',
    category: 'Accrued Expenses',
    accountGroup: 'Current Liabilities',
    isGSTApplicable: false,
  },
  
  // Long-term Liabilities
  {
    accountCode: '2500',
    name: 'Long-term Loans',
    type: 'Liability',
    subtype: 'Long-term Liability',
    category: 'Loans',
    accountGroup: 'Long-term Liabilities',
    isGSTApplicable: false,
  },

  // EQUITY - Code 3000-3999
  {
    accountCode: '3000',
    name: 'Share Capital',
    type: 'Equity',
    subtype: 'Capital',
    category: 'Equity',
    accountGroup: 'Shareholders Equity',
    isGSTApplicable: false,
  },
  {
    accountCode: '3100',
    name: 'Retained Earnings',
    type: 'Equity',
    subtype: 'Retained Earnings',
    category: 'Equity',
    accountGroup: 'Shareholders Equity',
    isGSTApplicable: false,
  },
  {
    accountCode: '3200',
    name: 'Current Year Profit/Loss',
    type: 'Equity',
    subtype: 'Net Income',
    category: 'Equity',
    accountGroup: 'Shareholders Equity',
    isGSTApplicable: false,
  },

  // REVENUE - Code 4000-4999
  {
    accountCode: '4000',
    name: 'Service Revenue',
    type: 'Revenue',
    category: 'Operating Revenue',
    accountGroup: 'Revenue',
    isGSTApplicable: true,
  },
  {
    accountCode: '4100',
    name: 'Product Sales',
    type: 'Revenue',
    category: 'Operating Revenue',
    accountGroup: 'Revenue',
    isGSTApplicable: true,
  },
  {
    accountCode: '4200',
    name: 'Consulting Revenue',
    type: 'Revenue',
    category: 'Operating Revenue',
    accountGroup: 'Revenue',
    isGSTApplicable: true,
  },
  {
    accountCode: '4900',
    name: 'Other Income',
    type: 'Revenue',
    category: 'Non-Operating Revenue',
    accountGroup: 'Revenue',
    isGSTApplicable: false,
  },

  // EXPENSES - Code 5000-5999
  // Hiring & Salaries
  {
    accountCode: '5000',
    name: 'Salaries and Wages',
    type: 'Expense',
    category: 'Hiring',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: false,
  },
  {
    accountCode: '5010',
    name: 'Employee Benefits',
    type: 'Expense',
    category: 'Hiring',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: false,
  },
  {
    accountCode: '5020',
    name: 'Contractor Payments',
    type: 'Expense',
    category: 'Hiring',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5030',
    name: 'Recruitment Expenses',
    type: 'Expense',
    category: 'Hiring',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },

  // Marketing
  {
    accountCode: '5100',
    name: 'Digital Marketing',
    type: 'Expense',
    category: 'Marketing',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5110',
    name: 'Content Marketing',
    type: 'Expense',
    category: 'Marketing',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5120',
    name: 'Events and Sponsorships',
    type: 'Expense',
    category: 'Marketing',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },

  // SaaS & Software
  {
    accountCode: '5200',
    name: 'Software Subscriptions',
    type: 'Expense',
    category: 'SaaS',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5210',
    name: 'Payment Gateway Fees',
    type: 'Expense',
    category: 'SaaS',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  
  // Cloud Infrastructure
  {
    accountCode: '5300',
    name: 'Cloud Services',
    type: 'Expense',
    category: 'Cloud',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5310',
    name: 'Server Hosting',
    type: 'Expense',
    category: 'Cloud',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },

  // General & Administrative
  {
    accountCode: '5400',
    name: 'Office Rent',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5410',
    name: 'Utilities',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5420',
    name: 'Internet and Phone',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5430',
    name: 'Legal and Professional Fees',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5440',
    name: 'Bank Charges',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: false,
  },
  {
    accountCode: '5450',
    name: 'Travel and Transportation',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5460',
    name: 'Office Supplies',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
  {
    accountCode: '5470',
    name: 'Depreciation',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: false,
  },
  {
    accountCode: '5480',
    name: 'Miscellaneous Expenses',
    type: 'Expense',
    category: 'G_A',
    accountGroup: 'Operating Expenses',
    isGSTApplicable: true,
  },
]

/**
 * Initialize Chart of Accounts for a new company
 */
export async function initializeChartOfAccounts(companyId: string): Promise<void> {
  console.log(`\n📊 Initializing Chart of Accounts for company ${companyId}...`)
  
  // Check if already initialized
  const existingAccounts = await prisma.accountingAccount.count({
    where: { companyId },
  })

  if (existingAccounts > 0) {
    console.log(`✓ Chart of Accounts already initialized (${existingAccounts} accounts)`)
    return
  }

  // Create all default accounts
  const accountsCreated = []
  for (const template of DEFAULT_CHART_OF_ACCOUNTS) {
    const account = await prisma.accountingAccount.create({
      data: {
        companyId,
        ...template,
      },
    })
    accountsCreated.push(account)
  }

  console.log(`✓ Created ${accountsCreated.length} accounts`)
  console.log(`  - Assets: ${accountsCreated.filter(a => a.type === 'Asset').length}`)
  console.log(`  - Liabilities: ${accountsCreated.filter(a => a.type === 'Liability').length}`)
  console.log(`  - Equity: ${accountsCreated.filter(a => a.type === 'Equity').length}`)
  console.log(`  - Revenue: ${accountsCreated.filter(a => a.type === 'Revenue').length}`)
  console.log(`  - Expenses: ${accountsCreated.filter(a => a.type === 'Expense').length}`)
  console.log('')
}

/**
 * Get account by code
 */
export async function getAccountByCode(companyId: string, accountCode: string) {
  return await prisma.accountingAccount.findFirst({
    where: {
      companyId,
      accountCode,
    },
  })
}

/**
 * Get accounts by type
 */
export async function getAccountsByType(companyId: string, type: string) {
  return await prisma.accountingAccount.findMany({
    where: {
      companyId,
      type,
      isActive: true,
    },
    orderBy: { accountCode: 'asc' },
  })
}

/**
 * Get all accounts for a company
 */
export async function getAllAccounts(companyId: string) {
  return await prisma.accountingAccount.findMany({
    where: { companyId },
    orderBy: { accountCode: 'asc' },
  })
}



