import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:5',message:'Register endpoint hit',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json()
    const { email, password, name } = body
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:10',message:'Request body parsed',data:{email,hasPassword:!!password,name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:23',message:'Email validation failed',data:{email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:33',message:'Password validation failed',data:{passwordLength:password?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:49',message:'Before password hashing',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    // Hash password
    const hashedPassword = await hashPassword(password)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:53',message:'After password hashing',data:{hashedLength:hashedPassword?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:56',message:'Before user create',data:{prismaExists:!!prisma},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H4'})}).catch(()=>{});
    // #endregion
    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:70',message:'After user create',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H4'})}).catch(()=>{});
    // #endregion

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user,
      },
      { status: 201 }
    )
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4cba6fa-1e69-44bb-92a8-89250ff265b5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register/route.ts:79',message:'Registration error caught',data:{errorMsg:error instanceof Error?error.message:'Unknown',errorName:error instanceof Error?error.constructor.name:'Unknown'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2,H4'})}).catch(()=>{});
    // #endregion
    console.error('Register error:', error)
    return NextResponse.json(
      {
        error: 'Failed to register user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

