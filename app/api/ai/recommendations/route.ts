export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { generateAIRecommendations, generateLLMInsights, answerFinancialQuestion } from '@/lib/ai-co-pilot'

/**
 * GET /api/ai/recommendations
 * Get proactive AI recommendations for the company
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const type = searchParams.get('type') || 'all' // all, insights, recommendations
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    
    switch (type) {
      case 'insights':
        const insights = await generateLLMInsights(companyId)
        return NextResponse.json({
          insights,
          count: insights.length
        })
      
      case 'recommendations':
      case 'all':
      default:
        const [recommendations, llmInsights] = await Promise.all([
          generateAIRecommendations(companyId),
          generateLLMInsights(companyId).catch(() => [])
        ])
        
        return NextResponse.json({
          recommendations: recommendations.slice(0, limit),
          insights: llmInsights,
          summary: {
            total: recommendations.length,
            critical: recommendations.filter(r => r.priority === 'critical').length,
            high: recommendations.filter(r => r.priority === 'high').length,
            medium: recommendations.filter(r => r.priority === 'medium').length,
            warnings: recommendations.filter(r => r.type === 'warning').length,
            opportunities: recommendations.filter(r => r.type === 'opportunity').length
          }
        })
    }
  } catch (error) {
    console.error('AI recommendations error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate AI recommendations', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/recommendations
 * Ask a question to the AI co-pilot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, question, context } = body
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    
    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }
    
    const response = await answerFinancialQuestion(companyId, question)
    
    return NextResponse.json({
      question,
      ...response
    })
  } catch (error) {
    console.error('AI question error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process question', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
