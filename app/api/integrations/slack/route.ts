import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

/**
 * Slack Integration
 * Send notifications and enable slash commands
 */

// Send notification to Slack
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, message, channel, type } = body

    if (!companyId || !message) {
      return NextResponse.json(
        { error: 'Company ID and message required' },
        { status: 400 }
      )
    }

    // Get Slack integration config
    const integration = await prisma.integration.findUnique({
      where: {
        companyId_provider: {
          companyId,
          provider: 'slack',
        },
      },
    })

    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      )
    }

    const webhookUrl = integration.apiKey

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Slack webhook URL not configured' },
        { status: 400 }
      )
    }

    // Format message based on type
    const slackMessage = formatSlackMessage(message, type)

    // Send to Slack
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    })

    if (!response.ok) {
      throw new Error('Failed to send Slack message')
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent to Slack',
    })
  } catch (error) {
    console.error('Slack notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}

// Connect Slack (save webhook URL)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { companyId, webhookUrl } = body

    if (!companyId || !webhookUrl) {
      return NextResponse.json(
        { error: 'Company ID and webhook URL required' },
        { status: 400 }
      )
    }

    // Test webhook
    const testResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '✅ Runway Guardrails connected successfully!',
      }),
    })

    if (!testResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid webhook URL' },
        { status: 400 }
      )
    }

    // Save integration
    const integration = await prisma.integration.upsert({
      where: {
        companyId_provider: {
          companyId,
          provider: 'slack',
        },
      },
      create: {
        companyId,
        provider: 'slack',
        status: 'connected',
        apiKey: webhookUrl,
        lastSyncAt: new Date(),
      },
      update: {
        status: 'connected',
        apiKey: webhookUrl,
        lastSyncAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      integration,
      message: 'Slack connected successfully',
    })
  } catch (error) {
    console.error('Connect Slack error:', error)
    return NextResponse.json(
      { error: 'Failed to connect Slack' },
      { status: 500 }
    )
  }
}

// Disconnect Slack
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    await prisma.integration.update({
      where: {
        companyId_provider: {
          companyId,
          provider: 'slack',
        },
      },
      data: {
        status: 'disconnected',
        apiKey: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Slack disconnected',
    })
  } catch (error) {
    console.error('Disconnect Slack error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Slack' },
      { status: 500 }
    )
  }
}

// Handle Slack slash commands (e.g., /runway)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const command = searchParams.get('command')
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    let response: any = {}

    switch (command) {
      case 'runway':
        response = getRunwayResponse(company)
        break
      case 'burn':
        response = getBurnResponse(company)
        break
      case 'alerts':
        response = await getAlertsResponse(companyId)
        break
      default:
        response = {
          text: 'Available commands: /runway, /burn, /alerts',
        }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Slack command error:', error)
    return NextResponse.json(
      { error: 'Failed to process command' },
      { status: 500 }
    )
  }
}

function formatSlackMessage(message: any, type?: string) {
  if (typeof message === 'string') {
    return { text: message }
  }

  // Rich formatting for different message types
  const blocks: any[] = []

  switch (type) {
    case 'alert':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ New Alert',
        },
      })
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message.text || message.message,
        },
      })
      if (message.severity === 'high') {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '*Severity:* 🔴 High',
            },
          ],
        })
      }
      break

    case 'expense_approval':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💰 Expense Approval Needed',
        },
      })
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Amount:* ₹${message.amount?.toLocaleString('en-IN')}\n*Category:* ${message.category}\n*Description:* ${message.description}`,
        },
      })
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Approve',
            },
            style: 'primary',
            value: message.transactionId,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Reject',
            },
            style: 'danger',
            value: message.transactionId,
          },
        ],
      })
      break

    case 'weekly_summary':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Weekly Financial Summary',
        },
      })
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Runway:*\n${message.runway} months`,
          },
          {
            type: 'mrkdwn',
            text: `*Burn Rate:*\n₹${message.burn?.toLocaleString('en-IN')}`,
          },
          {
            type: 'mrkdwn',
            text: `*Cash Balance:*\n₹${message.balance?.toLocaleString('en-IN')}`,
          },
          {
            type: 'mrkdwn',
            text: `*This Week:*\n₹${message.weeklySpend?.toLocaleString('en-IN')}`,
          },
        ],
      })
      break

    default:
      return { text: JSON.stringify(message) }
  }

  return { blocks }
}

function getRunwayResponse(company: any) {
  const monthlyBurn = company.transactions.reduce((sum: number, t: any) => sum + t.amount, 0)
  const runway = monthlyBurn > 0 ? company.cashBalance / monthlyBurn : null

  return {
    text: `*${company.name} - Runway Status*`,
    blocks: [
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Runway:*\n${runway?.toFixed(1) || 'N/A'} months`,
          },
          {
            type: 'mrkdwn',
            text: `*Cash Balance:*\n₹${(company.cashBalance / 100000).toFixed(1)}L`,
          },
          {
            type: 'mrkdwn',
            text: `*Monthly Burn:*\n₹${(monthlyBurn / 100000).toFixed(1)}L`,
          },
        ],
      },
    ],
  }
}

function getBurnResponse(company: any) {
  const monthlyBurn = company.transactions.reduce((sum: number, t: any) => sum + t.amount, 0)
  
  // Group by category
  const byCategory: any = {}
  company.transactions.forEach((t: any) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
  })

  const topCategories = Object.entries(byCategory)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)

  return {
    text: `*${company.name} - Burn Rate*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Monthly Burn:* ₹${(monthlyBurn / 100000).toFixed(1)}L\n\n*Top Categories:*\n${topCategories
            .map(([cat, amount]: any) => `• ${cat}: ₹${((amount as number) / 1000).toFixed(0)}k`)
            .join('\n')}`,
        },
      },
    ],
  }
}

async function getAlertsResponse(companyId: string) {
  const alerts = await prisma.alert.findMany({
    where: {
      companyId,
      isRead: false,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (alerts.length === 0) {
    return {
      text: '✅ No unread alerts',
    }
  }

  return {
    text: `*${alerts.length} Unread Alerts*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alerts.map((a) => `• ${a.message}`).join('\n'),
        },
      },
    ],
  }
}




