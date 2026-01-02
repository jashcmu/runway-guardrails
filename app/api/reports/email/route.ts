import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Email Reports System
 * Schedule and send weekly/monthly financial reports
 */

// Get email report subscriptions
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    const reports = await prisma.emailReport.findMany({
      where: { companyId },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Get email reports error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

// Create/subscribe to email report
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, recipientEmail, frequency, reportTypes } = body

    if (!companyId || !recipientEmail || !frequency) {
      return NextResponse.json(
        { error: 'Company ID, recipient email, and frequency required' },
        { status: 400 }
      )
    }

    // Calculate next send time
    const nextSendAt = calculateNextSendTime(frequency)

    const report = await prisma.emailReport.create({
      data: {
        companyId,
        recipientEmail,
        frequency,
        reportTypes: JSON.stringify(reportTypes || ['runway', 'burn', 'alerts']),
        isActive: true,
        nextSendAt,
      },
    })

    return NextResponse.json({
      success: true,
      report,
      message: 'Email report subscription created',
    })
  } catch (error) {
    console.error('Create email report error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}

// Update email report subscription
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    if (updateData.frequency) {
      updateData.nextSendAt = calculateNextSendTime(updateData.frequency)
    }

    if (updateData.reportTypes) {
      updateData.reportTypes = JSON.stringify(updateData.reportTypes)
    }

    const report = await prisma.emailReport.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      report,
      message: 'Email report updated',
    })
  } catch (error) {
    console.error('Update email report error:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

// Delete email report subscription
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    await prisma.emailReport.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Email report subscription deleted',
    })
  } catch (error) {
    console.error('Delete email report error:', error)
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    )
  }
}

function calculateNextSendTime(frequency: string): Date {
  const now = new Date()

  switch (frequency) {
    case 'daily':
      // Send at 9 AM next day
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      return tomorrow

    case 'weekly':
      // Send every Monday at 9 AM
      const nextMonday = new Date(now)
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
      nextMonday.setHours(9, 0, 0, 0)
      return nextMonday

    case 'monthly':
      // Send on 1st of next month at 9 AM
      const nextMonth = new Date(now)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      nextMonth.setHours(9, 0, 0, 0)
      return nextMonth

    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default to 24 hours
  }
}

// Send reports (called by cron job)
export async function PUT(request: Request) {
  try {
    const now = new Date()

    // Find reports due to be sent
    const dueReports = await prisma.emailReport.findMany({
      where: {
        isActive: true,
        nextSendAt: {
          lte: now,
        },
      },
    })

    console.log(`Found ${dueReports.length} reports to send`)

    const results = []

    for (const report of dueReports) {
      try {
        // Generate and send report
        const emailContent = await generateEmailReport(report.companyId, report.reportTypes)
        
        // Send email (placeholder - implement with your email service)
        await sendEmail(report.recipientEmail, emailContent)

        // Update last sent time and next send time
        await prisma.emailReport.update({
          where: { id: report.id },
          data: {
            lastSentAt: now,
            nextSendAt: calculateNextSendTime(report.frequency),
          },
        })

        results.push({
          reportId: report.id,
          status: 'sent',
          recipient: report.recipientEmail,
        })
      } catch (error) {
        console.error(`Failed to send report ${report.id}:`, error)
        results.push({
          reportId: report.id,
          status: 'failed',
          recipient: report.recipientEmail,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Send email reports error:', error)
    return NextResponse.json(
      { error: 'Failed to send reports' },
      { status: 500 }
    )
  }
}

async function generateEmailReport(companyId: string, reportTypesJson: string) {
  const reportTypes = JSON.parse(reportTypesJson)

  // Get company data
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      transactions: {
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      },
      alerts: {
        where: {
          isRead: false,
        },
      },
    },
  })

  if (!company) {
    throw new Error('Company not found')
  }

  // Calculate metrics
  const weeklySpend = company.transactions.reduce((sum, t) => sum + t.amount, 0)
  const monthlyBurn = weeklySpend * 4.33 // Approximate monthly
  const runway = monthlyBurn > 0 ? company.cashBalance / monthlyBurn : null

  // Build email content
  const subject = `Weekly Financial Summary - ${company.name}`
  
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .metric { background: #F3F4F6; padding: 15px; margin: 10px 0; border-radius: 8px; }
          .metric-label { font-size: 14px; color: #6B7280; }
          .metric-value { font-size: 24px; font-weight: bold; color: #111827; }
          .alert { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 10px 0; }
          .footer { background: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>💰 ${company.name}</h1>
          <p>Weekly Financial Summary</p>
        </div>
        <div class="content">
  `

  // Add requested report types
  if (reportTypes.includes('runway')) {
    html += `
      <div class="metric">
        <div class="metric-label">Current Runway</div>
        <div class="metric-value">${runway?.toFixed(1) || 'N/A'} months</div>
      </div>
    `
  }

  if (reportTypes.includes('burn')) {
    html += `
      <div class="metric">
        <div class="metric-label">Monthly Burn Rate</div>
        <div class="metric-value">₹${(monthlyBurn / 100000).toFixed(1)}L</div>
      </div>
      <div class="metric">
        <div class="metric-label">This Week's Spending</div>
        <div class="metric-value">₹${(weeklySpend / 100000).toFixed(1)}L</div>
      </div>
    `
  }

  if (reportTypes.includes('balance')) {
    html += `
      <div class="metric">
        <div class="metric-label">Cash Balance</div>
        <div class="metric-value">₹${(company.cashBalance / 100000).toFixed(1)}L</div>
      </div>
    `
  }

  if (reportTypes.includes('alerts') && company.alerts.length > 0) {
    html += `<h2>⚠️ Unread Alerts (${company.alerts.length})</h2>`
    company.alerts.forEach((alert) => {
      html += `
        <div class="alert">
          <strong>${alert.severity.toUpperCase()}</strong>: ${alert.message}
        </div>
      `
    })
  }

  html += `
        <p style="margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
             style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Dashboard
          </a>
        </p>
      </div>
      <div class="footer">
        <p>Runway Guardrails - Financial Management for Startups</p>
        <p><a href="#">Unsubscribe</a> | <a href="#">Manage Preferences</a></p>
      </div>
    </body>
  </html>
  `

  return {
    subject,
    html,
  }
}

async function sendEmail(to: string, content: { subject: string; html: string }) {
  // TODO: Implement with email service (SendGrid, AWS SES, etc.)
  console.log(`Would send email to ${to}:`, content.subject)
  
  // Placeholder - in production, use a real email service:
  // await sendgrid.send({ to, from: 'reports@runwayguardrails.com', ...content })
  
  return true
}




