import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const entityType = searchParams.get('entityType');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const where: any = { companyId };
    if (entityType) {
      where.entityType = entityType;
    }

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.activityLog.count({ where })
    ]);

    return NextResponse.json({ 
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      userId,
      userName,
      action,
      entityType,
      entityId,
      changes,
      metadata,
      ipAddress,
      userAgent
    } = body;

    // Validation
    if (!companyId || !userId || !userName || !action || !entityType) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const activity = await prisma.activityLog.create({
      data: {
        companyId,
        userId,
        userName,
        action,
        entityType,
        entityId,
        changes,
        metadata,
        ipAddress,
        userAgent
      }
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating activity log:', error);
    return NextResponse.json({ error: 'Failed to create activity log', details: error.message }, { status: 500 });
  }
}

// Get activity summary
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const days = parseInt(searchParams.get('days') || '7');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const activities = await prisma.activityLog.findMany({
      where: {
        companyId,
        timestamp: { gte: since }
      }
    });

    // Group by action
    const actionCounts = activities.reduce((acc: any, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {});

    // Group by entity type
    const entityCounts = activities.reduce((acc: any, activity) => {
      acc[activity.entityType] = (acc[activity.entityType] || 0) + 1;
      return acc;
    }, {});

    // Group by user
    const userCounts = activities.reduce((acc: any, activity) => {
      acc[activity.userName] = (acc[activity.userName] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      summary: {
        totalActivities: activities.length,
        period: `Last ${days} days`,
        actionBreakdown: actionCounts,
        entityBreakdown: entityCounts,
        userBreakdown: userCounts
      }
    });
  } catch (error: any) {
    console.error('Error fetching activity summary:', error);
    return NextResponse.json({ error: 'Failed to fetch activity summary', details: error.message }, { status: 500 });
  }
}

