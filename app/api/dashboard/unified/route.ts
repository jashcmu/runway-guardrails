import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Get all stats in parallel for performance
    const [
      pendingBillsCount,
      pendingInvoicesCount,
      subscriptionsRenewingCount,
      overdueBillsCount,
      totalRevenue,
      totalExpenses,
      activeVendorsCount,
      activeCustomersCount,
    ] = await Promise.all([
      // Pending Bills
      prisma.bill.count({
        where: {
          companyId,
          paymentStatus: { in: ['unpaid', 'partial'] },
          status: { not: 'cancelled' }
        }
      }),

      // Pending Invoices
      prisma.invoice.count({
        where: {
          companyId,
          status: { in: ['draft', 'sent', 'pending'] }
        }
      }),

      // Subscriptions Renewing in next 30 days
      prisma.subscription.count({
        where: {
          companyId,
          status: 'active',
          nextBillingDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Overdue Bills
      prisma.bill.count({
        where: {
          companyId,
          paymentStatus: { in: ['unpaid', 'partial'] },
          dueDate: { lt: new Date() },
          status: { not: 'cancelled' }
        }
      }),

      // Total Revenue (from invoices)
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: { in: ['paid', 'sent'] }
        },
        _sum: {
          totalAmount: true
        }
      }),

      // Total Expenses (from transactions)
      prisma.transaction.aggregate({
        where: {
          companyId
        },
        _sum: {
          amount: true
        }
      }),

      // Active Vendors
      prisma.vendor.count({
        where: {
          companyId,
          isActive: true
        }
      }),

      // Active Customers (from subscriptions)
      prisma.subscription.groupBy({
        by: ['customerId'],
        where: {
          companyId,
          status: 'active'
        }
      })
    ]);

    return NextResponse.json({
      pendingBills: pendingBillsCount,
      pendingInvoices: pendingInvoicesCount,
      subscriptionsRenewing: subscriptionsRenewingCount,
      overduePayments: overdueBillsCount,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      activeVendors: activeVendorsCount,
      activeCustomers: activeCustomersCount.length
    });

  } catch (error: any) {
    console.error('Error fetching unified dashboard:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch dashboard data',
      details: error.message 
    }, { status: 500 });
  }
}

