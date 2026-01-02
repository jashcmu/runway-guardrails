// Cash Balance & Runway Synchronization Service
import { PrismaClient } from '@prisma/client'
import { calculateBurnRateMetrics } from './burn-rate-calculator'

const prisma = new PrismaClient()

/**
 * Update cash balance when a bill is marked as paid
 */
export async function updateCashOnBillPaid(
  companyId: string,
  billId: string,
  amount: number
): Promise<{ newCashBalance: number; runway: number }> {
  // Deduct amount from cash balance
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      cashBalance: {
        decrement: amount,
      },
    },
  })

  // Mark bill as paid
  await prisma.bill.update({
    where: { id: billId },
    data: {
      paymentStatus: 'paid',
      paymentDate: new Date(),
      paidAmount: amount,
      balanceAmount: 0,
    },
  })

  // Create expense transaction
  await prisma.transaction.create({
    data: {
      companyId,
      amount: -amount,
      category: 'G_A',
      description: `Bill payment - ${billId}`,
      date: new Date(),
      currency: 'INR',
    },
  })

  // Recalculate runway
  const runway = await recalculateRunway(companyId, company.cashBalance)

  return {
    newCashBalance: company.cashBalance,
    runway,
  }
}

/**
 * Update cash balance when an invoice is marked as paid (received)
 */
export async function updateCashOnInvoicePaid(
  companyId: string,
  invoiceId: string,
  amount: number
): Promise<{ newCashBalance: number; runway: number }> {
  // Add amount to cash balance
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      cashBalance: {
        increment: amount,
      },
    },
  })

  // Mark invoice as paid
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'paid',
      paidDate: new Date(),
      paidAmount: amount,
    },
  })

  // Create revenue transaction
  await prisma.transaction.create({
    data: {
      companyId,
      amount: amount,
      category: 'Marketing', // Note: Revenue transactions should use Revenue model, not Transaction
      description: `Invoice payment received - ${invoiceId}`,
      date: new Date(),
      currency: 'INR',
    },
  })

  // Recalculate runway
  const runway = await recalculateRunway(companyId, company.cashBalance)

  return {
    newCashBalance: company.cashBalance,
    runway,
  }
}

/**
 * Recalculate runway based on current cash balance and NET burn rate
 * (expenses - revenue)
 */
export async function recalculateRunway(
  companyId: string,
  currentCashBalance?: number
): Promise<number> {
  // Get current cash balance if not provided
  let cashBalance = currentCashBalance
  if (cashBalance === undefined) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cashBalance: true },
    })
    cashBalance = company?.cashBalance || 0
  }

  // Use the new burn rate calculator that properly handles net burn
  const metrics = await calculateBurnRateMetrics(companyId, cashBalance)

  // Update company with new runway
  await prisma.company.update({
    where: { id: companyId },
    data: {
      targetMonths: metrics.runway === Infinity ? 999 : Math.floor(metrics.runway),
    },
  })

  return metrics.runway
}

/**
 * Get all overdue bills for a company
 */
export async function getOverdueBills(companyId: string) {
  const today = new Date()
  
  return await prisma.bill.findMany({
    where: {
      companyId,
      paymentStatus: { in: ['unpaid', 'partial'] },
      dueDate: {
        lt: today,
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  })
}

/**
 * Get all overdue invoices for a company
 */
export async function getOverdueInvoices(companyId: string) {
  const today = new Date()
  
  return await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['draft', 'sent'] },
      dueDate: {
        lt: today,
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  })
}

/**
 * Sync all financial metrics for a company
 */
export async function syncAllMetrics(companyId: string) {
  // Recalculate runway
  const runway = await recalculateRunway(companyId)

  // Get overdue amounts
  const overdueBills = await getOverdueBills(companyId)
  const overdueInvoices = await getOverdueInvoices(companyId)

  const totalOverdueBills = overdueBills.reduce((sum, bill) => sum + bill.balanceAmount, 0)
  const totalOverdueInvoices = overdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

  // Get pending bills/invoices
  const pendingBills = await prisma.bill.findMany({
    where: { companyId, paymentStatus: { in: ['unpaid', 'partial'] } },
  })

  const pendingInvoices = await prisma.invoice.findMany({
    where: { companyId, status: { in: ['draft', 'sent'] } },
  })

  return {
    runway,
    overdueBills: {
      count: overdueBills.length,
      total: totalOverdueBills,
    },
    overdueInvoices: {
      count: overdueInvoices.length,
      total: totalOverdueInvoices,
    },
    pendingBills: {
      count: pendingBills.length,
      total: pendingBills.reduce((sum, bill) => sum + bill.balanceAmount, 0),
    },
    pendingInvoices: {
      count: pendingInvoices.length,
      total: pendingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    },
  }
}

