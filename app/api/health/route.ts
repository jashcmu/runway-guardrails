import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test Prisma connection
    await prisma.$connect()
    
    // Simple query to verify database is accessible (MongoDB compatible)
    await prisma.company.findFirst()
    
    return NextResponse.json({ 
      status: 'ok', 
      database: 'connected',
      prisma: 'initialized'
    })
  } catch (error) {
    console.error('Health check error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        status: 'error',
        database: 'disconnected',
        error: errorMessage
      },
      { status: 500 }
    )
  }
}
