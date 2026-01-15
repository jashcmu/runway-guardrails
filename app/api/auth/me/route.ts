import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, getTokenFromCookies } from '@/lib/jwt'
import { auth } from '@/lib/auth-config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null

    // Try NextAuth session first (for Google OAuth users)
    const session = await auth()
    if (session?.user?.id) {
      userId = session.user.id
      console.log('✅ Authenticated via NextAuth session:', session.user.email)
    }

    // Fallback to JWT token (for email/password users - backward compatibility)
    if (!userId) {
      const token = getTokenFromCookies(request)
      if (token) {
        const payload = verifyToken(token)
        if (payload?.userId) {
          userId = payload.userId
          console.log('✅ Authenticated via JWT token')
        }
      }
    }

    // If still no user, not authenticated
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch user data with companies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: {
          include: {
            company: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        user: {
          ...userWithoutPassword,
          companies: user.companies.map(c => ({
            id: c.company.id,
            name: c.company.name,
            slug: c.company.slug,
            role: c.role,
            cashBalance: c.company.cashBalance,
            targetMonths: c.company.targetMonths,
          })),
        },
        // Also include the first company ID for convenience
        companyId: user.companies[0]?.company.id || null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

