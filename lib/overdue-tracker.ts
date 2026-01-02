import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface OverdueInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  totalAmount: number
  balanceAmount: number
  dueDate: Date
  daysOverdue: number
  agingBucket: '1-30' | '31-60' | '61-90' | '90+'
}

export interface OverdueBill {
  id: string
  billNumber: string
  vendorName: string
  totalAmount: number
  balanceAmount: number
  dueDate: Date
  daysOverdue: number
  agingBucket: '1-30' | '31-60' | '61-90' | '90+'
}

/**
 * Track overdue invoices (AR) and create alerts
 */
export async function trackOverdueInvoices(companyId: string): Promise<{
  overdueInvoices: OverdueInvoice[]
  totalOverdueAmount: number
  alertsCreated: number
}> {
  const today = new Date()
  
  // Find all unpaid/partial invoices with past due dates
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['sent', 'partial'] },
      dueDate: { lt: today },
    },
    orderBy: { dueDate: 'asc' },
  })

  const overdueInvoices: OverdueInvoice[] = []
  let totalOverdueAmount = 0
  let alertsCreated = 0

  for (const invoice of invoices) {
    if (!invoice.dueDate) continue

    const daysOverdue = Math.floor((today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const balanceAmount = invoice.balanceAmount || (invoice.totalAmount - (invoice.paidAmount || 0))

    if (daysOverdue > 0 && balanceAmount > 0) {
      // Determine aging bucket
      let agingBucket: '1-30' | '31-60' | '61-90' | '90+' = '1-30'
      if (daysOverdue > 90) agingBucket = '90+'
      else if (daysOverdue > 60) agingBucket = '61-90'
      else if (daysOverdue > 30) agingBucket = '31-60'

      overdueInvoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        totalAmount: invoice.totalAmount,
        balanceAmount,
        dueDate: invoice.dueDate,
        daysOverdue,
        agingBucket,
      })

      totalOverdueAmount += balanceAmount

      // Update invoice status to overdue
      if (invoice.status !== 'overdue') {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'overdue' },
        })
      }

      // Create alert for critical overdue invoices (90+ days)
      if (daysOverdue > 90) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            companyId,
            message: { contains: invoice.invoiceNumber },
            severity: 'critical',
          },
        })

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              companyId,
              message: `CRITICAL: Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue. Outstanding: ₹${balanceAmount.toLocaleString()}`,
              severity: 'critical',
              riskLevel: 'high',
              isRead: false,
            },
          })
          alertsCreated++
        }
      } else if (daysOverdue > 60) {
        // High alert for 60+ days
        const existingAlert = await prisma.alert.findFirst({
          where: {
            companyId,
            message: { contains: invoice.invoiceNumber },
            severity: 'high',
          },
        })

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              companyId,
              message: `Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue. Outstanding: ₹${balanceAmount.toLocaleString()}`,
              severity: 'high',
              riskLevel: 'high',
              isRead: false,
            },
          })
          alertsCreated++
        }
      } else if (daysOverdue > 30) {
        // Medium alert for 30+ days
        const existingAlert = await prisma.alert.findFirst({
          where: {
            companyId,
            message: { contains: invoice.invoiceNumber },
            severity: 'medium',
          },
        })

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              companyId,
              message: `Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue. Outstanding: ₹${balanceAmount.toLocaleString()}`,
              severity: 'medium',
              riskLevel: 'medium',
              isRead: false,
            },
          })
          alertsCreated++
        }
      }
    }
  }

  return { overdueInvoices, totalOverdueAmount, alertsCreated }
}

/**
 * Track overdue bills (AP) and create alerts
 */
export async function trackOverdueBills(companyId: string): Promise<{
  overdueBills: OverdueBill[]
  totalOverdueAmount: number
  alertsCreated: number
}> {
  const today = new Date()
  
  // Find all unpaid/partial bills with past due dates
  const bills = await prisma.bill.findMany({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial'] },
      dueDate: { lt: today },
    },
    orderBy: { dueDate: 'asc' },
  })

  const overdueBills: OverdueBill[] = []
  let totalOverdueAmount = 0
  let alertsCreated = 0

  for (const bill of bills) {
    if (!bill.dueDate) continue

    const daysOverdue = Math.floor((today.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const balanceAmount = bill.balanceAmount

    if (daysOverdue > 0 && balanceAmount > 0) {
      // Determine aging bucket
      let agingBucket: '1-30' | '31-60' | '61-90' | '90+' = '1-30'
      if (daysOverdue > 90) agingBucket = '90+'
      else if (daysOverdue > 60) agingBucket = '61-90'
      else if (daysOverdue > 30) agingBucket = '31-60'

      overdueBills.push({
        id: bill.id,
        billNumber: bill.billNumber,
        vendorName: bill.vendorName,
        totalAmount: bill.totalAmount,
        balanceAmount,
        dueDate: bill.dueDate,
        daysOverdue,
        agingBucket,
      })

      totalOverdueAmount += balanceAmount

      // Update bill status to overdue
      if (bill.paymentStatus !== 'overdue') {
        await prisma.bill.update({
          where: { id: bill.id },
          data: { paymentStatus: 'overdue' },
        })
      }

      // Create alert for critical overdue bills (60+ days)
      if (daysOverdue > 60) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            companyId,
            message: { contains: bill.billNumber },
            severity: 'critical',
          },
        })

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              companyId,
              message: `CRITICAL: Bill ${bill.billNumber} to ${bill.vendorName} is ${daysOverdue} days overdue. Outstanding: ₹${balanceAmount.toLocaleString()}`,
              severity: 'critical',
              riskLevel: 'high',
              isRead: false,
            },
          })
          alertsCreated++
        }
      } else if (daysOverdue > 30) {
        // High alert for 30+ days
        const existingAlert = await prisma.alert.findFirst({
          where: {
            companyId,
            message: { contains: bill.billNumber },
            severity: 'high',
          },
        })

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              companyId,
              message: `Bill ${bill.billNumber} to ${bill.vendorName} is ${daysOverdue} days overdue. Outstanding: ₹${balanceAmount.toLocaleString()}`,
              severity: 'high',
              riskLevel: 'high',
              isRead: false,
            },
          })
          alertsCreated++
        }
      } else if (daysOverdue > 15) {
        // Medium alert for 15+ days
        const existingAlert = await prisma.alert.findFirst({
          where: {
            companyId,
            message: { contains: bill.billNumber },
            severity: 'medium',
          },
        })

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              companyId,
              message: `Bill ${bill.billNumber} to ${bill.vendorName} is ${daysOverdue} days overdue. Outstanding: ₹${balanceAmount.toLocaleString()}`,
              severity: 'medium',
              riskLevel: 'medium',
              isRead: false,
            },
          })
          alertsCreated++
        }
      }
    }
  }

  return { overdueBills, totalOverdueAmount, alertsCreated }
}

/**
 * Generate aging report for AR and AP
 */
export async function generateAgingReport(companyId: string): Promise<{
  ar: {
    current: number // 0-30 days
    days30_60: number
    days60_90: number
    over90: number
    total: number
  }
  ap: {
    current: number // 0-30 days
    days30_60: number
    days60_90: number
    over90: number
    total: number
  }
}> {
  const today = new Date()

  // AR Aging
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['sent', 'partial', 'overdue'] },
    },
  })

  const ar = {
    current: 0,
    days30_60: 0,
    days60_90: 0,
    over90: 0,
    total: 0,
  }

  for (const inv of invoices) {
    const balanceAmount = inv.balanceAmount || (inv.totalAmount - (inv.paidAmount || 0))
    if (balanceAmount <= 0) continue

    if (!inv.dueDate) {
      ar.current += balanceAmount
    } else {
      const daysOverdue = Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysOverdue <= 0) {
        ar.current += balanceAmount
      } else if (daysOverdue <= 30) {
        ar.current += balanceAmount
      } else if (daysOverdue <= 60) {
        ar.days30_60 += balanceAmount
      } else if (daysOverdue <= 90) {
        ar.days60_90 += balanceAmount
      } else {
        ar.over90 += balanceAmount
      }
    }
    ar.total += balanceAmount
  }

  // AP Aging
  const bills = await prisma.bill.findMany({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
    },
  })

  const ap = {
    current: 0,
    days30_60: 0,
    days60_90: 0,
    over90: 0,
    total: 0,
  }

  for (const bill of bills) {
    const balanceAmount = bill.balanceAmount
    if (balanceAmount <= 0) continue

    if (!bill.dueDate) {
      ap.current += balanceAmount
    } else {
      const daysOverdue = Math.floor((today.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysOverdue <= 0) {
        ap.current += balanceAmount
      } else if (daysOverdue <= 30) {
        ap.current += balanceAmount
      } else if (daysOverdue <= 60) {
        ap.days30_60 += balanceAmount
      } else if (daysOverdue <= 90) {
        ap.days60_90 += balanceAmount
      } else {
        ap.over90 += balanceAmount
      }
    }
    ap.total += balanceAmount
  }

  return { ar, ap }
}


