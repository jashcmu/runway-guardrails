import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth-config'

// Link a user to an existing company
export async function POST(request: NextRequest) {
  try {
    const { email, companySlug, role = 'admin' } = await request.json()

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { companies: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found with that email' },
        { status: 404 }
      )
    }

    // Find the company by slug
    const company = await prisma.company.findUnique({
      where: { slug: companySlug }
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found with that slug' },
        { status: 404 }
      )
    }

    // Check if already linked
    const existingLink = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: user.id
        }
      }
    })

    if (existingLink) {
      return NextResponse.json({
        message: 'User is already linked to this company',
        user: { id: user.id, email: user.email },
        company: { id: company.id, name: company.name, slug: company.slug }
      })
    }

    // Create the link
    await prisma.companyUser.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role
      }
    })

    return NextResponse.json({
      success: true,
      message: 'User successfully linked to company',
      user: { id: user.id, email: user.email },
      company: { id: company.id, name: company.name, slug: company.slug }
    })

  } catch (error) {
    console.error('Link company error:', error)
    return NextResponse.json(
      { error: 'Failed to link user to company', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// GET - Check if user is linked to any company
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        companies: {
          include: { company: true }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      companies: user.companies.map(c => ({
        id: c.company.id,
        name: c.company.name,
        slug: c.company.slug,
        role: c.role
      })),
      hasCompany: user.companies.length > 0
    })

  } catch (error) {
    console.error('Check company link error:', error)
    return NextResponse.json(
      { error: 'Failed to check company link' },
      { status: 500 }
    )
  }
}



