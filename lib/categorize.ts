import { Category } from '@prisma/client'

/**
 * Category descriptions for LLM prompts and UI display
 */
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  // Personnel & HR
  [Category.Hiring]: 'Recruitment costs, hiring platform fees, job postings, recruitment agencies',
  [Category.Salaries]: 'Employee salaries, wages, payroll, compensation, bonuses, incentives',
  [Category.Benefits]: 'Health insurance, PF, ESIC, gratuity, employee benefits, medical',
  [Category.Training]: 'Employee training, courses, certifications, skill development, workshops',
  
  // Sales & Marketing
  [Category.Marketing]: 'General marketing, campaigns, content creation, PR, branding',
  [Category.Sales]: 'Sales commissions, CRM, sales tools, business development',
  [Category.Advertising]: 'Google Ads, Facebook Ads, LinkedIn, social media ads, PPC, display ads',
  [Category.Events]: 'Conferences, exhibitions, trade shows, corporate events, sponsorships',
  
  // Technology
  [Category.SaaS]: 'Software subscriptions, SaaS tools, licenses, productivity apps',
  [Category.Cloud]: 'AWS, Azure, GCP, cloud hosting, infrastructure, servers, CDN',
  [Category.ITInfrastructure]: 'Network equipment, datacenter, IT infrastructure, bandwidth',
  [Category.Software]: 'One-time software purchases, desktop apps, development tools',
  [Category.Hardware]: 'Computers, laptops, phones, printers, monitors, peripherals',
  [Category.Security]: 'Cybersecurity, antivirus, security audits, penetration testing, VPN',
  
  // Operations
  [Category.Rent]: 'Office rent, lease, coworking space, workspace, property',
  [Category.Utilities]: 'Electricity, water, internet, phone bills, broadband, telecom',
  [Category.OfficeSupplies]: 'Stationery, office supplies, pantry, consumables',
  [Category.Equipment]: 'Office furniture, desks, chairs, equipment purchases',
  [Category.Maintenance]: 'Repairs, maintenance, AMC, facility management',
  
  // Professional Services
  [Category.Legal]: 'Legal fees, lawyer, attorney, compliance, contracts, litigation',
  [Category.Accounting]: 'CA fees, bookkeeping, audit, chartered accountant, tax filing',
  [Category.Consulting]: 'Business consulting, strategy, advisory services',
  [Category.ProfessionalServices]: 'Freelancers, contractors, professional fees, external services',
  
  // Travel & Entertainment
  [Category.Travel]: 'Flights, hotels, transportation, cab, uber, ola, business travel',
  [Category.Meals]: 'Team meals, client meals, food expenses, catering',
  [Category.Entertainment]: 'Client entertainment, team outings, recreational activities',
  
  // Finance
  [Category.Taxes]: 'GST, TDS, income tax, professional tax, government fees, duties',
  [Category.Insurance]: 'Business insurance, liability, asset insurance, coverage',
  [Category.BankFees]: 'Bank charges, account fees, transaction fees, wire transfer fees',
  [Category.PaymentProcessing]: 'Razorpay fees, Stripe fees, payment gateway charges',
  [Category.InterestCharges]: 'Loan interest, credit card interest, finance charges',
  
  // R&D
  [Category.ResearchDevelopment]: 'R&D expenses, research, innovation, prototype development',
  
  // Customer Operations
  [Category.CustomerSupport]: 'Support tools, helpdesk, customer service, ticketing systems',
  [Category.Subscriptions]: 'Non-SaaS subscriptions, memberships, recurring services',
  
  // Other
  [Category.Refunds]: 'Customer refunds, returns, chargebacks, reversals',
  [Category.Depreciation]: 'Asset depreciation, amortization',
  [Category.BadDebts]: 'Write-offs, uncollectible receivables, bad debt expenses',
  [Category.G_A]: 'General and administrative, miscellaneous operational expenses',
  [Category.Other]: 'Uncategorized expenses, miscellaneous'
}

/**
 * Category display names for UI
 */
export const CATEGORY_DISPLAY_NAMES: Record<Category, string> = {
  [Category.Hiring]: 'Hiring & Recruitment',
  [Category.Salaries]: 'Salaries & Wages',
  [Category.Benefits]: 'Employee Benefits',
  [Category.Training]: 'Training & Development',
  [Category.Marketing]: 'Marketing',
  [Category.Sales]: 'Sales',
  [Category.Advertising]: 'Advertising',
  [Category.Events]: 'Events & Conferences',
  [Category.SaaS]: 'SaaS Tools',
  [Category.Cloud]: 'Cloud Services',
  [Category.ITInfrastructure]: 'IT Infrastructure',
  [Category.Software]: 'Software',
  [Category.Hardware]: 'Hardware',
  [Category.Security]: 'Security',
  [Category.Rent]: 'Rent & Facilities',
  [Category.Utilities]: 'Utilities',
  [Category.OfficeSupplies]: 'Office Supplies',
  [Category.Equipment]: 'Equipment & Furniture',
  [Category.Maintenance]: 'Maintenance',
  [Category.Legal]: 'Legal',
  [Category.Accounting]: 'Accounting & Audit',
  [Category.Consulting]: 'Consulting',
  [Category.ProfessionalServices]: 'Professional Services',
  [Category.Travel]: 'Travel',
  [Category.Meals]: 'Meals & Food',
  [Category.Entertainment]: 'Entertainment',
  [Category.Taxes]: 'Taxes & Duties',
  [Category.Insurance]: 'Insurance',
  [Category.BankFees]: 'Bank Fees',
  [Category.PaymentProcessing]: 'Payment Processing',
  [Category.InterestCharges]: 'Interest & Finance',
  [Category.ResearchDevelopment]: 'R&D',
  [Category.CustomerSupport]: 'Customer Support',
  [Category.Subscriptions]: 'Subscriptions',
  [Category.Refunds]: 'Refunds & Returns',
  [Category.Depreciation]: 'Depreciation',
  [Category.BadDebts]: 'Bad Debts',
  [Category.G_A]: 'General & Admin',
  [Category.Other]: 'Other'
}

/**
 * Category groups for dashboard organization
 */
export const CATEGORY_GROUPS: Record<string, Category[]> = {
  'Personnel': [Category.Hiring, Category.Salaries, Category.Benefits, Category.Training],
  'Sales & Marketing': [Category.Marketing, Category.Sales, Category.Advertising, Category.Events],
  'Technology': [Category.SaaS, Category.Cloud, Category.ITInfrastructure, Category.Software, Category.Hardware, Category.Security],
  'Operations': [Category.Rent, Category.Utilities, Category.OfficeSupplies, Category.Equipment, Category.Maintenance],
  'Professional Services': [Category.Legal, Category.Accounting, Category.Consulting, Category.ProfessionalServices],
  'Travel & Entertainment': [Category.Travel, Category.Meals, Category.Entertainment],
  'Finance': [Category.Taxes, Category.Insurance, Category.BankFees, Category.PaymentProcessing, Category.InterestCharges],
  'Other': [Category.ResearchDevelopment, Category.CustomerSupport, Category.Subscriptions, Category.Refunds, Category.Depreciation, Category.BadDebts, Category.G_A, Category.Other]
}

/**
 * Keywords for rule-based categorization (fallback when LLM unavailable)
 */
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  // Personnel & HR
  [Category.Hiring]: [
    'hiring', 'recruitment', 'recruiter', 'recruiting', 'candidate', 'interview', 'hr',
    'job board', 'linkedin recruiter', 'indeed', 'naukri', 'hiring platform', 'talent acquisition'
  ],
  [Category.Salaries]: [
    'salary', 'salaries', 'payroll', 'wage', 'wages', 'compensation', 'bonus', 'incentive',
    'employee payout', 'staff salary', 'sal payout', 'emp salary'
  ],
  [Category.Benefits]: [
    'pf', 'provident fund', 'esic', 'esi', 'gratuity', 'health insurance', 'medical insurance',
    'group insurance', 'employee benefit', 'mediclaim', 'wellness'
  ],
  [Category.Training]: [
    'training', 'course', 'certification', 'udemy', 'coursera', 'workshop', 'skill development',
    'learning', 'conference fee', 'seminar', 'webinar registration'
  ],
  
  // Sales & Marketing
  [Category.Marketing]: [
    'marketing', 'campaign', 'promotion', 'promo', 'content', 'copywriting', 'blog',
    'brand', 'branding', 'pr', 'public relations', 'hubspot', 'mailchimp', 'sendgrid'
  ],
  [Category.Sales]: [
    'sales commission', 'sales tool', 'crm', 'salesforce', 'pipedrive', 'zoho crm',
    'business development', 'lead generation', 'outreach'
  ],
  [Category.Advertising]: [
    'google ads', 'facebook ads', 'instagram', 'linkedin ads', 'twitter ads', 'social media ad',
    'ppc', 'cpc', 'cpm', 'adwords', 'meta ads', 'meta business', 'display ads', 'bing ads',
    'youtube ads', 'tiktok ads', 'amazon ads'
  ],
  [Category.Events]: [
    'event', 'conference', 'exhibition', 'booth', 'trade show', 'sponsorship',
    'meetup', 'networking event', 'corporate event'
  ],
  
  // Technology
  [Category.SaaS]: [
    'saas', 'subscription', 'slack', 'notion', 'airtable', 'trello', 'asana', 'jira', 'confluence',
    'monday', 'zoom', 'teams', 'calendly', 'figma', 'canva', 'adobe', 'github', 'gitlab',
    'bitbucket', 'dropbox', 'box', 'lastpass', '1password', 'okta', 'auth0', 'intercom',
    'zendesk', 'freshdesk', 'typeform', 'surveymonkey', 'miro', 'loom'
  ],
  [Category.Cloud]: [
    'aws', 'amazon web services', 'azure', 'microsoft azure', 'gcp', 'google cloud',
    'digitalocean', 'linode', 'vultr', 'heroku', 'netlify', 'vercel', 'cloudflare',
    's3', 'ec2', 'rds', 'lambda', 'cloudfront', 'route53', 'firebase', 'supabase',
    'mongodb atlas', 'redis cloud', 'elastic cloud'
  ],
  [Category.ITInfrastructure]: [
    'infrastructure', 'datacenter', 'colocation', 'bandwidth', 'cdn', 'fastly',
    'network', 'router', 'switch', 'firewall', 'server hosting'
  ],
  [Category.Software]: [
    'software license', 'perpetual license', 'microsoft office', 'windows license',
    'antivirus', 'norton', 'mcafee', 'development tool'
  ],
  [Category.Hardware]: [
    'laptop', 'computer', 'macbook', 'dell', 'hp computer', 'lenovo', 'monitor', 'keyboard',
    'mouse', 'webcam', 'headphone', 'printer', 'phone', 'iphone', 'android device'
  ],
  [Category.Security]: [
    'security', 'cybersecurity', 'penetration test', 'security audit', 'vpn', 'nordvpn',
    'expressvpn', 'crowdstrike', 'sophos', 'palo alto', 'firewall service'
  ],
  
  // Operations
  [Category.Rent]: [
    'rent', 'lease', 'office rent', 'coworking', 'workspace', 'wework', 'regus', 'awfis',
    'property', 'premises', 'space rental'
  ],
  [Category.Utilities]: [
    'utility', 'utilities', 'electric', 'electricity', 'water', 'internet', 'wifi', 'broadband',
    'phone bill', 'mobile bill', 'telecom', 'airtel', 'jio', 'vodafone', 'bsnl', 'act fibernet'
  ],
  [Category.OfficeSupplies]: [
    'stationery', 'supplies', 'pantry', 'snacks', 'coffee', 'tea', 'office supplies',
    'paper', 'ink', 'toner', 'cleaning supplies'
  ],
  [Category.Equipment]: [
    'furniture', 'desk', 'chair', 'ergonomic', 'office equipment', 'table',
    'filing cabinet', 'whiteboard', 'projector'
  ],
  [Category.Maintenance]: [
    'maintenance', 'repair', 'amc', 'annual maintenance', 'facility', 'housekeeping',
    'pest control', 'deep cleaning'
  ],
  
  // Professional Services
  [Category.Legal]: [
    'legal', 'lawyer', 'attorney', 'law firm', 'litigation', 'contract review',
    'trademark', 'patent', 'copyright', 'legal counsel', 'advocate'
  ],
  [Category.Accounting]: [
    'accounting', 'ca', 'chartered accountant', 'bookkeep', 'audit', 'auditor',
    'tax filing', 'gst filing', 'compliance', 'quickbooks', 'xero', 'zoho books', 'tally'
  ],
  [Category.Consulting]: [
    'consulting', 'consultant', 'advisory', 'strategy', 'business consultant',
    'management consulting', 'mckinsey', 'bcg', 'bain'
  ],
  [Category.ProfessionalServices]: [
    'freelance', 'contractor', 'professional fee', 'designer', 'developer',
    'agency', 'outsource', 'upwork', 'fiverr', 'toptal'
  ],
  
  // Travel & Entertainment
  [Category.Travel]: [
    'flight', 'airline', 'indigo', 'spicejet', 'air india', 'vistara',
    'hotel', 'oyo', 'taj', 'marriott', 'airbnb', 'cab', 'uber', 'ola', 'taxi',
    'travel', 'transport', 'bus', 'train', 'irctc', 'makemytrip', 'cleartrip'
  ],
  [Category.Meals]: [
    'meal', 'lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'swiggy', 'zomato',
    'team lunch', 'client dinner', 'catering', 'order food'
  ],
  [Category.Entertainment]: [
    'entertainment', 'team outing', 'party', 'celebration', 'offsite',
    'client entertainment', 'recreational', 'tickets', 'movie'
  ],
  
  // Finance
  [Category.Taxes]: [
    'tax', 'gst', 'tds', 'income tax', 'professional tax', 'govt fee', 'government',
    'challan', 'filing fee', 'registration fee', 'stamp duty', 'mca fee'
  ],
  [Category.Insurance]: [
    'insurance', 'business insurance', 'liability insurance', 'asset insurance',
    'coverage', 'premium', 'policy'
  ],
  [Category.BankFees]: [
    'bank charge', 'account fee', 'bank fee', 'wire transfer', 'rtgs charge', 'neft charge',
    'imps charge', 'cheque book', 'bank transaction', 'account maintenance'
  ],
  [Category.PaymentProcessing]: [
    'razorpay', 'stripe', 'paypal', 'paytm business', 'payment gateway',
    'transaction fee', 'processing fee', 'merchant fee', 'pg charge'
  ],
  [Category.InterestCharges]: [
    'interest', 'loan interest', 'credit card interest', 'emi', 'finance charge',
    'overdraft interest', 'working capital interest'
  ],
  
  // R&D
  [Category.ResearchDevelopment]: [
    'r&d', 'research', 'development', 'innovation', 'prototype', 'experiment',
    'research grant', 'lab', 'testing'
  ],
  
  // Customer Operations
  [Category.CustomerSupport]: [
    'customer support', 'helpdesk', 'freshdesk', 'zendesk', 'intercom', 'crisp',
    'support tool', 'ticketing', 'call center', 'chat support'
  ],
  [Category.Subscriptions]: [
    'membership', 'annual subscription', 'magazine', 'news subscription',
    'club membership', 'professional membership'
  ],
  
  // Other
  [Category.Refunds]: [
    'refund', 'return', 'chargeback', 'reversal', 'credit note', 'customer refund'
  ],
  [Category.Depreciation]: [
    'depreciation', 'amortization', 'asset depreciation', 'book depreciation'
  ],
  [Category.BadDebts]: [
    'bad debt', 'write off', 'write-off', 'uncollectible', 'provision for doubtful'
  ],
  [Category.G_A]: [
    'general', 'admin', 'administrative', 'miscellaneous', 'misc', 'office',
    'incorporation', 'license', 'permit'
  ],
  [Category.Other]: []
}

/**
 * Smart auto-categorization based on comprehensive keywords
 * This is the fallback when LLM is not available
 */
export function categorizeExpense(description: string): Category {
  if (!description) return Category.Other
  
  const desc = description.toLowerCase()
  
  // Check each category's keywords in priority order
  const priorityOrder: Category[] = [
    // Most specific first
    Category.Salaries,
    Category.Hiring,
    Category.Benefits,
    Category.Training,
    Category.Advertising,
    Category.Cloud,
    Category.SaaS,
    Category.ITInfrastructure,
    Category.Security,
    Category.Hardware,
    Category.Software,
    Category.PaymentProcessing,
    Category.BankFees,
    Category.Taxes,
    Category.Insurance,
    Category.InterestCharges,
    Category.Legal,
    Category.Accounting,
    Category.Consulting,
    Category.ProfessionalServices,
    Category.Rent,
    Category.Utilities,
    Category.OfficeSupplies,
    Category.Equipment,
    Category.Maintenance,
    Category.Travel,
    Category.Meals,
    Category.Entertainment,
    Category.Events,
    Category.Marketing,
    Category.Sales,
    Category.ResearchDevelopment,
    Category.CustomerSupport,
    Category.Subscriptions,
    Category.Refunds,
    Category.Depreciation,
    Category.BadDebts,
    Category.G_A,
    Category.Other
  ]
  
  for (const category of priorityOrder) {
    const keywords = CATEGORY_KEYWORDS[category]
    if (keywords.some(keyword => desc.includes(keyword))) {
      return category
    }
  }
  
  // Default to Other if nothing matches
  return Category.Other
}

/**
 * Get display name for a category
 */
export function formatCategory(category: Category): string {
  return CATEGORY_DISPLAY_NAMES[category] || category
}

/**
 * Get description for a category
 */
export function getCategoryDescription(category: Category): string {
  return CATEGORY_DESCRIPTIONS[category] || ''
}

/**
 * Get all categories as array
 */
export function getAllCategories(): Category[] {
  return Object.values(Category)
}

/**
 * Get category group for a category
 */
export function getCategoryGroup(category: Category): string {
  for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
    if (categories.includes(category)) {
      return group
    }
  }
  return 'Other'
}

/**
 * Map old categories to new ones (for backward compatibility)
 */
export function migrateCategory(oldCategory: string): Category {
  const mapping: Record<string, Category> = {
    'Hiring': Category.Hiring,
    'Marketing': Category.Marketing,
    'SaaS': Category.SaaS,
    'Cloud': Category.Cloud,
    'G_A': Category.G_A
  }
  return mapping[oldCategory] || Category.Other
}

/**
 * Test the categorization with sample data
 */
export function testCategorization() {
  const tests = [
    { desc: 'SALARY PAYOUT - BONUS', expected: Category.Salaries },
    { desc: 'GOOGLE CLOUD PLATFORM', expected: Category.Cloud },
    { desc: 'STRIPE FEES', expected: Category.PaymentProcessing },
    { desc: 'META ADS', expected: Category.Advertising },
    { desc: 'GITHUB INC', expected: Category.SaaS },
    { desc: 'ZOOM VIDEO COMMUNICATIONS', expected: Category.SaaS },
    { desc: 'OFFICE RENT - WEWORK', expected: Category.Rent },
    { desc: 'INTERNET & UTILITIES', expected: Category.Utilities },
    { desc: 'UBER TRIP', expected: Category.Travel },
    { desc: 'RAZORPAY PAYMENT GATEWAY', expected: Category.PaymentProcessing },
    { desc: 'CA FEES - TAX FILING', expected: Category.Accounting },
    { desc: 'LAPTOP PURCHASE DELL', expected: Category.Hardware },
  ]
  
  console.log('=== CATEGORIZATION TESTS ===')
  let passed = 0
  for (const test of tests) {
    const result = categorizeExpense(test.desc)
    const pass = result === test.expected
    if (pass) passed++
    console.log(`${pass ? '✓' : '✗'} "${test.desc}" → ${result} ${!pass ? `(expected ${test.expected})` : ''}`)
  }
  console.log(`\nPassed: ${passed}/${tests.length}`)
  console.log('===========================')
}
