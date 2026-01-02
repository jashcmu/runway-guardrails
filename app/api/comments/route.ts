import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Comments & Collaboration API
 * Add comments/discussions on transactions
 */

// Get comments for a transaction
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    const companyId = searchParams.get('companyId')

    if (!transactionId && !companyId) {
      return NextResponse.json(
        { error: 'Transaction ID or Company ID required' },
        { status: 400 }
      )
    }

    const where: any = {}
    if (transactionId) where.transactionId = transactionId
    if (companyId) where.companyId = companyId

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Group by parent (threading)
    const threaded = comments.reduce((acc: any, comment) => {
      if (!comment.parentId) {
        acc.push({
          ...comment,
          replies: comments.filter(c => c.parentId === comment.id),
        })
      }
      return acc
    }, [])

    return NextResponse.json({ comments: threaded })
  } catch (error) {
    console.error('Get comments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// Create a comment
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      companyId,
      transactionId,
      userId,
      userName,
      content,
      parentId,
    } = body

    if (!companyId || !userId || !userName || !content) {
      return NextResponse.json(
        { error: 'Company ID, user ID, user name, and content required' },
        { status: 400 }
      )
    }

    const comment = await prisma.comment.create({
      data: {
        companyId,
        transactionId,
        userId,
        userName,
        content,
        parentId,
      },
    })

    // TODO: Send notification to mentioned users
    // TODO: Send Slack notification if integrated

    return NextResponse.json({
      success: true,
      comment,
      message: 'Comment posted successfully',
    })
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json(
      { error: 'Failed to post comment' },
      { status: 500 }
    )
  }
}

// Update a comment
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, content, userId } = body

    if (!id || !content || !userId) {
      return NextResponse.json(
        { error: 'Comment ID, content, and user ID required' },
        { status: 400 }
      )
    }

    // Verify user owns the comment
    const existing = await prisma.comment.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only edit your own comments' },
        { status: 403 }
      )
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: { content },
    })

    return NextResponse.json({
      success: true,
      comment,
      message: 'Comment updated successfully',
    })
  } catch (error) {
    console.error('Update comment error:', error)
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    )
  }
}

// Delete a comment
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Comment ID and user ID required' },
        { status: 400 }
      )
    }

    // Verify user owns the comment
    const existing = await prisma.comment.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only delete your own comments' },
        { status: 403 }
      )
    }

    await prisma.comment.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}




