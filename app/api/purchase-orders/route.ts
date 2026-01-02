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

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ purchaseOrders });
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      poNumber,
      vendorId,
      vendorName,
      orderDate,
      expectedDeliveryDate,
      items,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      createdBy
    } = body;

    // Validation
    if (!companyId || !poNumber || !vendorId || !vendorName || !totalAmount || !items || items.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        companyId,
        poNumber,
        vendorId,
        vendorName,
        orderDate: new Date(orderDate || Date.now()),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        items,
        subtotal: subtotal || totalAmount,
        taxAmount: taxAmount || 0,
        totalAmount,
        status: 'draft',
        notes,
        createdBy
      }
    });

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Failed to create purchase order', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { poId, action, userId, grnId, billId, ...updateData } = body;

    if (!poId) {
      return NextResponse.json({ error: 'PO ID required' }, { status: 400 });
    }

    let data: any = { ...updateData };

    switch (action) {
      case 'send':
        data = { status: 'sent' };
        break;
      case 'acknowledge':
        data = { status: 'acknowledged' };
        break;
      case 'approve':
        data = {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date()
        };
        break;
      case 'cancel':
        data = { status: 'cancelled' };
        break;
      case 'link_grn':
        data = { grnId, status: 'received' };
        break;
      case 'link_bill':
        data = { billId };
        break;
      case 'partial_delivery':
        data = { status: 'partial' };
        break;
      case 'complete_delivery':
        data = { 
          status: 'received',
          actualDeliveryDate: new Date()
        };
        break;
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id: poId },
      data
    });

    return NextResponse.json({ purchaseOrder });
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order', details: error.message }, { status: 500 });
  }
}

