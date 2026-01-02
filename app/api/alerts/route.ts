import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const alerts = await prisma.alert.findMany({
      where: {
        companyId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    return NextResponse.json({ alerts }, { status: 200 })
  } catch (error) {
    console.error('Alerts fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { alertId, isRead } = body

    if (!alertId) {
      return NextResponse.json({ error: 'alertId is required' }, { status: 400 })
    }

    await prisma.alert.update({
      where: { id: alertId },
      data: { isRead: isRead ?? true },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Alert update error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update alert',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

