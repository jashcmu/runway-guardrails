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

    const accounts = await prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      accountType,
      balance
    } = body;

    // Validation
    if (!companyId || !accountName || !bankName || !accountNumber || !ifscCode) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const account = await prisma.bankAccount.create({
      data: {
        companyId,
        accountName,
        bankName,
        accountNumber,
        ifscCode,
        accountType: accountType || 'savings',
        balance: balance || 0,
        isActive: true
      }
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Failed to create bank account', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, ...updateData } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    const account = await prisma.bankAccount.update({
      where: { id: accountId },
      data: updateData
    });

    return NextResponse.json({ account });
  } catch (error: any) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Failed to update bank account', details: error.message }, { status: 500 });
  }
}




