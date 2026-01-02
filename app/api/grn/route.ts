import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const poId = searchParams.get('poId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const where: any = { companyId };
    if (poId) {
      where.purchaseOrderId = poId;
    }

    const grns = await prisma.goodsReceivedNote.findMany({
      where,
      orderBy: { receivedDate: 'desc' }
    });

    return NextResponse.json({ grns });
  } catch (error: any) {
    console.error('Error fetching GRNs:', error);
    return NextResponse.json({ error: 'Failed to fetch GRNs', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      grnNumber,
      purchaseOrderId,
      vendorId,
      vendorName,
      receivedDate,
      items,
      totalQuantity,
      notes,
      receivedBy
    } = body;

    // Validation
    if (!companyId || !grnNumber || !purchaseOrderId || !items || items.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Get PO to verify
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId }
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    // Create GRN
    const grn = await prisma.goodsReceivedNote.create({
      data: {
        companyId,
        grnNumber,
        purchaseOrderId,
        vendorId: vendorId || po.vendorId,
        vendorName: vendorName || po.vendorName,
        receivedDate: new Date(receivedDate || Date.now()),
        items,
        totalQuantity: totalQuantity || items.reduce((sum: number, item: any) => sum + (item.receivedQuantity || 0), 0),
        status: 'draft',
        notes,
        receivedBy
      }
    });

    // Check if all items received
    const poItems = po.items as any[];
    const grnItems = items as any[];
    
    const allReceived = poItems.every((poItem: any) => {
      const totalReceived = grnItems
        .filter((grnItem: any) => grnItem.item === poItem.item)
        .reduce((sum: number, grnItem: any) => sum + (grnItem.receivedQuantity || 0), 0);
      return totalReceived >= poItem.quantity;
    });

    // Update PO status
    await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: allReceived ? 'received' : 'partial',
        grnId: grn.id,
        actualDeliveryDate: allReceived ? new Date() : null
      }
    });

    return NextResponse.json({ grn }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating GRN:', error);
    return NextResponse.json({ error: 'Failed to create GRN', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { grnId, action, userId, qualityStatus, ...updateData } = body;

    if (!grnId) {
      return NextResponse.json({ error: 'GRN ID required' }, { status: 400 });
    }

    let data: any = { ...updateData };

    switch (action) {
      case 'approve':
        data = {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date()
        };
        break;
      case 'reject':
        data = {
          status: 'rejected',
          rejectedBy: userId,
          rejectedAt: new Date()
        };
        break;
      case 'quality_check':
        data = {
          qualityStatus,
          qualityCheckedBy: userId,
          qualityCheckedAt: new Date()
        };
        break;
    }

    const grn = await prisma.goodsReceivedNote.update({
      where: { id: grnId },
      data
    });

    return NextResponse.json({ grn });
  } catch (error: any) {
    console.error('Error updating GRN:', error);
    return NextResponse.json({ error: 'Failed to update GRN', details: error.message }, { status: 500 });
  }
}

// Three-way matching: PO vs GRN vs Bill
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { purchaseOrderId, grnId, billId } = body;

    if (!purchaseOrderId || !grnId || !billId) {
      return NextResponse.json({ error: 'PO ID, GRN ID, and Bill ID required' }, { status: 400 });
    }

    const [po, grn, bill] = await Promise.all([
      prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } }),
      prisma.goodsReceivedNote.findUnique({ where: { id: grnId } }),
      prisma.bill.findUnique({ where: { id: billId } })
    ]);

    if (!po || !grn || !bill) {
      return NextResponse.json({ error: 'One or more documents not found' }, { status: 404 });
    }

    const discrepancies: any[] = [];

    // Check amounts
    if (Math.abs(po.totalAmount - bill.totalAmount) > 1) {
      discrepancies.push({
        type: 'amount',
        field: 'totalAmount',
        poValue: po.totalAmount,
        billValue: bill.totalAmount,
        difference: bill.totalAmount - po.totalAmount
      });
    }

    // Check vendor
    if (po.vendorId !== bill.vendorId) {
      discrepancies.push({
        type: 'vendor',
        field: 'vendorId',
        poValue: po.vendorName,
        billValue: bill.vendorName
      });
    }

    // Check items/quantities (simplified)
    const poItems = po.items as any[];
    const grnItems = grn.items as any[];
    
    poItems.forEach((poItem: any) => {
      const grnItem = grnItems.find((g: any) => g.item === poItem.item);
      if (grnItem && grnItem.receivedQuantity < poItem.quantity) {
        discrepancies.push({
          type: 'quantity',
          field: 'items',
          item: poItem.item,
          ordered: poItem.quantity,
          received: grnItem.receivedQuantity,
          difference: poItem.quantity - grnItem.receivedQuantity
        });
      }
    });

    const matchStatus = discrepancies.length === 0 ? 'matched' : 
                        discrepancies.some(d => d.type === 'amount' && Math.abs(d.difference) > po.totalAmount * 0.05) ? 'discrepancy' :
                        'partial';

    // Update bill with matching status
    await prisma.bill.update({
      where: { id: billId },
      data: {
        purchaseOrderId,
        goodsReceivedNoteId: grnId,
        matchStatus,
        matchDiscrepancies: discrepancies
      }
    });

    return NextResponse.json({
      matchStatus,
      discrepancies,
      message: matchStatus === 'matched' ? 'Three-way match successful' : 'Discrepancies found in matching'
    });
  } catch (error: any) {
    console.error('Error performing three-way match:', error);
    return NextResponse.json({ error: 'Failed to perform three-way match', details: error.message }, { status: 500 });
  }
}

