import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { createToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:6',message:'Login endpoint hit',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11'})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json()
    const { email, password } = body
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:13',message:'Login body parsed',data:{email,hasPassword:!!password},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11'})}).catch(()=>{});
    // #endregion
  
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:38',message:'User found',data:{userId:user.id,hasPassword:!!user.password},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11'})}).catch(()=>{});
    // #endregion
    
    // Check if user has a password (OAuth-only users don't have passwords)
    if (!user.password) {
      return NextResponse.json(
        { error: 'This account uses OAuth login. Please sign in with Google.' },
        { status: 401 }
      )
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:45',message:'Password verified',data:{isValid:isPasswordValid},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11,H12'})}).catch(()=>{});
    // #endregion

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Create JWT token
    const token = createToken({
      userId: user.id,
      email: user.email,
      companyId: user.companies[0]?.companyId, // Default to first company
    })
    // #`region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:60',message:'Token created',data:{tokenLength:token?.length,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11,H12'})}).catch(()=>{});
    // #endregion

    // Create response with cookie
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          companies: user.companies.map(c => ({
            id: c.company.id,
            name: c.company.name,
            slug: c.company.slug,
            role: c.role,
            cashBalance: c.company.cashBalance,
            targetMonths: c.company.targetMonths,
          })),
        },
      },
      { status: 200 }
    )

    // Set httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:90',message:'Cookie set, returning response',data:{cookieName:'auth-token'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11'})}).catch(()=>{});
    // #endregion

    return response
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:65',message:'Login error caught',data:{errorMsg:error instanceof Error?error.message:'Unknown',errorName:error instanceof Error?error.constructor.name:'Unknown'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H11,H12'})}).catch(()=>{});
    // #endregion
    console.error('Login error:', error)
    return NextResponse.json(
      {
        error: 'Failed to login',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

