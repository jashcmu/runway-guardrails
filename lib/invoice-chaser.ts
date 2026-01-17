/**
 * Invoice Chaser Module
 * Automated follow-up system for overdue invoices
 */

import { prisma } from './prisma'

export interface InvoiceReminder {
  invoiceId: string
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  totalAmount: number
  balanceAmount: number
  dueDate: Date
  daysOverdue: number
  reminderLevel: 'gentle' | 'firm' | 'urgent' | 'final'
  subject: string
  body: string
  previousReminders: number
}

export interface ReminderResult {
  success: boolean
  invoiceId: string
  action: 'sent' | 'skipped' | 'failed'
  reason?: string
}

export interface ChaseSettings {
  gentleReminderDays: number // Days after due date for gentle reminder
  firmReminderDays: number
  urgentReminderDays: number
  finalReminderDays: number
  maxReminders: number
  excludeWeekends: boolean
  customTemplates?: Record<string, { subject: string; body: string }>
}

const DEFAULT_SETTINGS: ChaseSettings = {
  gentleReminderDays: 3,
  firmReminderDays: 10,
  urgentReminderDays: 21,
  finalReminderDays: 30,
  maxReminders: 4,
  excludeWeekends: true
}

const REMINDER_TEMPLATES = {
  gentle: {
    subject: 'Friendly Reminder: Invoice {invoiceNumber} is Due',
    body: `Dear {customerName},

We hope this message finds you well. This is a friendly reminder that Invoice {invoiceNumber} for ₹{amount} was due on {dueDate}.

If you've already made the payment, please ignore this message. Otherwise, we kindly request you to process the payment at your earliest convenience.

Invoice Details:
- Invoice Number: {invoiceNumber}
- Amount Due: ₹{balanceAmount}
- Due Date: {dueDate}

If you have any questions or concerns regarding this invoice, please don't hesitate to reach out.

Thank you for your business!

Best regards,
{companyName}`
  },
  firm: {
    subject: 'Payment Reminder: Invoice {invoiceNumber} - {daysOverdue} Days Overdue',
    body: `Dear {customerName},

We're writing to remind you that Invoice {invoiceNumber} for ₹{amount} is now {daysOverdue} days past due.

We understand that oversights happen, but we kindly request immediate attention to this matter.

Invoice Details:
- Invoice Number: {invoiceNumber}
- Amount Due: ₹{balanceAmount}
- Original Due Date: {dueDate}
- Days Overdue: {daysOverdue}

Please process the payment at your earliest convenience to avoid any disruption in our business relationship.

If you're experiencing any difficulties with payment, please contact us to discuss possible arrangements.

Best regards,
{companyName}`
  },
  urgent: {
    subject: 'URGENT: Invoice {invoiceNumber} Significantly Overdue',
    body: `Dear {customerName},

This is an urgent notice regarding Invoice {invoiceNumber} for ₹{amount}, which is now {daysOverdue} days overdue.

Despite previous reminders, we have not received payment for this invoice. We kindly request immediate attention to this matter.

Invoice Details:
- Invoice Number: {invoiceNumber}
- Amount Due: ₹{balanceAmount}
- Original Due Date: {dueDate}
- Days Overdue: {daysOverdue}

Please arrange for immediate payment to avoid further action. If there are any issues preventing payment, please contact us immediately so we can work together on a resolution.

Regards,
{companyName}`
  },
  final: {
    subject: 'FINAL NOTICE: Invoice {invoiceNumber} - Immediate Payment Required',
    body: `Dear {customerName},

This is our final notice regarding Invoice {invoiceNumber} for ₹{amount}, which is now {daysOverdue} days overdue.

Despite multiple reminders, we have not received payment. If payment is not received within 7 days, we may be forced to take further action, which could include:
- Suspension of services
- Involvement of collection agencies
- Legal proceedings

Invoice Details:
- Invoice Number: {invoiceNumber}
- Amount Due: ₹{balanceAmount}
- Original Due Date: {dueDate}
- Days Overdue: {daysOverdue}

Please contact us immediately if you wish to discuss payment arrangements.

Regards,
{companyName}`
  }
}

/**
 * Get all invoices that need reminders
 */
export async function getInvoicesForReminder(
  companyId: string,
  settings: ChaseSettings = DEFAULT_SETTINGS
): Promise<InvoiceReminder[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Get company info
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  })
  
  // Get overdue invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['sent', 'overdue', 'partial'] },
      dueDate: { lt: today }
    },
    orderBy: { dueDate: 'asc' }
  })
  
  const reminders: InvoiceReminder[] = []
  
  for (const invoice of overdueInvoices) {
    if (!invoice.dueDate) continue
    
    const dueDate = new Date(invoice.dueDate)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // Determine reminder level based on days overdue
    let reminderLevel: InvoiceReminder['reminderLevel']
    if (daysOverdue >= settings.finalReminderDays) {
      reminderLevel = 'final'
    } else if (daysOverdue >= settings.urgentReminderDays) {
      reminderLevel = 'urgent'
    } else if (daysOverdue >= settings.firmReminderDays) {
      reminderLevel = 'firm'
    } else if (daysOverdue >= settings.gentleReminderDays) {
      reminderLevel = 'gentle'
    } else {
      continue // Not due for a reminder yet
    }
    
    // Get reminder count from activity log
    const reminderCount = await prisma.activityLog.count({
      where: {
        companyId,
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'reminder_sent'
      }
    })
    
    if (reminderCount >= settings.maxReminders) {
      continue // Already sent maximum reminders
    }
    
    const template = settings.customTemplates?.[reminderLevel] || REMINDER_TEMPLATES[reminderLevel]
    const balanceAmount = invoice.balanceAmount ?? (invoice.totalAmount - (invoice.paidAmount || 0))
    
    const subject = replaceTemplateVars(template.subject, {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      amount: invoice.totalAmount.toLocaleString('en-IN'),
      balanceAmount: balanceAmount.toLocaleString('en-IN'),
      dueDate: dueDate.toLocaleDateString('en-IN'),
      daysOverdue: daysOverdue.toString(),
      companyName: company?.name || 'Our Company'
    })
    
    const body = replaceTemplateVars(template.body, {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      amount: invoice.totalAmount.toLocaleString('en-IN'),
      balanceAmount: balanceAmount.toLocaleString('en-IN'),
      dueDate: dueDate.toLocaleDateString('en-IN'),
      daysOverdue: daysOverdue.toString(),
      companyName: company?.name || 'Our Company'
    })
    
    reminders.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      totalAmount: invoice.totalAmount,
      balanceAmount,
      dueDate,
      daysOverdue,
      reminderLevel,
      subject,
      body,
      previousReminders: reminderCount
    })
  }
  
  return reminders
}

/**
 * Send reminders for overdue invoices
 */
export async function sendInvoiceReminders(
  companyId: string,
  invoiceIds?: string[],
  settings: ChaseSettings = DEFAULT_SETTINGS
): Promise<ReminderResult[]> {
  const results: ReminderResult[] = []
  
  let reminders = await getInvoicesForReminder(companyId, settings)
  
  if (invoiceIds && invoiceIds.length > 0) {
    reminders = reminders.filter(r => invoiceIds.includes(r.invoiceId))
  }
  
  for (const reminder of reminders) {
    try {
      // In production, this would send an actual email
      // For now, we'll log the activity
      console.log(`📧 Would send reminder to ${reminder.customerName} for invoice ${reminder.invoiceNumber}`)
      
      // Log the reminder in activity log
      await prisma.activityLog.create({
        data: {
          companyId,
          userId: 'system',
          userName: 'Automated System',
          action: 'reminder_sent',
          entityType: 'invoice',
          entityId: reminder.invoiceId,
          metadata: {
            reminderLevel: reminder.reminderLevel,
            subject: reminder.subject,
            daysOverdue: reminder.daysOverdue
          }
        }
      })
      
      results.push({
        success: true,
        invoiceId: reminder.invoiceId,
        action: 'sent'
      })
    } catch (error) {
      results.push({
        success: false,
        invoiceId: reminder.invoiceId,
        action: 'failed',
        reason: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return results
}

/**
 * Get reminder statistics for a company
 */
export async function getReminderStats(
  companyId: string
): Promise<{
  totalOverdue: number
  totalOverdueAmount: number
  byLevel: Record<string, number>
  remindersSentToday: number
  remindersSentThisMonth: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  
  const [overdueInvoices, todayReminders, monthReminders] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['sent', 'overdue', 'partial'] },
        dueDate: { lt: today }
      }
    }),
    prisma.activityLog.count({
      where: {
        companyId,
        action: 'reminder_sent',
        timestamp: { gte: today }
      }
    }),
    prisma.activityLog.count({
      where: {
        companyId,
        action: 'reminder_sent',
        timestamp: { gte: monthStart }
      }
    })
  ])
  
  const byLevel = { gentle: 0, firm: 0, urgent: 0, final: 0 }
  
  for (const invoice of overdueInvoices) {
    if (!invoice.dueDate) continue
    const daysOverdue = Math.floor((today.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysOverdue >= 30) byLevel.final++
    else if (daysOverdue >= 21) byLevel.urgent++
    else if (daysOverdue >= 10) byLevel.firm++
    else if (daysOverdue >= 3) byLevel.gentle++
  }
  
  const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => {
    const balance = inv.balanceAmount ?? (inv.totalAmount - (inv.paidAmount || 0))
    return sum + balance
  }, 0)
  
  return {
    totalOverdue: overdueInvoices.length,
    totalOverdueAmount,
    byLevel,
    remindersSentToday: todayReminders,
    remindersSentThisMonth: monthReminders
  }
}

/**
 * Replace template variables
 */
function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}
