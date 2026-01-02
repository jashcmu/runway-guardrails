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

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { nextBillingDate: 'asc' }
    });

    // Calculate MRR and ARR
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      // Convert to monthly amount
      let monthlyAmount = sub.amount;
      switch (sub.billingCycle) {
        case 'annually':
          monthlyAmount = sub.amount / 12;
          break;
        case 'quarterly':
          monthlyAmount = sub.amount / 3;
          break;
        case 'semi_annual':
          monthlyAmount = sub.amount / 6;
          break;
      }
      return sum + monthlyAmount;
    }, 0);

    const arr = mrr * 12;

    return NextResponse.json({ 
      subscriptions,
      metrics: {
        mrr,
        arr,
        totalActive: activeSubscriptions.length,
        totalCustomers: new Set(activeSubscriptions.map(s => s.customerId)).size,
        churnRate: 0 // TODO: Calculate based on cancellations
      }
    });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      customerId,
      customerName,
      customerEmail,
      planName,
      planType,
      billingCycle,
      amount,
      setupFee,
      currency,
      discountPercent,
      discountAmount,
      startDate,
      autoRenew
    } = body;

    // Validation
    if (!companyId || !customerId || !customerName || !planName || !amount || !billingCycle) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Calculate next billing date based on cycle
    const start = new Date(startDate || Date.now());
    let nextBilling = new Date(start);
    switch (billingCycle) {
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'quarterly':
        nextBilling.setMonth(nextBilling.getMonth() + 3);
        break;
      case 'semi_annual':
        nextBilling.setMonth(nextBilling.getMonth() + 6);
        break;
      case 'annually':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
    }

    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        name: customerName || planName || 'Subscription',
        customerId,
        customerName,
        customerEmail,
        planName,
        planType,
        billingCycle,
        amount,
        setupFee: setupFee || 0,
        currency: currency || 'INR',
        discountPercent,
        discountAmount,
        startDate: start,
        status: 'active',
        nextBillingDate: nextBilling,
        lastBilledDate: start,
        autoRenew: autoRenew !== false
      }
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscriptionId, action, userId, cancellationReason, ...updateData } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 });
    }

    let data: any = { ...updateData };

    if (action === 'cancel') {
      data = {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason
      };
    } else if (action === 'pause') {
      data = { status: 'paused' };
    } else if (action === 'resume') {
      data = { status: 'active' };
    }

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data
    });

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription', details: error.message }, { status: 500 });
  }
}

// Process subscription renewals (should be called by a cron job)
export async function PUT(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find subscriptions due for renewal today
    const dueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        autoRenew: true,
        nextBillingDate: {
          lte: today
        }
      }
    });

    console.log(`Processing ${dueSubscriptions.length} subscription renewals...`);

    for (const subscription of dueSubscriptions) {
      // Calculate next billing date
      let nextBilling = new Date(subscription.nextBillingDate!);
      switch (subscription.billingCycle) {
        case 'monthly':
          nextBilling.setMonth(nextBilling.getMonth() + 1);
          break;
        case 'quarterly':
          nextBilling.setMonth(nextBilling.getMonth() + 3);
          break;
        case 'semi_annual':
          nextBilling.setMonth(nextBilling.getMonth() + 6);
          break;
        case 'annually':
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
          break;
      }

      // Update subscription
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          lastBilledDate: subscription.nextBillingDate,
          nextBillingDate: nextBilling
        }
      });

      // TODO: Generate invoice
      // TODO: Send notification
    }

    return NextResponse.json({ 
      processed: dueSubscriptions.length,
      message: `Processed ${dueSubscriptions.length} subscription renewals`
    });
  } catch (error: any) {
    console.error('Error processing subscription renewals:', error);
    return NextResponse.json({ error: 'Failed to process renewals', details: error.message }, { status: 500 });
  }
}

