import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

// GET - Fetch a specific transaction
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { id } = params

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ transaction }, { status: 200 })
  } catch (error) {
    console.error('Fetch transaction error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// PATCH - Update a transaction
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { id } = params
    const body = await request.json()
    const { date, description, amount, category, gstRate } = body

    // Check if transaction exists
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Validate category if provided
    if (category) {
      const validCategories = Object.values(Category)
      if (!validCategories.includes(category as Category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate amount if provided
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: any = {}
    if (date !== undefined) updateData.date = new Date(date)
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = parseFloat(amount.toString())
    if (category !== undefined) updateData.category = category as Category
    if (gstRate !== undefined) updateData.gstRate = gstRate

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(
      {
        transaction: updatedTransaction,
        message: 'Transaction updated successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Update transaction error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a transaction
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { id } = params

    // Check if transaction exists
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Delete transaction
    await prisma.transaction.delete({
      where: { id },
    })

    return NextResponse.json(
      { message: 'Transaction deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete transaction error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

