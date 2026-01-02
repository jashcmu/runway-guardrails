import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { updateCashOnBillPaid } from '@/lib/cash-sync';

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
      where.paymentStatus = status;
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { dueDate: 'asc' }
    });

    return NextResponse.json({ bills });
  } catch (error: any) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      billNumber,
      vendorId,
      vendorName,
      vendorGSTIN,
      billDate,
      dueDate,
      subtotal,
      taxAmount,
      totalAmount,
      lineItems,
      category,
      originalFileUrl,
      uploadedBy
    } = body;

    // Validation
    if (!companyId || !billNumber || !vendorName || !totalAmount || !billDate) {
      return NextResponse.json({ 
        error: 'Missing required fields: companyId, billNumber, vendorName, totalAmount, billDate' 
      }, { status: 400 });
    }

    // Create bill
    const bill = await prisma.bill.create({
      data: {
        companyId,
        billNumber,
        vendorId,
        vendorName,
        vendorGSTIN,
        billDate: new Date(billDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        subtotal: subtotal || totalAmount,
        taxAmount: taxAmount || 0,
        totalAmount,
        balanceAmount: totalAmount,
        lineItems: lineItems || [],
        category,
        originalFileUrl: originalFileUrl || '',
        uploadedBy,
        status: 'pending_approval',
        paymentStatus: 'unpaid'
      }
    });

    // Update vendor spend if vendorId provided
    if (vendorId) {
      await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          totalSpend: { increment: totalAmount },
          billsCount: { increment: 1 },
          lastPaymentDate: new Date()
        }
      });
    }

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bill:', error);
    return NextResponse.json({ error: 'Failed to create bill', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { billId, action, userId, userName, comments, paymentAmount, paymentMethod, paymentReference } = body;

    if (!billId || !action) {
      return NextResponse.json({ error: 'Bill ID and action required' }, { status: 400 });
    }

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    let updateData: any = {};

    switch (action) {
      case 'approve':
        updateData = {
          approvalStatus: 'approved',
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          approvers: [
            ...(bill.approvers as any[]),
            { userId, userName, status: 'approved', timestamp: new Date(), comments }
          ]
        };
        break;

      case 'reject':
        updateData = {
          approvalStatus: 'rejected',
          status: 'rejected',
          rejectedBy: userId,
          rejectedAt: new Date(),
          rejectionReason: comments,
          approvers: [
            ...(bill.approvers as any[]),
            { userId, userName, status: 'rejected', timestamp: new Date(), comments }
          ]
        };
        break;

      case 'pay':
      case 'record_payment':
        const payAmount = parseFloat(paymentAmount || bill.balanceAmount);
        const currentPaid = bill.paidAmount || 0;
        const newPaidAmount = currentPaid + payAmount;
        const balanceAmount = bill.totalAmount - newPaidAmount;
        
        // Determine payment status
        let paymentStatus = bill.paymentStatus;
        if (balanceAmount <= 0) {
          paymentStatus = 'paid';
        } else if (newPaidAmount > 0) {
          paymentStatus = 'partial';
        }
        
        // Update bill with payment info
        const updatedBill = await prisma.bill.update({
          where: { id: billId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: Math.max(0, balanceAmount),
            paymentStatus,
            paymentDate: balanceAmount <= 0 ? new Date() : bill.paymentDate,
            paidDate: balanceAmount <= 0 ? new Date() : null,
            paymentMethod: paymentMethod || bill.paymentMethod,
            paymentReference: paymentReference || bill.paymentReference,
            status: balanceAmount <= 0 ? 'paid' : bill.status,
          },
        })
        
        // Use cash sync service to update cash balance and runway
        const syncResult = await updateCashOnBillPaid(
          bill.companyId,
          billId,
          payAmount
        );
        
        // Create transaction record for the payment
        await prisma.transaction.create({
          data: {
            companyId: bill.companyId,
            amount: -payAmount, // Negative for expense
            category: 'G_A' as any,
            description: `Payment made for bill ${bill.billNumber} - ${bill.vendorName}`,
            date: new Date(),
            currency: 'INR',
            vendorName: bill.vendorName,
          },
        })
        
        return NextResponse.json({ 
          bill: updatedBill,
          cashBalance: syncResult.newCashBalance,
          runway: syncResult.runway,
          message: balanceAmount <= 0 ? 'Bill fully paid' : `Partial payment recorded. Balance: ₹${balanceAmount.toFixed(2)}`
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedBill = await prisma.bill.update({
      where: { id: billId },
      data: updateData
    });

    return NextResponse.json({ bill: updatedBill });
  } catch (error: any) {
    console.error('Error updating bill:', error);
    return NextResponse.json({ error: 'Failed to update bill', details: error.message }, { status: 500 });
  }
}

