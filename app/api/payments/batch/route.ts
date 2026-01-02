import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const where: any = { companyId };
    if (status && status !== 'all') {
      where.status = status;
    }

    const paymentBatches = await prisma.paymentBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ paymentBatches });
  } catch (error: any) {
    console.error('Error fetching payment batches:', error);
    return NextResponse.json({ error: 'Failed to fetch payment batches', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      batchNumber,
      batchName,
      paymentDate,
      paymentMethod,
      billIds,
      notes,
      createdBy
    } = body;

    // Validation
    if (!companyId || !billIds || billIds.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: companyId and billIds' 
      }, { status: 400 });
    }

    // Fetch bills to calculate totals
    const bills = await prisma.bill.findMany({
      where: {
        id: { in: billIds },
        companyId
      }
    });

    if (bills.length === 0) {
      return NextResponse.json({ error: 'No valid bills found' }, { status: 404 });
    }

    const totalAmount = bills.reduce((sum, bill) => sum + bill.balanceAmount, 0);
    const billCount = bills.length;

    // Create payment entries for each bill
    const paymentEntries = bills.map(bill => ({
      billId: bill.id,
      billNumber: bill.billNumber,
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      amount: bill.balanceAmount,
      status: 'pending'
    }));

    // Create payment batch
    const paymentBatch = await prisma.paymentBatch.create({
      data: {
        companyId,
        batchNumber: batchNumber || `BATCH-${Date.now()}`,
        batchName: batchName || `Payment Batch ${new Date().toLocaleDateString()}`,
        paymentDate: new Date(paymentDate || Date.now()),
        paymentMethod: paymentMethod || 'bank_transfer',
        totalAmount,
        billCount,
        processedCount: 0,
        failedCount: 0,
        status: 'pending',
        payments: paymentEntries,
        notes,
        createdBy
      }
    });

    return NextResponse.json({ paymentBatch }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment batch:', error);
    return NextResponse.json({ error: 'Failed to create payment batch', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, action, userId } = body;

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    const batch = await prisma.paymentBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: 'Payment batch not found' }, { status: 404 });
    }

    let updateData: any = {};

    switch (action) {
      case 'approve':
        updateData = {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date()
        };
        break;

      case 'process':
        // Process all payments in the batch
        const payments = batch.payments as any[];
        let processedCount = 0;
        let failedCount = 0;
        const updatedPayments = [];

        for (const payment of payments) {
          try {
            // Update bill status
            await prisma.bill.update({
              where: { id: payment.billId },
              data: {
                paidAmount: { increment: payment.amount },
                balanceAmount: { decrement: payment.amount },
                paymentStatus: 'paid',
                status: 'paid',
                paymentDate: new Date(),
                paymentMethod: batch.paymentMethod,
                paymentReference: `Batch: ${batch.batchNumber}`
              }
            });

            // Update vendor last payment date
            if (payment.vendorId) {
              await prisma.vendor.update({
                where: { id: payment.vendorId },
                data: { lastPaymentDate: new Date() }
              });
            }

            updatedPayments.push({
              ...payment,
              status: 'processed',
              processedAt: new Date()
            });
            processedCount++;
          } catch (error) {
            console.error(`Error processing payment for bill ${payment.billId}:`, error);
            updatedPayments.push({
              ...payment,
              status: 'failed',
              error: 'Payment processing failed'
            });
            failedCount++;
          }
        }

        updateData = {
          status: failedCount === 0 ? 'processed' : 'partial',
          processedCount,
          failedCount,
          payments: updatedPayments,
          processedAt: new Date(),
          processedBy: userId
        };
        break;

      case 'cancel':
        updateData = {
          status: 'cancelled',
          cancelledBy: userId,
          cancelledAt: new Date()
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedBatch = await prisma.paymentBatch.update({
      where: { id: batchId },
      data: updateData
    });

    return NextResponse.json({ paymentBatch: updatedBatch });
  } catch (error: any) {
    console.error('Error updating payment batch:', error);
    return NextResponse.json({ error: 'Failed to update payment batch', details: error.message }, { status: 500 });
  }
}

// Get overdue payments
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const overdueBills = await prisma.bill.findMany({
      where: {
        companyId,
        paymentStatus: { in: ['unpaid', 'partial'] },
        dueDate: { lt: new Date() },
        status: { not: 'cancelled' }
      },
      orderBy: { dueDate: 'asc' }
    });

    const totalOverdue = overdueBills.reduce((sum, bill) => sum + bill.balanceAmount, 0);

    return NextResponse.json({
      overdueBills,
      totalOverdue,
      count: overdueBills.length
    });
  } catch (error: any) {
    console.error('Error fetching overdue payments:', error);
    return NextResponse.json({ error: 'Failed to fetch overdue payments', details: error.message }, { status: 500 });
  }
}

