export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getVendorRecommendations, getCostOptimizationSuggestions, getPotentialSavingsSummary } from '@/lib/vendor-recommender'
import { analyzeVendorSpending, generateVendorInsights, getVendorAnalyticsSummary, getTopVendors } from '@/lib/vendor-intelligence'

/**
 * GET /api/vendors/recommendations
 * Get vendor analysis, recommendations, and cost optimization suggestions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const type = searchParams.get('type') || 'all' // all, recommendations, insights, analysis
    const vendorName = searchParams.get('vendor') || undefined
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    
    switch (type) {
      case 'recommendations':
        const recommendations = await getVendorRecommendations(companyId, vendorName)
        return NextResponse.json({
          recommendations,
          count: recommendations.length
        })
      
      case 'insights':
        const insights = await generateVendorInsights(companyId)
        return NextResponse.json({
          insights,
          count: insights.length
        })
      
      case 'analysis':
        const [analysis, summary] = await Promise.all([
          analyzeVendorSpending(companyId, 6),
          getVendorAnalyticsSummary(companyId)
        ])
        return NextResponse.json({
          vendors: analysis.slice(0, limit),
          summary,
          totalVendors: analysis.length
        })
      
      case 'savings':
        const [savingsSummary, optimizations] = await Promise.all([
          getPotentialSavingsSummary(companyId),
          getCostOptimizationSuggestions(companyId)
        ])
        return NextResponse.json({
          summary: savingsSummary,
          suggestions: optimizations
        })
      
      case 'top':
        const topVendors = await getTopVendors(companyId, limit)
        return NextResponse.json({
          vendors: topVendors,
          count: topVendors.length
        })
      
      case 'all':
      default:
        // Return comprehensive vendor intelligence
        const [
          allVendors,
          vendorInsights,
          vendorRecommendations,
          vendorSummary,
          savings
        ] = await Promise.all([
          analyzeVendorSpending(companyId, 6),
          generateVendorInsights(companyId),
          getVendorRecommendations(companyId).catch(() => []),
          getVendorAnalyticsSummary(companyId),
          getPotentialSavingsSummary(companyId).catch(() => ({
            totalAnnualSavings: 0,
            topOpportunities: [],
            vendorsToReview: 0,
            easyWins: []
          }))
        ])
        
        return NextResponse.json({
          summary: vendorSummary,
          topVendors: allVendors.slice(0, limit),
          insights: vendorInsights.slice(0, 10),
          recommendations: vendorRecommendations.slice(0, 5),
          potentialSavings: savings,
          totalVendors: allVendors.length
        })
    }
  } catch (error) {
    console.error('Vendor recommendations error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch vendor recommendations', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vendors/recommendations
 * Request a specific vendor analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, vendorName, action } = body
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    
    if (action === 'analyze' && vendorName) {
      // Analyze specific vendor
      const analysis = await analyzeVendorSpending(companyId, 12)
      const vendor = analysis.find(a => 
        a.vendorName.toLowerCase().includes(vendorName.toLowerCase())
      )
      
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
      
      const recommendations = await getVendorRecommendations(companyId, vendorName)
      
      return NextResponse.json({
        vendor,
        recommendations: recommendations[0] || null
      })
    }
    
    if (action === 'compare' && body.vendors && Array.isArray(body.vendors)) {
      // Compare multiple vendors
      const analysis = await analyzeVendorSpending(companyId, 12)
      const vendors = analysis.filter(a => 
        body.vendors.some((v: string) => a.vendorName.toLowerCase().includes(v.toLowerCase()))
      )
      
      return NextResponse.json({
        vendors,
        comparison: {
          totalSpend: vendors.reduce((s, v) => s + v.totalSpend, 0),
          avgTransaction: vendors.length > 0 
            ? vendors.reduce((s, v) => s + v.averageTransaction, 0) / vendors.length 
            : 0
        }
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Vendor analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze vendor', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
