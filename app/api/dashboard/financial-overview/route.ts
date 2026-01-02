import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get company cash balance
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cashBalance: true },
    });

    const cashBalance = company?.cashBalance || 0;

    // Calculate Accounts Receivable (AR) - Unpaid invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['draft', 'sent', 'pending'] }, // Not paid yet
      },
      select: {
        totalAmount: true,
        paidAmount: true,
      },
    });

    const accountsReceivable = unpaidInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
      0
    );

    // Calculate Accounts Payable (AP) - Unpaid bills
    const unpaidBills = await prisma.bill.findMany({
      where: {
        companyId,
        paymentStatus: { in: ['unpaid', 'partial'] },
        status: { not: 'cancelled' },
      },
      select: {
        balanceAmount: true,
      },
    });

    const accountsPayable = unpaidBills.reduce(
      (sum, bill) => sum + bill.balanceAmount,
      0
    );

    // Calculate Working Capital
    // Working Capital = Cash + AR - AP
    const workingCapital = cashBalance + accountsReceivable - accountsPayable;

    // Calculate Net Cash Flow (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        companyId,
        date: { gte: thirtyDaysAgo },
      },
      select: {
        amount: true,
      },
    });

    const netCashFlow = recentTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );

    return NextResponse.json({
      cashBalance,
      accountsReceivable,
      accountsPayable,
      workingCapital,
      netCashFlow,
      breakdown: {
        cash: {
          amount: cashBalance,
          description: 'Current cash in bank accounts',
        },
        ar: {
          amount: accountsReceivable,
          invoiceCount: unpaidInvoices.length,
          description: 'Money customers owe you (unpaid invoices)',
        },
        ap: {
          amount: accountsPayable,
          billCount: unpaidBills.length,
          description: 'Money you owe vendors (unpaid bills)',
        },
      },
    });
  } catch (error) {
    console.error('Financial overview error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch financial overview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



