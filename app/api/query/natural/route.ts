import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Only import OpenAI if the API key is available
let openai: any = null
try {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = require('openai')
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
} catch (error) {
  console.log('OpenAI not configured, using fallback responses')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, question, context } = body

    if (!companyId || !question) {
      return NextResponse.json(
        { error: 'Company ID and question required' },
        { status: 400 }
      )
    }

    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 100,
        },
        revenues: {
          orderBy: { date: 'desc' },
          take: 50,
        },
        budgets: true,
        alerts: {
          where: { isRead: false },
        },
        vendorContracts: {
          where: { status: 'active' },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Calculate key metrics
    const metrics = calculateMetrics(company)

    // Determine query intent
    const intent = detectIntent(question)

    // Generate response based on intent
    let response: any = {}

    switch (intent.type) {
      case 'runway':
        response = handleRunwayQuery(question, metrics, company)
        break
      case 'burn_rate':
        response = handleBurnRateQuery(question, metrics, company)
        break
      case 'spending':
        response = handleSpendingQuery(question, metrics, company)
        break
      case 'revenue':
        response = handleRevenueQuery(question, metrics, company)
        break
      case 'vendor':
        response = handleVendorQuery(question, company)
        break
      case 'scenario':
        response = await handleScenarioQuery(question, metrics, company)
        break
      case 'general':
      default:
        response = await handleGeneralQuery(question, metrics, company)
        break
    }

    return NextResponse.json({
      question,
      intent: intent.type,
      confidence: intent.confidence,
      response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Natural language query error:', error)
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    )
  }
}

function detectIntent(question: string) {
  const q = question.toLowerCase()

  if (q.includes('runway') || q.includes('how long') || q.includes('survive')) {
    return { type: 'runway', confidence: 95 }
  }
  if (q.includes('burn') || q.includes('spending') || q.includes('expense')) {
    return { type: 'burn_rate', confidence: 90 }
  }
  if (q.includes('spent') || q.includes('cost') || q.includes('category')) {
    return { type: 'spending', confidence: 85 }
  }
  if (q.includes('revenue') || q.includes('income') || q.includes('sales')) {
    return { type: 'revenue', confidence: 85 }
  }
  if (q.includes('vendor') || q.includes('contract') || q.includes('renewal')) {
    return { type: 'vendor', confidence: 80 }
  }
  if (q.includes('what if') || q.includes('hire') || q.includes('scenario')) {
    return { type: 'scenario', confidence: 90 }
  }

  return { type: 'general', confidence: 50 }
}

function calculateMetrics(company: any) {
  // Calculate monthly burn
  const now = new Date()
  const lastMonth = new Date(now.setMonth(now.getMonth() - 1))
  
  const recentTransactions = company.transactions.filter(
    (t: any) => new Date(t.date) >= lastMonth
  )
  
  const monthlyBurn = recentTransactions.reduce((sum: number, t: any) => sum + t.amount, 0)
  const runway = monthlyBurn > 0 ? company.cashBalance / monthlyBurn : null

  // Revenue
  const monthlyRevenue = company.revenues
    .filter((r: any) => new Date(r.date) >= lastMonth)
    .reduce((sum: number, r: any) => sum + r.amount, 0)

  // By category
  const byCategory: any = {}
  recentTransactions.forEach((t: any) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
  })

  return {
    cashBalance: company.cashBalance,
    monthlyBurn,
    runway,
    monthlyRevenue,
    byCategory,
    activeContracts: company.vendorContracts.length,
    unreadAlerts: company.alerts.length,
  }
}

function handleRunwayQuery(question: string, metrics: any, company: any) {
  const runway = metrics.runway

  if (!runway) {
    return {
      answer: "I don't have enough transaction data to calculate your runway yet. Please add some expenses to get started.",
      data: { cashBalance: metrics.cashBalance },
      suggestions: [
        'Upload your bank statement',
        'Add manual expenses',
      ],
    }
  }

  const runwayMonths = Math.floor(runway)
  const runwayDays = Math.floor((runway % 1) * 30)
  
  let status = ''
  let emoji = ''
  
  if (runway >= 18) {
    status = 'excellent'
    emoji = '🎉'
  } else if (runway >= 12) {
    status = 'good'
    emoji = '👍'
  } else if (runway >= 6) {
    status = 'concerning'
    emoji = '⚠️'
  } else {
    status = 'critical'
    emoji = '🚨'
  }

  return {
    answer: `${emoji} Your current runway is ${runwayMonths} months and ${runwayDays} days (${runway.toFixed(1)} months total). This is ${status}.`,
    data: {
      runway: runway.toFixed(1),
      runwayMonths,
      runwayDays,
      cashBalance: metrics.cashBalance,
      monthlyBurn: metrics.monthlyBurn,
      status,
    },
    insights: [
      runway < 12 ? '⚠️ Consider fundraising or reducing burn rate' : null,
      runway >= 18 ? '✅ Strong position for next 12-18 months' : null,
    ].filter(Boolean),
    suggestions: [
      'See burn rate trends',
      'Run scenario analysis',
      'View spending by category',
    ],
  }
}

function handleBurnRateQuery(question: string, metrics: any, company: any) {
  const burnInLakhs = (metrics.monthlyBurn / 100000).toFixed(1)

  return {
    answer: `Your current monthly burn rate is ₹${burnInLakhs}L (₹${metrics.monthlyBurn.toLocaleString('en-IN')}).`,
    data: {
      monthlyBurn: metrics.monthlyBurn,
      byCategory: metrics.byCategory,
      topCategories: Object.entries(metrics.byCategory)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, amount]: any) => ({
          category: cat,
          amount,
          percentage: ((amount / metrics.monthlyBurn) * 100).toFixed(1),
        })),
    },
    insights: [
      `Largest expense: ${Object.entries(metrics.byCategory).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'}`,
      metrics.monthlyRevenue > 0
        ? `Burn multiple: ${(metrics.monthlyBurn / metrics.monthlyRevenue).toFixed(1)}x`
        : null,
    ].filter(Boolean),
    suggestions: [
      'View detailed breakdown by category',
      'See spending trends',
      'Compare with benchmarks',
    ],
  }
}

function handleSpendingQuery(question: string, metrics: any, company: any) {
  // Extract category if mentioned
  const categories = ['Hiring', 'Marketing', 'SaaS', 'Cloud', 'G_A']
  let targetCategory = null
  
  for (const cat of categories) {
    if (question.toLowerCase().includes(cat.toLowerCase())) {
      targetCategory = cat
      break
    }
  }

  if (targetCategory && metrics.byCategory[targetCategory]) {
    const amount = metrics.byCategory[targetCategory]
    const percentage = ((amount / metrics.monthlyBurn) * 100).toFixed(1)
    
    return {
      answer: `You spent ₹${amount.toLocaleString('en-IN')} on ${targetCategory} last month, which is ${percentage}% of your total burn.`,
      data: {
        category: targetCategory,
        amount,
        percentage,
      },
      suggestions: [
        `See all ${targetCategory} transactions`,
        'Compare with previous months',
        'Set budget for this category',
      ],
    }
  }

  // General spending overview
  const topSpending = Object.entries(metrics.byCategory)
    .sort((a: any, b: any) => b[1] - a[1])
    .map(([cat, amount]: any) => ({
      category: cat,
      amount,
      percentage: ((amount / metrics.monthlyBurn) * 100).toFixed(1),
    }))

  return {
    answer: `Here's your spending breakdown for last month (Total: ₹${metrics.monthlyBurn.toLocaleString('en-IN')}):`,
    data: {
      total: metrics.monthlyBurn,
      breakdown: topSpending,
    },
    suggestions: [
      'View detailed transactions',
      'Set budgets by category',
      'Export spending report',
    ],
  }
}

function handleRevenueQuery(question: string, metrics: any, company: any) {
  if (metrics.monthlyRevenue === 0) {
    return {
      answer: "You don't have any recorded revenue yet. Start by creating invoices or adding revenue records.",
      suggestions: [
        'Create an invoice',
        'Add revenue manually',
        'Connect Stripe/Razorpay',
      ],
    }
  }

  const revenueInLakhs = (metrics.monthlyRevenue / 100000).toFixed(1)
  const netBurn = metrics.monthlyBurn - metrics.monthlyRevenue
  const burnMultiple = (metrics.monthlyBurn / metrics.monthlyRevenue).toFixed(1)

  return {
    answer: `Your monthly revenue is ₹${revenueInLakhs}L. Net burn (after revenue): ₹${(netBurn / 100000).toFixed(1)}L. Burn multiple: ${burnMultiple}x.`,
    data: {
      revenue: metrics.monthlyRevenue,
      burn: metrics.monthlyBurn,
      netBurn,
      burnMultiple,
    },
    insights: [
      parseFloat(burnMultiple) < 2 ? '✅ Healthy burn multiple (<2x)' : '⚠️ High burn multiple (>2x)',
      netBurn > 0 ? 'Still cash-flow negative' : '✅ Cash-flow positive!',
    ],
    suggestions: [
      'View revenue trends',
      'See pending invoices',
      'Revenue forecast',
    ],
  }
}

function handleVendorQuery(question: string, company: any) {
  const contracts = company.vendorContracts
  const totalCommitment = contracts.reduce((sum: number, c: any) => sum + c.monthlyAmount, 0)

  return {
    answer: `You have ${contracts.length} active vendor contracts with a total monthly commitment of ₹${(totalCommitment / 100000).toFixed(1)}L.`,
    data: {
      contractCount: contracts.length,
      totalMonthly: totalCommitment,
      contracts: contracts.map((c: any) => ({
        vendor: c.vendorName,
        service: c.service,
        monthly: c.monthlyAmount,
        renewal: c.renewalDate,
      })),
    },
    suggestions: [
      'View all contracts',
      'Check upcoming renewals',
      'Add new contract',
    ],
  }
}

async function handleScenarioQuery(question: string, metrics: any, company: any) {
  // Extract numbers from question
  const numbers = question.match(/\d+/g) || []
  
  return {
    answer: "I can help you model different scenarios! What would you like to explore?",
    quickScenarios: [
      {
        name: 'Hire 1 Engineer',
        impact: 'Burn +₹1L/month, Runway -2 months',
      },
      {
        name: 'Increase Marketing',
        impact: 'Burn +₹50k/month, Runway -1 month',
      },
      {
        name: 'Raise ₹50L',
        impact: 'Runway +10 months',
      },
    ],
    suggestions: [
      'Open scenario calculator',
      'Model fundraising',
      'Hiring impact',
    ],
  }
}

async function handleGeneralQuery(question: string, metrics: any, company: any) {
  // Use OpenAI for general questions (if API key is available)
  if (!openai) {
    return {
      answer: "I can help you with financial questions! Try asking about runway, burn rate, spending, or specific categories. For example: 'How long will my money last?' or 'Show me SaaS spending'.",
      examples: [
        'How long will my money last?',
        'How much did we spend on SaaS?',
        'What if I hire 2 people?',
        'Show me revenue this month',
      ],
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a financial advisor for a startup. Current metrics: 
          - Cash: ₹${metrics.cashBalance}
          - Monthly Burn: ₹${metrics.monthlyBurn}
          - Runway: ${metrics.runway?.toFixed(1)} months
          - Revenue: ₹${metrics.monthlyRevenue}
          
          Answer the user's question concisely and actionably.`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      max_tokens: 200,
    })

    return {
      answer: completion.choices[0].message.content,
      powered_by: 'OpenAI GPT-4',
      suggestions: [
        'Ask about runway',
        'Check spending',
        'View analytics',
      ],
    }
  } catch (error) {
    console.error('OpenAI error:', error)
    
    return {
      answer: "I'm here to help with your financial questions! Try asking about runway, burn rate, spending, or specific categories.",
      examples: [
        'How long will my money last?',
        'How much did we spend on SaaS?',
        'What if I hire 2 people?',
        'Show me revenue this month',
      ],
    }
  }
}

