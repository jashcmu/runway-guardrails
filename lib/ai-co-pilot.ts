/**
 * AI Co-Pilot Module
 * Provides proactive financial recommendations, insights, and actionable advice
 */

import { prisma } from './prisma'
import { chatCompletion } from './openai-client'
import { calculateBurnRateMetrics } from './burn-rate-calculator'
import { generateVendorInsights } from './vendor-intelligence'
import { getCostOptimizationSuggestions } from './vendor-recommender'
import { Category } from '@prisma/client'
import { CATEGORY_DISPLAY_NAMES } from './categorize'

export interface AIRecommendation {
  id: string
  type: 'warning' | 'opportunity' | 'insight' | 'action' | 'celebration'
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: 'runway' | 'spending' | 'revenue' | 'cash_flow' | 'vendor' | 'budget' | 'anomaly' | 'compliance'
  title: string
  message: string
  details?: string
  action?: {
    label: string
    type: 'link' | 'api_call' | 'modal'
    target: string
  }
  metrics?: Record<string, number | string>
  createdAt: Date
}

export interface FinancialContext {
  cashBalance: number
  monthlyBurn: number
  monthlyRevenue: number
  runway: number
  targetMonths?: number
  recentTransactions: Array<{ amount: number; category: Category; description?: string; date: Date }>
  categorySpend: Record<string, number>
  overdueBills: number
  overdueInvoices: number
  topVendors: Array<{ name: string; spend: number }>
}

/**
 * Generate proactive AI recommendations for a company
 */
export async function generateAIRecommendations(
  companyId: string
): Promise<AIRecommendation[]> {
  const recommendations: AIRecommendation[] = []
  
  try {
    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })
    
    if (!company) {
      return recommendations
    }
    
    // Get burn rate metrics
    const burnMetrics = await calculateBurnRateMetrics(companyId, company.cashBalance)
    
    // Get recent transactions
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        companyId,
        date: { gte: thirtyDaysAgo }
      },
      orderBy: { date: 'desc' },
      take: 100
    })
    
    // Get overdue items
    const [overdueInvoices, overdueBills] = await Promise.all([
      prisma.invoice.count({
        where: { companyId, status: 'overdue' }
      }),
      prisma.bill.count({
        where: { companyId, paymentStatus: 'overdue' }
      })
    ])
    
    // 1. RUNWAY WARNINGS
    if (burnMetrics.runway < 3 && burnMetrics.runway !== Infinity) {
      recommendations.push({
        id: 'runway-critical',
        type: 'warning',
        priority: 'critical',
        category: 'runway',
        title: 'Critical Runway Warning',
        message: `Your runway is only ${burnMetrics.runway.toFixed(1)} months. Immediate action required.`,
        details: `At current burn rate of ₹${formatCurrency(burnMetrics.netBurnRate)}/month, you'll run out of cash in ${burnMetrics.runway.toFixed(1)} months.`,
        action: {
          label: 'View Cost Reduction Options',
          type: 'link',
          target: '/dashboard/analytics'
        },
        metrics: {
          runway: burnMetrics.runway,
          monthlyBurn: burnMetrics.netBurnRate,
          cashBalance: company.cashBalance
        },
        createdAt: new Date()
      })
    } else if (burnMetrics.runway < 6 && burnMetrics.runway !== Infinity) {
      recommendations.push({
        id: 'runway-warning',
        type: 'warning',
        priority: 'high',
        category: 'runway',
        title: 'Runway Below 6 Months',
        message: `Your runway is ${burnMetrics.runway.toFixed(1)} months. Consider reducing burn or raising funds.`,
        details: 'Industry best practice is to maintain at least 12-18 months of runway.',
        action: {
          label: 'Explore Funding Options',
          type: 'link',
          target: '/dashboard/fundraising'
        },
        metrics: {
          runway: burnMetrics.runway,
          monthlyBurn: burnMetrics.netBurnRate
        },
        createdAt: new Date()
      })
    }
    
    // 2. OVERDUE ITEMS
    if (overdueInvoices > 0) {
      const overdueAmount = await calculateOverdueInvoiceAmount(companyId)
      recommendations.push({
        id: 'overdue-invoices',
        type: 'action',
        priority: overdueInvoices > 5 ? 'high' : 'medium',
        category: 'revenue',
        title: `${overdueInvoices} Overdue Invoice${overdueInvoices > 1 ? 's' : ''}`,
        message: `You have ₹${formatCurrency(overdueAmount)} in overdue invoices. Send payment reminders to improve cash flow.`,
        action: {
          label: 'Send Reminders',
          type: 'link',
          target: '/dashboard/invoices?filter=overdue'
        },
        metrics: {
          count: overdueInvoices,
          amount: overdueAmount
        },
        createdAt: new Date()
      })
    }
    
    if (overdueBills > 0) {
      recommendations.push({
        id: 'overdue-bills',
        type: 'warning',
        priority: overdueBills > 5 ? 'high' : 'medium',
        category: 'spending',
        title: `${overdueBills} Overdue Bill${overdueBills > 1 ? 's' : ''} to Pay`,
        message: `You have ${overdueBills} overdue bills. Late payments may affect vendor relationships.`,
        action: {
          label: 'View Bills',
          type: 'link',
          target: '/dashboard/bills?filter=overdue'
        },
        createdAt: new Date()
      })
    }
    
    // 3. SPENDING INSIGHTS
    const categorySpend = calculateCategorySpend(recentTransactions)
    const totalSpend = Object.values(categorySpend).reduce((s, v) => s + v, 0)
    
    // Find categories with high spend
    for (const [category, spend] of Object.entries(categorySpend)) {
      const percentOfTotal = (spend / totalSpend) * 100
      if (percentOfTotal > 30) {
        recommendations.push({
          id: `high-spend-${category}`,
          type: 'insight',
          priority: 'medium',
          category: 'spending',
          title: `High ${CATEGORY_DISPLAY_NAMES[category as Category] || category} Spend`,
          message: `${CATEGORY_DISPLAY_NAMES[category as Category] || category} accounts for ${percentOfTotal.toFixed(0)}% of your total spending.`,
          details: `This month: ₹${formatCurrency(spend)}. Review if this aligns with your priorities.`,
          action: {
            label: 'Analyze Spending',
            type: 'link',
            target: `/dashboard/analytics?category=${category}`
          },
          createdAt: new Date()
        })
      }
    }
    
    // 4. VENDOR INSIGHTS
    try {
      const vendorInsights = await generateVendorInsights(companyId)
      for (const insight of vendorInsights.slice(0, 3)) {
        recommendations.push({
          id: `vendor-${insight.type}-${insight.vendorName}`,
          type: insight.severity === 'high' ? 'warning' : 'opportunity',
          priority: insight.severity === 'high' ? 'high' : 'medium',
          category: 'vendor',
          title: insight.vendorName,
          message: insight.message,
          details: insight.recommendation,
          metrics: insight.potentialSavings ? { potentialSavings: insight.potentialSavings } : undefined,
          createdAt: new Date()
        })
      }
    } catch (e) {
      // Vendor insights optional
    }
    
    // 5. COST OPTIMIZATION OPPORTUNITIES
    try {
      const optimizations = await getCostOptimizationSuggestions(companyId)
      const totalSavings = optimizations.reduce((s, o) => s + o.potentialSavings, 0)
      
      if (totalSavings > 100000) {
        recommendations.push({
          id: 'cost-optimization',
          type: 'opportunity',
          priority: 'high',
          category: 'spending',
          title: 'Cost Optimization Opportunities Found',
          message: `We identified potential annual savings of ₹${formatCurrency(totalSavings)}.`,
          details: `${optimizations.length} optimization opportunities available.`,
          action: {
            label: 'View Recommendations',
            type: 'link',
            target: '/dashboard/vendors?tab=recommendations'
          },
          metrics: {
            potentialSavings: totalSavings,
            opportunities: optimizations.length
          },
          createdAt: new Date()
        })
      }
    } catch (e) {
      // Cost optimization optional
    }
    
    // 6. POSITIVE INSIGHTS (Celebrations)
    if (burnMetrics.runway > 18 && burnMetrics.runway !== Infinity) {
      recommendations.push({
        id: 'healthy-runway',
        type: 'celebration',
        priority: 'low',
        category: 'runway',
        title: 'Healthy Runway!',
        message: `Your runway of ${burnMetrics.runway.toFixed(0)} months is above industry average. Great financial management!`,
        createdAt: new Date()
      })
    }
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    
    return recommendations
  } catch (error) {
    console.error('Failed to generate AI recommendations:', error)
    return recommendations
  }
}

/**
 * Generate LLM-powered insights based on financial context
 */
export async function generateLLMInsights(
  companyId: string
): Promise<string[]> {
  try {
    const context = await buildFinancialContext(companyId)
    
    const prompt = `Analyze this Indian startup's financial situation and provide 3-5 actionable insights:

Financial Snapshot:
- Cash Balance: ₹${formatCurrency(context.cashBalance)}
- Monthly Burn: ₹${formatCurrency(context.monthlyBurn)}
- Monthly Revenue: ₹${formatCurrency(context.monthlyRevenue)}
- Runway: ${context.runway.toFixed(1)} months

Top Spending Categories:
${Object.entries(context.categorySpend)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([cat, spend]) => `- ${cat}: ₹${formatCurrency(spend)}`)
  .join('\n')}

Outstanding Items:
- Overdue Invoices: ${context.overdueInvoices}
- Overdue Bills: ${context.overdueBills}

Provide insights in JSON array format:
["insight1", "insight2", ...]

Focus on:
1. Immediate concerns (if any)
2. Cash flow optimization
3. Growth opportunities
4. Risk mitigation`

    const response = await chatCompletion([
      { role: 'system', content: 'You are a financial advisor for Indian startups. Provide concise, actionable insights.' },
      { role: 'user', content: prompt }
    ])
    
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return []
  } catch (error) {
    console.error('Failed to generate LLM insights:', error)
    return []
  }
}

/**
 * Answer a natural language question about finances
 */
export async function answerFinancialQuestion(
  companyId: string,
  question: string
): Promise<{
  answer: string
  data?: Record<string, any>
  suggestions?: string[]
}> {
  try {
    const context = await buildFinancialContext(companyId)
    
    const prompt = `Answer this question about the company's finances:

Question: "${question}"

Financial Context:
- Cash Balance: ₹${formatCurrency(context.cashBalance)}
- Monthly Burn Rate: ₹${formatCurrency(context.monthlyBurn)}
- Monthly Revenue: ₹${formatCurrency(context.monthlyRevenue)}
- Runway: ${context.runway === Infinity ? 'Infinite' : context.runway.toFixed(1) + ' months'}

Spending by Category (last 30 days):
${Object.entries(context.categorySpend)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([cat, spend]) => `- ${CATEGORY_DISPLAY_NAMES[cat as Category] || cat}: ₹${formatCurrency(spend)}`)
  .join('\n')}

Top Vendors:
${context.topVendors.slice(0, 5).map(v => `- ${v.name}: ₹${formatCurrency(v.spend)}`).join('\n')}

Outstanding:
- Overdue Invoices: ${context.overdueInvoices}
- Overdue Bills: ${context.overdueBills}

Provide a helpful, concise answer in JSON format:
{
  "answer": "Your answer here",
  "data": {"key": "value if relevant"},
  "suggestions": ["follow-up question 1", "follow-up question 2"]
}`

    const response = await chatCompletion([
      { role: 'system', content: 'You are a helpful financial assistant for Indian startups. Use ₹ for currency. Be concise and actionable.' },
      { role: 'user', content: prompt }
    ])
    
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        answer: parsed.answer || response,
        data: parsed.data,
        suggestions: parsed.suggestions || []
      }
    }
    
    return {
      answer: response,
      suggestions: ['What is my runway?', 'How can I reduce burn?', 'Show my top expenses']
    }
  } catch (error) {
    console.error('Failed to answer question:', error)
    return {
      answer: 'I apologize, but I encountered an error processing your question. Please try again.',
      suggestions: ['What is my current runway?', 'How much did I spend last month?']
    }
  }
}

/**
 * Build financial context for AI analysis
 */
async function buildFinancialContext(companyId: string): Promise<FinancialContext> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })
  
  const burnMetrics = await calculateBurnRateMetrics(companyId, company?.cashBalance || 0)
  
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: thirtyDaysAgo }
    },
    orderBy: { date: 'desc' },
    take: 100
  })
  
  const [overdueInvoices, overdueBills] = await Promise.all([
    prisma.invoice.count({ where: { companyId, status: 'overdue' } }),
    prisma.bill.count({ where: { companyId, paymentStatus: 'overdue' } })
  ])
  
  const categorySpend = calculateCategorySpend(recentTransactions)
  
  // Calculate top vendors
  const vendorSpend: Record<string, number> = {}
  for (const t of recentTransactions) {
    if (t.amount < 0) {
      const vendor = t.vendorName || 'Unknown'
      vendorSpend[vendor] = (vendorSpend[vendor] || 0) + Math.abs(t.amount)
    }
  }
  const topVendors = Object.entries(vendorSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, spend]) => ({ name, spend }))
  
  return {
    cashBalance: company?.cashBalance || 0,
    monthlyBurn: burnMetrics.netBurnRate,
    monthlyRevenue: burnMetrics.monthlyRevenue,
    runway: burnMetrics.runway,
    targetMonths: company?.targetMonths || undefined,
    recentTransactions: recentTransactions.map(t => ({
      amount: t.amount,
      category: t.category,
      description: t.description || undefined,
      date: t.date
    })),
    categorySpend,
    overdueInvoices,
    overdueBills,
    topVendors
  }
}

/**
 * Calculate spending by category
 */
function calculateCategorySpend(transactions: Array<{ amount: number; category: Category }>): Record<string, number> {
  const spend: Record<string, number> = {}
  for (const t of transactions) {
    if (t.amount < 0) {
      spend[t.category] = (spend[t.category] || 0) + Math.abs(t.amount)
    }
  }
  return spend
}

/**
 * Calculate overdue invoice amount
 */
async function calculateOverdueInvoiceAmount(companyId: string): Promise<number> {
  const overdueInvoices = await prisma.invoice.findMany({
    where: { companyId, status: 'overdue' }
  })
  return overdueInvoices.reduce((sum, inv) => {
    const balance = inv.balanceAmount ?? (inv.totalAmount - (inv.paidAmount || 0))
    return sum + balance
  }, 0)
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
