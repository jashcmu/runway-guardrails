/**
export const dynamic = 'force-dynamic'
 * Transaction Review Queue API
 * Manages transactions that need manual review due to low classification confidence
 * 
 * Endpoints:
 * GET - Get pending reviews for a company
 * POST - Approve, reject, or bulk process reviews
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/transactions/review - Get transactions needing review
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build query conditions
    const where: Record<string, unknown> = {
      companyId
    }

    if (status === 'pending') {
      where.needsReview = true
      where.reviewedAt = null
    } else if (status === 'reviewed') {
      where.needsReview = false
      where.reviewedAt = { not: null }
    }

    // Get total count
    const total = await prisma.transaction.count({ where })

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        date: true,
        vendorName: true,
        expenseType: true,
        frequency: true,
        needsReview: true,
        reviewReason: true,
        confidenceScore: true,
        transactionType: true,
        matchedInvoiceId: true,
        matchedBillId: true,
        classificationReasoning: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNotes: true
      }
    })

    // Get review statistics
    const stats = await getReviewStats(companyId)

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    })
  } catch (error) {
    console.error('Error fetching review queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    )
  }
}

// POST /api/transactions/review - Process review actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, ...rest } = body
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    const { action, transactionId, transactionIds, data } = rest

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    // Handle different actions
    switch (action) {
      case 'approve':
        return handleApprove(transactionId, companyId, data)
      
      case 'reject':
        return handleReject(transactionId, companyId, data)
      
      case 'recategorize':
        return handleRecategorize(transactionId, companyId, data)
      
      case 'bulk_approve':
        return handleBulkApprove(transactionIds, companyId, data)
      
      case 'bulk_reject':
        return handleBulkReject(transactionIds, companyId, data)
      
      case 'match_invoice':
        return handleMatchInvoice(transactionId, companyId, data)
      
      case 'match_bill':
        return handleMatchBill(transactionId, companyId, data)
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing review action:', error)
    return NextResponse.json(
      { error: 'Failed to process review action' },
      { status: 500 }
    )
  }
}

// Approve a transaction's classification
async function handleApprove(
  transactionId: string,
  companyId: string,
  data: { userId?: string; notes?: string }
) {
  if (!transactionId) {
    return NextResponse.json(
      { error: 'Transaction ID is required' },
      { status: 400 }
    )
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, companyId }
  })

  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    )
  }

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      needsReview: false,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: data.notes || 'Approved by user',
      status: 'approved'
    }
  })

  // Learn from this approval (store pattern for future)
  await learnFromApproval(updated)

  return NextResponse.json({
    success: true,
    message: 'Transaction approved',
    transaction: updated
  })
}

// Reject and request recategorization
async function handleReject(
  transactionId: string,
  companyId: string,
  data: { userId?: string; notes?: string; reason?: string }
) {
  if (!transactionId) {
    return NextResponse.json(
      { error: 'Transaction ID is required' },
      { status: 400 }
    )
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, companyId }
  })

  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    )
  }

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      needsReview: true,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: data.notes || data.reason || 'Rejected by user',
      reviewReason: 'user_rejected'
    }
  })

  return NextResponse.json({
    success: true,
    message: 'Transaction rejected',
    transaction: updated
  })
}

// Recategorize a transaction
async function handleRecategorize(
  transactionId: string,
  companyId: string,
  data: {
    userId?: string
    notes?: string
    category: string
    vendorName?: string
    transactionType?: string
  }
) {
  if (!transactionId) {
    return NextResponse.json(
      { error: 'Transaction ID is required' },
      { status: 400 }
    )
  }

  if (!data.category) {
    return NextResponse.json(
      { error: 'Category is required' },
      { status: 400 }
    )
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, companyId }
  })

  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    )
  }

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      category: data.category as any,
      vendorName: data.vendorName || transaction.vendorName,
      transactionType: data.transactionType || transaction.transactionType,
      needsReview: false,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: data.notes || 'Recategorized by user',
      confidenceScore: 100 // User-confirmed = 100% confidence
    }
  })

  // Learn from this correction
  await learnFromCorrection(transaction, updated)

  return NextResponse.json({
    success: true,
    message: 'Transaction recategorized',
    transaction: updated
  })
}

// Bulk approve transactions
async function handleBulkApprove(
  transactionIds: string[],
  companyId: string,
  data: { userId?: string }
) {
  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json(
      { error: 'Transaction IDs array is required' },
      { status: 400 }
    )
  }

  const result = await prisma.transaction.updateMany({
    where: {
      id: { in: transactionIds },
      companyId
    },
    data: {
      needsReview: false,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: 'Bulk approved by user',
      status: 'approved'
    }
  })

  return NextResponse.json({
    success: true,
    message: `${result.count} transactions approved`,
    count: result.count
  })
}

// Bulk reject transactions
async function handleBulkReject(
  transactionIds: string[],
  companyId: string,
  data: { userId?: string; reason?: string }
) {
  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json(
      { error: 'Transaction IDs array is required' },
      { status: 400 }
    )
  }

  const result = await prisma.transaction.updateMany({
    where: {
      id: { in: transactionIds },
      companyId
    },
    data: {
      needsReview: true,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: data.reason || 'Bulk rejected by user',
      reviewReason: 'user_rejected'
    }
  })

  return NextResponse.json({
    success: true,
    message: `${result.count} transactions rejected`,
    count: result.count
  })
}

// Match transaction to an invoice
async function handleMatchInvoice(
  transactionId: string,
  companyId: string,
  data: { userId?: string; invoiceId: string }
) {
  if (!transactionId || !data.invoiceId) {
    return NextResponse.json(
      { error: 'Transaction ID and Invoice ID are required' },
      { status: 400 }
    )
  }

  // Verify invoice exists
  const invoice = await prisma.invoice.findFirst({
    where: { id: data.invoiceId, companyId }
  })

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Get the transaction
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, companyId }
  })

  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    )
  }

  // Update transaction with match
  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      matchedInvoiceId: data.invoiceId,
      transactionType: 'invoice_payment',
      needsReview: false,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: `Matched to invoice ${invoice.invoiceNumber}`,
      confidenceScore: 100
    }
  })

  // Update invoice payment status
  const newPaidAmount = (invoice.paidAmount || 0) + Math.abs(transaction.amount)
  const newBalanceAmount = invoice.totalAmount - newPaidAmount
  const newStatus = newBalanceAmount <= 0 ? 'paid' : 'partial'

  await prisma.invoice.update({
    where: { id: data.invoiceId },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: Math.max(0, newBalanceAmount),
      status: newStatus,
      paidDate: newStatus === 'paid' ? new Date() : undefined
    }
  })

  return NextResponse.json({
    success: true,
    message: `Transaction matched to invoice ${invoice.invoiceNumber}`,
    transaction: updated
  })
}

// Match transaction to a bill
async function handleMatchBill(
  transactionId: string,
  companyId: string,
  data: { userId?: string; billId: string }
) {
  if (!transactionId || !data.billId) {
    return NextResponse.json(
      { error: 'Transaction ID and Bill ID are required' },
      { status: 400 }
    )
  }

  // Verify bill exists
  const bill = await prisma.bill.findFirst({
    where: { id: data.billId, companyId }
  })

  if (!bill) {
    return NextResponse.json(
      { error: 'Bill not found' },
      { status: 404 }
    )
  }

  // Get the transaction
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, companyId }
  })

  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    )
  }

  // Update transaction with match
  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      matchedBillId: data.billId,
      transactionType: 'bill_payment',
      needsReview: false,
      reviewedBy: data.userId || null,
      reviewedAt: new Date(),
      reviewNotes: `Matched to bill ${bill.billNumber}`,
      confidenceScore: 100,
      vendorName: bill.vendorName
    }
  })

  // Update bill payment status
  const newPaidAmount = (bill.paidAmount || 0) + Math.abs(transaction.amount)
  const newBalanceAmount = bill.totalAmount - newPaidAmount
  const newStatus = newBalanceAmount <= 0 ? 'paid' : 'partial'

  await prisma.bill.update({
    where: { id: data.billId },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: Math.max(0, newBalanceAmount),
      paymentStatus: newStatus,
      paymentDate: newStatus === 'paid' ? new Date() : undefined
    }
  })

  return NextResponse.json({
    success: true,
    message: `Transaction matched to bill ${bill.billNumber}`,
    transaction: updated
  })
}

// Get review queue statistics
async function getReviewStats(companyId: string) {
  const [
    pendingCount,
    reviewedToday,
    averageConfidence,
    byReviewReason
  ] = await Promise.all([
    // Pending reviews count
    prisma.transaction.count({
      where: {
        companyId,
        needsReview: true,
        reviewedAt: null
      }
    }),
    // Reviewed today
    prisma.transaction.count({
      where: {
        companyId,
        reviewedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),
    // Average confidence of pending reviews
    prisma.transaction.aggregate({
      where: {
        companyId,
        needsReview: true,
        confidenceScore: { not: null }
      },
      _avg: { confidenceScore: true }
    }),
    // Group by review reason
    prisma.transaction.groupBy({
      by: ['reviewReason'],
      where: {
        companyId,
        needsReview: true,
        reviewReason: { not: null }
      },
      _count: true
    })
  ])

  return {
    pendingCount,
    reviewedToday,
    averageConfidence: averageConfidence._avg.confidenceScore || 0,
    byReviewReason: byReviewReason.reduce((acc, item) => {
      if (item.reviewReason) {
        acc[item.reviewReason] = item._count
      }
      return acc
    }, {} as Record<string, number>)
  }
}

// Learn from user approval (for future pattern matching)
async function learnFromApproval(transaction: {
  description?: string | null
  category: string
  vendorName?: string | null
  amount: number
}) {
  // This would store patterns in a learning table
  // For now, we'll log for analytics
  console.log('Learning from approval:', {
    description: transaction.description,
    category: transaction.category,
    vendorName: transaction.vendorName,
    amount: transaction.amount
  })
}

// Learn from user correction (for improving accuracy)
async function learnFromCorrection(
  original: {
    description?: string | null
    category: string
    vendorName?: string | null
  },
  corrected: {
    description?: string | null
    category: string
    vendorName?: string | null
  }
) {
  // This would update patterns in a learning table
  // For now, we'll log for analytics
  console.log('Learning from correction:', {
    original: {
      category: original.category,
      vendorName: original.vendorName
    },
    corrected: {
      category: corrected.category,
      vendorName: corrected.vendorName
    },
    description: corrected.description
  })
}
