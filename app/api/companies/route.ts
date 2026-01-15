import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { generateSlug, isValidSlug } from '@/lib/slug'
import { verifyToken, getTokenFromCookies } from '@/lib/jwt'
import { auth } from '@/lib/auth-config'

// Helper function to validate MongoDB ObjectId format
function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id)
}

// Helper function to get authenticated user ID (supports both NextAuth and JWT)
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  // Try NextAuth session first (for Google OAuth users)
  const session = await auth()
  if (session?.user?.id) {
    console.log('✅ Authenticated via NextAuth:', session.user.email)
    return session.user.id
  }

  // Fallback to JWT token (for email/password users)
  const token = getTokenFromCookies(request)
  if (token) {
    const payload = verifyToken(token)
    if (payload?.userId) {
      console.log('✅ Authenticated via JWT')
      return payload.userId
    }
  }

  return null
}

// GET - Fetch all companies or a specific company by ID or slug
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const companySlug = searchParams.get('companySlug')

    if (companyId || companySlug) {
      let company = null

      // Try to find by slug first (human-friendly)
      if (companySlug) {
        company = await prisma.company.findUnique({
          where: { slug: companySlug },
          include: {
            transactions: true,
            budgets: true,
            alerts: true,
          },
        })
      }
      
      // If not found by slug, try by ObjectId
      if (!company && companyId && isValidObjectId(companyId)) {
        company = await prisma.company.findUnique({
          where: { id: companyId },
          include: {
            transactions: true,
            budgets: true,
            alerts: true,
          },
        })
      }

      if (!company) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 })
      }

      return NextResponse.json({ company }, { status: 200 })
    } else {
      // Fetch all companies
      const companies = await prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ companies }, { status: 200 })
    }
  } catch (error) {
    console.error('Get companies error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create a new company and link to user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug: customSlug, cashBalance, targetMonths } = body

    if (!name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // Set default cash balance if not provided
    const initialCashBalance = cashBalance !== undefined && cashBalance !== null 
      ? parseFloat(cashBalance.toString()) 
      : 0

    // Get authenticated user ID (supports both NextAuth and JWT)
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Generate slug from name or use custom slug
    let slug = customSlug ? customSlug.toLowerCase() : generateSlug(name)
    
    // Validate slug format
    if (!isValidSlug(slug)) {
      return NextResponse.json({ 
        error: 'Invalid company identifier format',
        details: 'Company identifier must contain only lowercase letters, numbers, and hyphens.'
      }, { status: 400 })
    }

    // Check if company with this slug already exists
    let company = await prisma.company.findUnique({
      where: { slug },
    })

    if (!company) {
      // Create company with slug and cash balance
      company = await prisma.company.create({
        data: { 
          name,
          slug,
          cashBalance: initialCashBalance,
          targetMonths: targetMonths ? parseInt(targetMonths.toString()) : null,
        },
      })
      console.log('✅ Created new company:', company.name, company.slug)
    } else {
      // Update existing company's cash balance and target months
      company = await prisma.company.update({
        where: { slug },
        data: {
          cashBalance: initialCashBalance,
          targetMonths: targetMonths ? parseInt(targetMonths.toString()) : null,
        },
      })
      console.log('✅ Updated existing company:', company.name)
    }

    // Link company to user
    const existingLink = await prisma.companyUser.findFirst({
      where: {
        userId: userId,
        companyId: company.id,
      },
    })

    if (!existingLink) {
      await prisma.companyUser.create({
        data: {
          userId: userId,
          companyId: company.id,
          role: 'admin',
        },
      })
      console.log('✅ Linked company to user:', userId)
    }

    return NextResponse.json({ 
      company, 
      message: 'Company information saved successfully' 
    }, { status: 201 })
  } catch (error) {
    console.error('Create company error:', error)
    return NextResponse.json(
      { error: 'Failed to save company information', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update an existing company
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, companySlug, name, slug: newSlug, cashBalance, targetMonths } = body

    if (!companyId && !companySlug) {
      return NextResponse.json({ error: 'Company ID or slug is required' }, { status: 400 })
    }

    if (!name && !newSlug && cashBalance === undefined && targetMonths === undefined) {
      return NextResponse.json({ error: 'At least one field to update is required' }, { status: 400 })
    }

    // Find company by slug or ID
    const whereClause = companySlug 
      ? { slug: companySlug }
      : { id: companyId }

    const updateData: any = {}
    if (name) updateData.name = name
    if (newSlug) {
      if (!isValidSlug(newSlug)) {
        return NextResponse.json({ 
          error: 'Invalid slug format',
          details: 'Slug must contain only lowercase letters, numbers, and hyphens.'
        }, { status: 400 })
      }
      updateData.slug = newSlug
    }
    if (cashBalance !== undefined) updateData.cashBalance = parseFloat(cashBalance)
    if (targetMonths !== undefined) updateData.targetMonths = targetMonths ? parseInt(targetMonths) : null

    const company = await prisma.company.update({
      where: whereClause,
      data: updateData,
    })

    return NextResponse.json({ company, message: 'Company updated successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('Update company error:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to update company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a company
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const companySlug = searchParams.get('companySlug')

    if (!companyId && !companySlug) {
      return NextResponse.json({ error: 'Company ID or slug is required' }, { status: 400 })
    }

    // Delete by slug or ID
    if (companySlug) {
      await prisma.company.delete({
        where: { slug: companySlug },
      })
    } else if (companyId) {
      await prisma.company.delete({
        where: { id: companyId },
      })
    }

    return NextResponse.json({ message: 'Company deleted successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('Delete company error:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to delete company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

