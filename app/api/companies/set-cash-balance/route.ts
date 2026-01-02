import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Quick fix endpoint to set cash balance manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, cashBalance } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (cashBalance === undefined || cashBalance === null) {
      return NextResponse.json(
        { error: 'cashBalance is required' },
        { status: 400 }
      );
    }

    const parsedBalance = parseFloat(cashBalance.toString());

    if (isNaN(parsedBalance)) {
      return NextResponse.json(
        { error: 'cashBalance must be a valid number' },
        { status: 400 }
      );
    }

    // Update company cash balance
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        cashBalance: parsedBalance,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cash balance set to ₹${parsedBalance.toLocaleString()}`,
      company: {
        id: company.id,
        name: company.name,
        cashBalance: company.cashBalance,
      },
    });
  } catch (error) {
    console.error('Set cash balance error:', error);
    return NextResponse.json(
      {
        error: 'Failed to set cash balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


