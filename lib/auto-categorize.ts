import { chatCompletion } from './openai-client'
import { Category } from '@prisma/client'

export interface TransactionToCategorize {
  description: string
  amount: number
  date?: Date
}

const CATEGORY_DESCRIPTIONS = {
  [Category.Hiring]: 'Recruitment, hiring, payroll, employee salaries, HR services, staffing agencies',
  [Category.Marketing]: 'Advertising, marketing campaigns, social media ads, SEO, content creation, PR, branding',
  [Category.SaaS]: 'Software subscriptions, SaaS tools, licenses, app purchases, digital services',
  [Category.Cloud]: 'Cloud hosting, AWS, Azure, GCP, infrastructure, servers, data centers, hosting services',
  [Category.G_A]: 'Office rent, utilities, legal fees, accounting, insurance, general administration, G&A expenses',
}

export async function autoCategorizeTransaction(
  transaction: TransactionToCategorize
): Promise<Category> {
  const prompt = `You are a financial categorization assistant for Indian startups. Categorize the following transaction into one of these categories:

Categories:
- Hiring: ${CATEGORY_DESCRIPTIONS[Category.Hiring]}
- Marketing: ${CATEGORY_DESCRIPTIONS[Category.Marketing]}
- SaaS: ${CATEGORY_DESCRIPTIONS[Category.SaaS]}
- Cloud: ${CATEGORY_DESCRIPTIONS[Category.Cloud]}
- G_A: ${CATEGORY_DESCRIPTIONS[Category.G_A]}

Transaction:
Description: "${transaction.description}"
Amount: ₹${transaction.amount.toLocaleString('en-IN')}
${transaction.date ? `Date: ${transaction.date.toLocaleDateString('en-IN')}` : ''}

Consider Indian payment patterns:
- UPI transactions (PhonePe, Google Pay, Paytm)
- NEFT/IMPS/RTGS bank transfers
- Common Indian vendor names and services

Respond with ONLY the category name (Hiring, Marketing, SaaS, Cloud, or G_A). No explanation needed.`

  try {
    const response = await chatCompletion([
      { role: 'system', content: 'You are a financial categorization assistant. Respond with only the category name.' },
      { role: 'user', content: prompt },
    ])

    const categoryName = response.trim().toUpperCase().replace(/[^A-Z_]/g, '')
    
    // Map common variations to enum values
    const categoryMap: Record<string, Category> = {
      'HIRING': Category.Hiring,
      'RECRUITMENT': Category.Hiring,
      'HR': Category.Hiring,
      'MARKETING': Category.Marketing,
      'ADVERTISING': Category.Marketing,
      'SAAS': Category.SaaS,
      'SOFTWARE': Category.SaaS,
      'CLOUD': Category.Cloud,
      'HOSTING': Category.Cloud,
      'INFRASTRUCTURE': Category.Cloud,
      'G_A': Category.G_A,
      'G&A': Category.G_A,
      'GENERAL': Category.G_A,
      'ADMIN': Category.G_A,
      'ADMINISTRATION': Category.G_A,
    }

    const category = categoryMap[categoryName] || Category.G_A
    return category
  } catch (error) {
    console.error('Auto-categorization error:', error)
    // Fallback to keyword-based categorization
    return categorizeByKeywords(transaction.description)
  }
}

export async function autoCategorizeBulk(
  transactions: TransactionToCategorize[]
): Promise<Array<{ transaction: TransactionToCategorize; category: Category }>> {
  // Process in batches to avoid rate limits
  const batchSize = 10
  const results: Array<{ transaction: TransactionToCategorize; category: Category }> = []

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (txn) => ({
        transaction: txn,
        category: await autoCategorizeTransaction(txn),
      }))
    )
    results.push(...batchResults)
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}

function categorizeByKeywords(description: string): Category {
  const desc = description.toLowerCase()
  
  const hiringKeywords = ['hire', 'recruitment', 'recruiter', 'job', 'candidate', 'interview', 'hr', 'payroll', 'salary', 'employee', 'staffing']
  const marketingKeywords = ['marketing', 'ad', 'advertisement', 'campaign', 'social', 'seo', 'content', 'brand', 'pr', 'public relations', 'promotion']
  const saasKeywords = ['subscription', 'saas', 'software', 'service', 'license', 'app', 'tool', 'platform', 'zapier', 'notion', 'slack']
  const cloudKeywords = ['cloud', 'aws', 'azure', 'gcp', 'hosting', 'server', 'infrastructure', 'datacenter', 's3', 'ec2', 'digitalocean']
  const gaKeywords = ['office', 'general', 'admin', 'legal', 'accounting', 'finance', 'utility', 'utilities', 'rent', 'insurance', 'g&a', 'ga']
  
  if (hiringKeywords.some(keyword => desc.includes(keyword))) return Category.Hiring
  if (marketingKeywords.some(keyword => desc.includes(keyword))) return Category.Marketing
  if (saasKeywords.some(keyword => desc.includes(keyword))) return Category.SaaS
  if (cloudKeywords.some(keyword => desc.includes(keyword))) return Category.Cloud
  if (gaKeywords.some(keyword => desc.includes(keyword))) return Category.G_A
  
  return Category.G_A
}

