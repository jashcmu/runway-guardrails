import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const userId = searchParams.get('userId');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Using Alert model instead of Notification (which doesn't exist in schema)
    const where: any = { companyId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = await prisma.alert.count({
      where: {
        companyId,
        isRead: false
      }
    });

    return NextResponse.json({ 
      notifications,
      unreadCount
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      message,
      severity,
      riskLevel,
      category,
      threshold
    } = body;

    // Validation
    if (!companyId || !message) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Using Alert model instead of Notification
    const notification = await prisma.alert.create({
      data: {
        companyId,
        message,
        severity: severity || 'info',
        riskLevel,
        category,
        threshold,
        isRead: false
      }
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, notificationIds, action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    let updateData: any = {};

    switch (action) {
      case 'mark_read':
        updateData = { isRead: true };
        break;
      case 'mark_unread':
        updateData = { isRead: false };
        break;
      case 'delete':
        if (notificationId) {
          await prisma.alert.delete({ where: { id: notificationId } });
          return NextResponse.json({ message: 'Notification deleted' });
        } else if (notificationIds) {
          await prisma.alert.deleteMany({ where: { id: { in: notificationIds } } });
          return NextResponse.json({ message: 'Notifications deleted' });
        }
        return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (notificationId) {
      const notification = await prisma.alert.update({
        where: { id: notificationId },
        data: updateData
      });
      return NextResponse.json({ notification });
    } else if (notificationIds) {
      await prisma.alert.updateMany({
        where: { id: { in: notificationIds } },
        data: updateData
      });
      return NextResponse.json({ message: 'Notifications updated' });
    }

    return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification', details: error.message }, { status: 500 });
  }
}

// Mark all as read
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    await prisma.alert.updateMany({
      where: {
        companyId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    return NextResponse.json({ error: 'Failed to mark all as read', details: error.message }, { status: 500 });
  }
}

