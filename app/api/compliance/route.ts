import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Calculate next GST due dates
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const gstr1DueDate = new Date(nextMonthYear, nextMonth - 1, 11);
    const gstr3bDueDate = new Date(nextMonthYear, nextMonth - 1, 20);
    const daysUntilGSTR1 = Math.ceil((gstr1DueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get GST data
    const [invoices, transactions] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          companyId,
          invoiceDate: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1)
          }
        }
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          date: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1)
          }
        }
      })
    ]);

    const totalGSTLiability = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0);
    const totalTDSDeducted = transactions.reduce((sum, txn) => sum + (txn.tdsAmount || 0), 0);

    // Calculate quarterly TDS
    const quarter = Math.ceil(currentMonth / 3);
    const tdsQuarterEndMonth = quarter * 3;
    const tdsQuarterEndDate = new Date(currentYear, tdsQuarterEndMonth, 0);
    const tdsDueDate = new Date(currentYear, tdsQuarterEndMonth, 31); // 31st of quarter end month

    // PF/ESI due dates
    const pfDueDate = new Date(currentYear, currentMonth, 15);
    const esiDueDate = new Date(currentYear, currentMonth, 21);

    // Calculate total salary transactions for PF/ESI
    const salaryTransactions = transactions.filter(t => t.category === 'Hiring');
    const totalSalaries = salaryTransactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalPFContribution = totalSalaries * 0.24; // 12% employer + 12% employee
    const totalESIContribution = totalSalaries * 0.04; // 3.25% employer + 0.75% employee

    // Check filing status (simplified - in production, check actual filing records)
    const gstr1Status = daysUntilGSTR1 > 0 ? 'pending' : 'overdue';
    const gstr3bStatus = daysUntilGSTR1 > 0 ? 'pending' : 'overdue';

    // Calculate compliance score
    let complianceScore = 100;
    if (gstr1Status === 'overdue') complianceScore -= 30;
    if (gstr3bStatus === 'overdue') complianceScore -= 30;
    if (totalTDSDeducted > 0 && quarter !== Math.ceil(now.getMonth() / 3)) complianceScore -= 20;

    const complianceData = {
      gst: {
        gstr1Status,
        gstr3bStatus,
        nextDueDate: gstr1DueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        daysRemaining: daysUntilGSTR1,
        totalGSTLiability
      },
      tds: {
        quarterlyDue: `Q${quarter} ${currentYear}`,
        totalTDSDeducted,
        pendingReturns: 0, // In production, check against filed returns
        nextReturnDate: tdsDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      },
      pfEsi: {
        pfDue: pfDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        esiDue: esiDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        totalPFContribution,
        totalESIContribution
      },
      overall: {
        complianceScore: Math.max(0, complianceScore),
        criticalItems: (gstr1Status === 'overdue' ? 1 : 0) + (gstr3bStatus === 'overdue' ? 1 : 0),
        upcomingDeadlines: (daysUntilGSTR1 <= 7 ? 1 : 0) + (pfDueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 ? 1 : 0)
      }
    };

    return NextResponse.json(complianceData);
  } catch (error: any) {
    console.error('Error fetching compliance data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch compliance data',
      details: error.message 
    }, { status: 500 });
  }
}

