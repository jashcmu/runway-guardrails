/**
 * Vendor Recommender Module
 * Uses LLM to suggest alternative vendors and cost optimizations
 */

import { chatCompletion } from './openai-client'
import { analyzeVendorSpending, VendorSpendAnalysis } from './vendor-intelligence'

export interface VendorRecommendation {
  currentVendor: string
  currentCategory: string
  currentMonthlySpend: number
  alternatives: Array<{
    name: string
    description: string
    estimatedMonthlyCost: string
    savingsEstimate: string
    pros: string[]
    cons: string[]
    website?: string
    indianAlternative: boolean
  }>
  reasoning: string
  potentialAnnualSavings: number
  recommendationStrength: 'strong' | 'moderate' | 'weak'
}

export interface CostOptimizationSuggestion {
  type: 'switch_vendor' | 'negotiate' | 'reduce_usage' | 'consolidate' | 'eliminate'
  vendorName: string
  currentSpend: number
  suggestion: string
  potentialSavings: number
  effort: 'low' | 'medium' | 'high'
  priority: number
}

// Known vendor categories and alternatives database
const VENDOR_ALTERNATIVES: Record<string, Array<{ name: string; description: string; priceRange: string; indianAlternative: boolean }>> = {
  // Cloud Services
  'aws': [
    { name: 'Google Cloud Platform', description: 'Full-featured cloud platform with strong ML capabilities', priceRange: 'Similar to AWS', indianAlternative: false },
    { name: 'DigitalOcean', description: 'Simple, affordable cloud for startups', priceRange: '30-50% cheaper', indianAlternative: false },
    { name: 'Linode', description: 'Developer-friendly cloud hosting', priceRange: '20-40% cheaper', indianAlternative: false },
    { name: 'Hetzner', description: 'European cloud with excellent pricing', priceRange: '50-70% cheaper', indianAlternative: false }
  ],
  'azure': [
    { name: 'AWS', description: 'Market leader with widest service range', priceRange: 'Similar pricing', indianAlternative: false },
    { name: 'Google Cloud', description: 'Strong in data analytics and ML', priceRange: 'Similar pricing', indianAlternative: false }
  ],
  'google cloud': [
    { name: 'AWS', description: 'Most comprehensive cloud platform', priceRange: 'Similar pricing', indianAlternative: false },
    { name: 'DigitalOcean', description: 'Simpler, more affordable option', priceRange: '40-60% cheaper', indianAlternative: false }
  ],
  
  // SaaS Tools
  'slack': [
    { name: 'Microsoft Teams', description: 'Included with Microsoft 365', priceRange: 'Free with M365', indianAlternative: false },
    { name: 'Discord', description: 'Free for most features', priceRange: 'Free', indianAlternative: false },
    { name: 'Flock', description: 'Indian team messaging app', priceRange: '50% cheaper', indianAlternative: true }
  ],
  'notion': [
    { name: 'Coda', description: 'Document and app builder', priceRange: 'Similar', indianAlternative: false },
    { name: 'Slite', description: 'Collaborative documentation', priceRange: 'Similar', indianAlternative: false }
  ],
  'zoom': [
    { name: 'Google Meet', description: 'Free with Google Workspace', priceRange: 'Free/Included', indianAlternative: false },
    { name: 'Microsoft Teams', description: 'Video conferencing included', priceRange: 'Included with M365', indianAlternative: false },
    { name: 'Jitsi', description: 'Open source video conferencing', priceRange: 'Free', indianAlternative: false }
  ],
  'salesforce': [
    { name: 'Zoho CRM', description: 'Indian CRM with excellent value', priceRange: '60-70% cheaper', indianAlternative: true },
    { name: 'Freshsales', description: 'Indian sales CRM', priceRange: '50% cheaper', indianAlternative: true },
    { name: 'HubSpot CRM', description: 'Free CRM with paid add-ons', priceRange: 'Free tier available', indianAlternative: false }
  ],
  'hubspot': [
    { name: 'Zoho CRM', description: 'Full-featured Indian alternative', priceRange: '50% cheaper', indianAlternative: true },
    { name: 'Freshsales', description: 'Sales-focused CRM from Freshworks', priceRange: '40% cheaper', indianAlternative: true }
  ],
  
  // Accounting/Finance
  'quickbooks': [
    { name: 'Zoho Books', description: 'Indian GST-compliant accounting', priceRange: '60% cheaper', indianAlternative: true },
    { name: 'Tally', description: 'India\'s most popular accounting software', priceRange: '50% cheaper', indianAlternative: true },
    { name: 'Vyapar', description: 'Simple GST billing for SMBs', priceRange: '70% cheaper', indianAlternative: true }
  ],
  
  // Payment Processing
  'stripe': [
    { name: 'Razorpay', description: 'Indian payment gateway', priceRange: 'Similar (2%)', indianAlternative: true },
    { name: 'Cashfree', description: 'Indian payment solutions', priceRange: 'Slightly cheaper', indianAlternative: true },
    { name: 'PayU', description: 'Established Indian payment gateway', priceRange: 'Similar', indianAlternative: true }
  ]
}

/**
 * Get vendor recommendations using LLM
 */
export async function getVendorRecommendations(
  companyId: string,
  vendorName?: string
): Promise<VendorRecommendation[]> {
  // Get vendor spending analysis
  const analyses = await analyzeVendorSpending(companyId, 6)
  
  // Filter to specific vendor if provided, otherwise top 5 by spend
  let targetVendors = analyses
  if (vendorName) {
    targetVendors = analyses.filter(a => 
      a.vendorName.toLowerCase().includes(vendorName.toLowerCase())
    )
  } else {
    targetVendors = analyses.slice(0, 5) // Top 5 vendors
  }
  
  const recommendations: VendorRecommendation[] = []
  
  for (const vendor of targetVendors) {
    try {
      const rec = await generateVendorRecommendation(vendor)
      if (rec) {
        recommendations.push(rec)
      }
    } catch (error) {
      console.warn(`Failed to generate recommendation for ${vendor.vendorName}:`, error)
    }
  }
  
  return recommendations
}

/**
 * Generate recommendation for a single vendor using LLM
 */
async function generateVendorRecommendation(
  vendor: VendorSpendAnalysis
): Promise<VendorRecommendation | null> {
  // Check if we have known alternatives
  const vendorKey = vendor.vendorName.toLowerCase()
  const knownAlternatives = Object.entries(VENDOR_ALTERNATIVES)
    .find(([key]) => vendorKey.includes(key))?.[1]
  
  // If monthly spend is too low, skip
  if (vendor.monthlyAverage < 5000) {
    return null
  }
  
  try {
    const prompt = buildRecommendationPrompt(vendor, knownAlternatives)
    
    const response = await chatCompletion([
      { role: 'system', content: RECOMMENDATION_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ])
    
    return parseRecommendationResponse(response, vendor)
  } catch (error) {
    console.error('LLM recommendation failed:', error)
    
    // Return fallback with known alternatives if available
    if (knownAlternatives) {
      return {
        currentVendor: vendor.vendorName,
        currentCategory: vendor.category || 'Unknown',
        currentMonthlySpend: vendor.monthlyAverage,
        alternatives: knownAlternatives.map(alt => ({
          name: alt.name,
          description: alt.description,
          estimatedMonthlyCost: alt.priceRange,
          savingsEstimate: alt.priceRange.includes('cheaper') ? alt.priceRange : 'Varies',
          pros: [],
          cons: [],
          indianAlternative: alt.indianAlternative
        })),
        reasoning: 'Based on common alternatives in the industry',
        potentialAnnualSavings: Math.round(vendor.monthlyAverage * 12 * 0.2),
        recommendationStrength: 'moderate'
      }
    }
    
    return null
  }
}

const RECOMMENDATION_SYSTEM_PROMPT = `You are a financial advisor specializing in cost optimization for Indian startups and businesses.

Your task is to suggest alternative vendors that could reduce costs while maintaining quality.

Focus on:
1. Indian alternatives when available (lower cost, local support)
2. Free/open-source options for non-critical tools
3. Bundled solutions (e.g., Google Workspace vs separate tools)
4. Pricing tiers that better match usage

Always respond in JSON format with this structure:
{
  "alternatives": [
    {
      "name": "Vendor Name",
      "description": "Brief description",
      "estimatedMonthlyCost": "₹X,XXX or X% of current",
      "savingsEstimate": "₹X,XXX/month or X%",
      "pros": ["pro1", "pro2"],
      "cons": ["con1", "con2"],
      "indianAlternative": true/false
    }
  ],
  "reasoning": "Why these alternatives make sense",
  "recommendationStrength": "strong/moderate/weak"
}`

function buildRecommendationPrompt(
  vendor: VendorSpendAnalysis,
  knownAlternatives?: Array<{ name: string; description: string; priceRange: string }>
): string {
  let prompt = `Suggest cost-effective alternatives for this vendor:

Vendor: ${vendor.vendorName}
Category: ${vendor.category || 'Unknown'}
Monthly Spend: ₹${vendor.monthlyAverage.toLocaleString('en-IN')}
Usage Pattern: ${vendor.frequency} (${vendor.transactionCount} transactions)
Trend: ${vendor.trend} (${vendor.trendPercentage > 0 ? '+' : ''}${vendor.trendPercentage}%)
`

  if (knownAlternatives) {
    prompt += `\nKnown alternatives to consider: ${knownAlternatives.map(a => a.name).join(', ')}`
  }
  
  prompt += `\n
Provide 2-3 alternative vendors with:
- Estimated monthly cost in INR
- Potential savings
- Pros and cons
- Whether it's an Indian company

Focus on practical, proven alternatives used by Indian startups.`

  return prompt
}

function parseRecommendationResponse(
  response: string,
  vendor: VendorSpendAnalysis
): VendorRecommendation | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // Calculate potential savings
    let totalSavingsPercent = 0
    let validAlternatives = 0
    
    const alternatives = (parsed.alternatives || []).map((alt: any) => {
      // Try to extract savings percentage
      const savingsMatch = String(alt.savingsEstimate || '').match(/(\d+)%/)
      if (savingsMatch) {
        totalSavingsPercent += parseInt(savingsMatch[1])
        validAlternatives++
      }
      
      return {
        name: alt.name || 'Unknown',
        description: alt.description || '',
        estimatedMonthlyCost: alt.estimatedMonthlyCost || 'Unknown',
        savingsEstimate: alt.savingsEstimate || 'Unknown',
        pros: Array.isArray(alt.pros) ? alt.pros : [],
        cons: Array.isArray(alt.cons) ? alt.cons : [],
        website: alt.website,
        indianAlternative: Boolean(alt.indianAlternative)
      }
    })
    
    const avgSavingsPercent = validAlternatives > 0 ? totalSavingsPercent / validAlternatives : 15
    const potentialAnnualSavings = Math.round(vendor.monthlyAverage * 12 * (avgSavingsPercent / 100))
    
    return {
      currentVendor: vendor.vendorName,
      currentCategory: vendor.category || 'Unknown',
      currentMonthlySpend: vendor.monthlyAverage,
      alternatives,
      reasoning: parsed.reasoning || 'Based on industry alternatives',
      potentialAnnualSavings,
      recommendationStrength: parsed.recommendationStrength || 'moderate'
    }
  } catch (error) {
    console.warn('Failed to parse recommendation response:', error)
    return null
  }
}

/**
 * Get cost optimization suggestions across all vendors
 */
export async function getCostOptimizationSuggestions(
  companyId: string
): Promise<CostOptimizationSuggestion[]> {
  const analyses = await analyzeVendorSpending(companyId, 6)
  const suggestions: CostOptimizationSuggestion[] = []
  let priority = 0
  
  for (const vendor of analyses) {
    // High-spend recurring vendors - negotiate
    if (vendor.isRecurring && vendor.monthlyAverage > 20000) {
      suggestions.push({
        type: 'negotiate',
        vendorName: vendor.vendorName,
        currentSpend: vendor.monthlyAverage * 12,
        suggestion: `Negotiate annual contract with ${vendor.vendorName} for potential 10-20% discount`,
        potentialSavings: Math.round(vendor.monthlyAverage * 12 * 0.15),
        effort: 'low',
        priority: ++priority
      })
    }
    
    // Increasing costs - review usage
    if (vendor.trend === 'increasing' && vendor.trendPercentage > 30) {
      suggestions.push({
        type: 'reduce_usage',
        vendorName: vendor.vendorName,
        currentSpend: vendor.monthlyAverage * 12,
        suggestion: `Review usage of ${vendor.vendorName} - costs increased ${vendor.trendPercentage}%`,
        potentialSavings: Math.round(vendor.monthlyAverage * vendor.trendPercentage / 100 * 12),
        effort: 'medium',
        priority: ++priority
      })
    }
    
    // Check for switch opportunities
    const vendorKey = vendor.vendorName.toLowerCase()
    const hasAlternatives = Object.keys(VENDOR_ALTERNATIVES).some(k => vendorKey.includes(k))
    if (hasAlternatives && vendor.monthlyAverage > 10000) {
      suggestions.push({
        type: 'switch_vendor',
        vendorName: vendor.vendorName,
        currentSpend: vendor.monthlyAverage * 12,
        suggestion: `Consider switching from ${vendor.vendorName} to a more cost-effective alternative`,
        potentialSavings: Math.round(vendor.monthlyAverage * 12 * 0.3),
        effort: 'high',
        priority: ++priority
      })
    }
  }
  
  // Sort by potential savings (descending)
  return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings)
}

/**
 * Get total potential savings summary
 */
export async function getPotentialSavingsSummary(
  companyId: string
): Promise<{
  totalAnnualSavings: number
  topOpportunities: CostOptimizationSuggestion[]
  vendorsToReview: number
  easyWins: CostOptimizationSuggestion[]
}> {
  const suggestions = await getCostOptimizationSuggestions(companyId)
  
  const totalAnnualSavings = suggestions.reduce((s, sug) => s + sug.potentialSavings, 0)
  const easyWins = suggestions.filter(s => s.effort === 'low')
  
  return {
    totalAnnualSavings,
    topOpportunities: suggestions.slice(0, 5),
    vendorsToReview: suggestions.length,
    easyWins
  }
}
