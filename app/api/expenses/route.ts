import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const expenses = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      take: 100,
    })

    return NextResponse.json({ expenses }, { status: 200 })
  } catch (error) {
    console.error('Get expenses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('receipt') as File
    const companyId = formData.get('companyId') as string
    const amount = formData.get('amount') as string
    const description = formData.get('description') as string
    const category = formData.get('category') as string
    const date = formData.get('date') as string

    if (!companyId || !amount || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, amount, description, category' },
        { status: 400 }
      )
    }

    // For now, just create the transaction
    // OCR and auto-categorization would be added later with AI services
    const transaction = await prisma.transaction.create({
      data: {
        companyId,
        amount: parseFloat(amount),
        category: category as Category,
        description,
        date: date ? new Date(date) : new Date(),
      },
    })

    // If receipt file provided, could store it and process with OCR
    // For now, just return success
    const receiptProcessed = file ? 'Receipt uploaded (OCR processing coming soon)' : null

    return NextResponse.json({
      transaction,
      receiptProcessed,
      message: 'Expense recorded successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Create expense error:', error)
    return NextResponse.json(
      { error: 'Failed to create expense', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

