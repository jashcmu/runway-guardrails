import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const isActive = searchParams.get('isActive');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const where: any = { companyId };
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { totalSpend: 'desc' }
    });

    return NextResponse.json({ vendors });
  } catch (error: any) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      name,
      displayName,
      legalName,
      email,
      phone,
      website,
      address,
      gstin,
      pan,
      accountNumber,
      ifscCode,
      bankName,
      accountHolderName,
      paymentTerms,
      creditLimit,
      creditDays,
      category,
      tags,
      notes
    } = body;

    // Validation
    if (!companyId || !name) {
      return NextResponse.json({ error: 'Company ID and vendor name required' }, { status: 400 });
    }

    // Check for duplicate GSTIN
    if (gstin) {
      const existing = await prisma.vendor.findFirst({
        where: { companyId, gstin }
      });
      if (existing) {
        return NextResponse.json({ error: 'Vendor with this GSTIN already exists' }, { status: 400 });
      }
    }

    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        name,
        displayName: displayName || name,
        legalName,
        email,
        phone,
        website,
        address,
        gstin,
        pan,
        accountNumber,
        ifscCode,
        bankName,
        accountHolderName,
        paymentTerms: paymentTerms || 'net30',
        creditLimit,
        creditDays: creditDays || 30,
        category,
        tags: tags || [],
        notes,
        isActive: true,
        kycDocuments: []
      }
    });

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ error: 'Failed to create vendor', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId, ...updateData } = body;

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 });
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: updateData
    });

    return NextResponse.json({ vendor });
  } catch (error: any) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({ error: 'Failed to update vendor', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 });
    }

    // Soft delete - mark as inactive instead of deleting
    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: { isActive: false }
    });

    return NextResponse.json({ vendor });
  } catch (error: any) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({ error: 'Failed to delete vendor', details: error.message }, { status: 500 });
  }
}

