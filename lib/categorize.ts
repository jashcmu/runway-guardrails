import { Category } from '@prisma/client'

/**
 * Smart auto-categorization based on comprehensive keywords
 * This is the SINGLE SOURCE OF TRUTH for all categorization
 */
export function categorizeExpense(description: string): Category {
  if (!description) return Category.G_A
  
  const desc = description.toLowerCase()
  
  // HIRING & SALARIES - Most comprehensive keywords
  const hiringKeywords = [
    // Direct salary/payroll
    'salary', 'salaries', 'payroll', 'wage', 'wages', 'compensation', 'bonus', 'incentive',
    // HR & Recruitment
    'hire', 'hiring', 'recruitment', 'recruiter', 'recruiting', 'candidate', 'interview', 'hr', 'human resource',
    // Employee related
    'employee', 'staff', 'staffing', 'personnel', 'headcount', 'onboard', 'contractor',
    // Benefits
    'pf', 'provident fund', 'esic', 'esi', 'gratuity', 'insurance', 'health', 'medical', 'benefits'
  ]
  
  // MARKETING - Everything related to customer acquisition
  const marketingKeywords = [
    // General marketing
    'marketing', 'advertis', 'campaign', 'promotion', 'promo',
    // Digital marketing
    'google ads', 'facebook ads', 'instagram', 'linkedin', 'twitter', 'social media', 'social',
    'seo', 'sem', 'ppc', 'cpc', 'cpm', 'adwords', 'meta ads', 'meta', 'facebook', 'fb',
    // Content & branding
    'content', 'copywriting', 'blog', 'article', 'brand', 'branding', 'pr', 'public relations',
    'influencer', 'sponsorship', 'event', 'conference', 'exhibition', 'booth',
    // Analytics
    'analytics', 'tracking', 'pixel', 'tag manager', 'mixpanel', 'amplitude'
  ]
  
  // SAAS & SOFTWARE - All software subscriptions
  const saasKeywords = [
    // General
    'saas', 'software', 'subscription', 'license', 'app', 'application', 'platform', 'service', 'api',
    // Specific tools (IMPORTANT: Add exact names)
    'slack', 'notion', 'airtable', 'trello', 'asana', 'jira', 'confluence', 'monday',
    'zoom', 'meet', 'teams', 'webex', 'calendly', 'video', 'communication',
    'hubspot', 'salesforce', 'crm', 'zoho', 'pipedrive',
    'mailchimp', 'sendgrid', 'twilio', 'postmark',
    'github', 'gitlab', 'bitbucket', 'figma', 'canva', 'adobe',
    'quickbooks', 'xero', 'freshbooks', 'razorpay', 'stripe', 'paypal', 'payment', 'gateway', 'fees',
    'dropbox', 'drive', 'box', 'onedrive',
    'lastpass', '1password', 'okta', 'auth0'
  ]
  
  // CLOUD & INFRASTRUCTURE - Tech infrastructure
  const cloudKeywords = [
    // Cloud providers
    'aws', 'amazon web services', 'azure', 'microsoft azure', 'gcp', 'google cloud',
    'digitalocean', 'linode', 'vultr', 'heroku', 'netlify', 'vercel',
    // Services
    'cloud', 'hosting', 'server', 'database', 'storage', 'cdn', 'compute',
    's3', 'ec2', 'rds', 'lambda', 'cloudfront', 'route53',
    'infrastructure', 'datacenter', 'colocation', 'bandwidth',
    // Specific services
    'cloudflare', 'fastly', 'mongodb', 'atlas', 'firebase', 'supabase'
  ]
  
  // GENERAL & ADMIN - Office and operational costs
  const gaKeywords = [
    // Office
    'office', 'rent', 'lease', 'coworking', 'workspace', 'wework', 'regus',
    'furniture', 'desk', 'chair', 'equipment',
    // Utilities
    'utility', 'utilities', 'electric', 'electricity', 'water', 'internet', 'wifi', 'broadband',
    'phone', 'mobile', 'telecom', 'airtel', 'jio', 'vodafone',
    // Admin
    'general', 'admin', 'administrative', 'miscellaneous', 'misc',
    // Legal & Compliance
    'legal', 'lawyer', 'attorney', 'compliance', 'audit', 'auditor', 'ca', 'chartered accountant',
    'registration', 'license', 'permit', 'incorporation', 'trademark', 'patent',
    // Banking & Finance
    'bank', 'banking', 'account', 'finance', 'accounting', 'bookkeep',
    'tax', 'gst', 'tds', 'income tax', 'filing',
    // Travel
    'travel', 'flight', 'hotel', 'cab', 'uber', 'ola', 'taxi', 'transport',
    // Supplies
    'stationery', 'supplies', 'pantry', 'snacks', 'coffee', 'tea'
  ]
  
  // Check in priority order (most specific first)
  if (hiringKeywords.some(keyword => desc.includes(keyword))) return Category.Hiring
  if (cloudKeywords.some(keyword => desc.includes(keyword))) return Category.Cloud
  if (saasKeywords.some(keyword => desc.includes(keyword))) return Category.SaaS
  if (marketingKeywords.some(keyword => desc.includes(keyword))) return Category.Marketing
  if (gaKeywords.some(keyword => desc.includes(keyword))) return Category.G_A
  
  // Default to G_A if nothing matches
  return Category.G_A
}

// Helper to get category display name
export function formatCategory(category: Category): string {
  const names: Record<Category, string> = {
    [Category.Hiring]: 'Hiring & Salaries',
    [Category.Marketing]: 'Marketing',
    [Category.SaaS]: 'SaaS Tools',
    [Category.Cloud]: 'Cloud Services',
    [Category.G_A]: 'General & Admin',
  }
  return names[category] || category
}

// Test the categorization
export function testCategorization() {
  const tests = [
    { desc: 'SALARY PAYOUT - BONUS', expected: Category.Hiring },
    { desc: 'GOOGLE CLOUD PLATFORM', expected: Category.Cloud },
    { desc: 'STRIPE FEES', expected: Category.SaaS },
    { desc: 'META ADS', expected: Category.Marketing },
    { desc: 'GITHUB INC', expected: Category.SaaS },
    { desc: 'ZOOM VIDEO COMMUNICATIONS', expected: Category.SaaS },
    { desc: 'OFFICE RENT - WEWORK', expected: Category.G_A },
    { desc: 'INTERNET & UTILITIES', expected: Category.G_A },
  ]
  
  console.log('=== CATEGORIZATION TESTS ===')
  for (const test of tests) {
    const result = categorizeExpense(test.desc)
    const pass = result === test.expected
    console.log(`${pass ? '✓' : '✗'} "${test.desc}" → ${result} ${!pass ? `(expected ${test.expected})` : ''}`)
  }
  console.log('===========================')
}




