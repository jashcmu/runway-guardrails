/**
 * Vendor Intelligence Module
 * Analyzes vendor performance, spending patterns, and provides insights
 */

import { prisma } from './prisma'
import { Category } from '@prisma/client'

export interface VendorSpendAnalysis {
  vendorName: string
  vendorId?: string
  category?: string
  totalSpend: number
  transactionCount: number
  averageTransaction: number
  firstTransaction: Date
  lastTransaction: Date
  frequency: 'one-time' | 'weekly' | 'monthly' | 'quarterly' | 'irregular'
  monthlyAverage: number
  trend: 'increasing' | 'decreasing' | 'stable'
  trendPercentage: number
  isRecurring: boolean
  paymentMethods: string[]
  monthlyBreakdown: Array<{ month: string; amount: number; count: number }>
}

export interface VendorInsight {
  type: 'high_spend' | 'increasing_costs' | 'duplicate_vendor' | 'new_vendor' | 'inactive_vendor' | 'price_anomaly'
  severity: 'low' | 'medium' | 'high'
  vendorName: string
  message: string
  recommendation: string
  potentialSavings?: number
  data?: Record<string, unknown>
}

export interface VendorComparison {
  vendorName: string
  category: string
  monthlySpend: number
  alternatives: Array<{
    name: string
    estimatedCost: string
    savingsEstimate?: string
    features?: string[]
    source: string
  }>
}

/**
 * Analyze spending for all vendors of a company
 */
export async function analyzeVendorSpending(
  companyId: string,
  months: number = 12
): Promise<VendorSpendAnalysis[]> {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  // Get all transactions with vendor info
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate },
      amount: { lt: 0 } // Expenses only
    },
    orderBy: { date: 'asc' }
  })
  
  // Group by vendor
  const vendorData: Record<string, {
    transactions: typeof transactions
    category?: Category
  }> = {}
  
  for (const txn of transactions) {
    const vendorName = txn.vendorName || extractVendorName(txn.description || '')
    if (!vendorData[vendorName]) {
      vendorData[vendorName] = { transactions: [], category: txn.category }
    }
    vendorData[vendorName].transactions.push(txn)
  }
  
  // Analyze each vendor
  const analyses: VendorSpendAnalysis[] = []
  
  for (const [vendorName, data] of Object.entries(vendorData)) {
    const txns = data.transactions
    if (txns.length === 0) continue
    
    const totalSpend = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const averageTransaction = totalSpend / txns.length
    const firstTransaction = txns[0].date
    const lastTransaction = txns[txns.length - 1].date
    
    // Calculate monthly breakdown
    const monthlyBreakdown: Array<{ month: string; amount: number; count: number }> = []
    const monthlyMap: Record<string, { amount: number; count: number }> = {}
    
    for (const txn of txns) {
      const monthKey = `${txn.date.getFullYear()}-${String(txn.date.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { amount: 0, count: 0 }
      }
      monthlyMap[monthKey].amount += Math.abs(txn.amount)
      monthlyMap[monthKey].count++
    }
    
    for (const [month, data] of Object.entries(monthlyMap).sort()) {
      monthlyBreakdown.push({ month, ...data })
    }
    
    // Calculate monthly average
    const activeMonths = Object.keys(monthlyMap).length
    const monthlyAverage = activeMonths > 0 ? totalSpend / activeMonths : 0
    
    // Determine frequency
    const daysBetweenFirst = Math.abs(lastTransaction.getTime() - firstTransaction.getTime()) / (1000 * 60 * 60 * 24)
    let frequency: VendorSpendAnalysis['frequency'] = 'irregular'
    
    if (txns.length === 1) {
      frequency = 'one-time'
    } else if (txns.length >= 4) {
      const avgDaysBetween = daysBetweenFirst / (txns.length - 1)
      if (avgDaysBetween >= 5 && avgDaysBetween <= 10) frequency = 'weekly'
      else if (avgDaysBetween >= 25 && avgDaysBetween <= 35) frequency = 'monthly'
      else if (avgDaysBetween >= 85 && avgDaysBetween <= 95) frequency = 'quarterly'
    }
    
    // Calculate trend (comparing first half to second half)
    let trend: VendorSpendAnalysis['trend'] = 'stable'
    let trendPercentage = 0
    
    if (monthlyBreakdown.length >= 2) {
      const midpoint = Math.floor(monthlyBreakdown.length / 2)
      const firstHalf = monthlyBreakdown.slice(0, midpoint)
      const secondHalf = monthlyBreakdown.slice(midpoint)
      
      const firstHalfAvg = firstHalf.reduce((s, m) => s + m.amount, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((s, m) => s + m.amount, 0) / secondHalf.length
      
      if (firstHalfAvg > 0) {
        trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
        if (trendPercentage > 15) trend = 'increasing'
        else if (trendPercentage < -15) trend = 'decreasing'
      }
    }
    
    // Get payment methods used
    const paymentMethods: string[] = []
    for (const txn of txns) {
      const method = detectPaymentMethod(txn.description || '')
      if (method && !paymentMethods.includes(method)) {
        paymentMethods.push(method)
      }
    }
    
    analyses.push({
      vendorName,
      category: data.category,
      totalSpend,
      transactionCount: txns.length,
      averageTransaction,
      firstTransaction,
      lastTransaction,
      frequency,
      monthlyAverage,
      trend,
      trendPercentage: Math.round(trendPercentage),
      isRecurring: frequency !== 'one-time' && frequency !== 'irregular',
      paymentMethods,
      monthlyBreakdown
    })
  }
  
  // Sort by total spend
  return analyses.sort((a, b) => b.totalSpend - a.totalSpend)
}

/**
 * Generate insights about vendor spending
 */
export async function generateVendorInsights(
  companyId: string
): Promise<VendorInsight[]> {
  const analyses = await analyzeVendorSpending(companyId, 6)
  const insights: VendorInsight[] = []
  
  // Get total company spend
  const totalSpend = analyses.reduce((s, a) => s + a.totalSpend, 0)
  
  for (const vendor of analyses) {
    // High spend vendors (>10% of total)
    if (vendor.totalSpend / totalSpend > 0.1) {
      insights.push({
        type: 'high_spend',
        severity: vendor.totalSpend / totalSpend > 0.2 ? 'high' : 'medium',
        vendorName: vendor.vendorName,
        message: `${vendor.vendorName} accounts for ${Math.round((vendor.totalSpend / totalSpend) * 100)}% of your total spending (₹${vendor.totalSpend.toLocaleString('en-IN')})`,
        recommendation: 'Consider negotiating better rates or exploring alternatives',
        potentialSavings: Math.round(vendor.totalSpend * 0.1) // Assume 10% savings possible
      })
    }
    
    // Increasing costs (>20% increase)
    if (vendor.trend === 'increasing' && vendor.trendPercentage > 20) {
      insights.push({
        type: 'increasing_costs',
        severity: vendor.trendPercentage > 50 ? 'high' : 'medium',
        vendorName: vendor.vendorName,
        message: `Spending on ${vendor.vendorName} has increased by ${vendor.trendPercentage}%`,
        recommendation: 'Review usage and consider if the increase is justified'
      })
    }
    
    // New high-value vendor
    const daysSinceFirst = (Date.now() - vendor.firstTransaction.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceFirst < 60 && vendor.totalSpend > 50000) {
      insights.push({
        type: 'new_vendor',
        severity: 'low',
        vendorName: vendor.vendorName,
        message: `New vendor ${vendor.vendorName} with ₹${vendor.totalSpend.toLocaleString('en-IN')} spend in last 2 months`,
        recommendation: 'Ensure proper vendor verification and contract terms'
      })
    }
  }
  
  // Check for potential duplicate vendors
  const vendorNames = analyses.map(a => a.vendorName.toLowerCase())
  for (let i = 0; i < vendorNames.length; i++) {
    for (let j = i + 1; j < vendorNames.length; j++) {
      const similarity = calculateSimilarity(vendorNames[i], vendorNames[j])
      if (similarity > 0.7 && similarity < 1) {
        insights.push({
          type: 'duplicate_vendor',
          severity: 'medium',
          vendorName: analyses[i].vendorName,
          message: `"${analyses[i].vendorName}" and "${analyses[j].vendorName}" might be the same vendor`,
          recommendation: 'Consider consolidating these vendors for better tracking and potential volume discounts',
          data: { otherVendor: analyses[j].vendorName, similarity: Math.round(similarity * 100) }
        })
      }
    }
  }
  
  return insights.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

/**
 * Get top vendors by spend
 */
export async function getTopVendors(
  companyId: string,
  limit: number = 10
): Promise<VendorSpendAnalysis[]> {
  const analyses = await analyzeVendorSpending(companyId, 12)
  return analyses.slice(0, limit)
}

/**
 * Get vendor analytics summary
 */
export async function getVendorAnalyticsSummary(
  companyId: string
): Promise<{
  totalVendors: number
  activeVendors: number
  totalSpend: number
  recurringVendors: number
  increasingCostVendors: number
  topCategory: string
  averageVendorSpend: number
}> {
  const analyses = await analyzeVendorSpending(companyId, 6)
  
  const now = new Date()
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  
  const activeVendors = analyses.filter(a => a.lastTransaction >= threeMonthsAgo)
  const recurringVendors = analyses.filter(a => a.isRecurring)
  const increasingCostVendors = analyses.filter(a => a.trend === 'increasing')
  const totalSpend = analyses.reduce((s, a) => s + a.totalSpend, 0)
  
  // Find top category
  const categorySpend: Record<string, number> = {}
  for (const a of analyses) {
    if (a.category) {
      categorySpend[a.category] = (categorySpend[a.category] || 0) + a.totalSpend
    }
  }
  const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  
  return {
    totalVendors: analyses.length,
    activeVendors: activeVendors.length,
    totalSpend,
    recurringVendors: recurringVendors.length,
    increasingCostVendors: increasingCostVendors.length,
    topCategory,
    averageVendorSpend: analyses.length > 0 ? totalSpend / analyses.length : 0
  }
}

// Utility functions

function extractVendorName(description: string): string {
  if (!description) return 'Unknown'
  
  const cleaned = description
    .replace(/^(payment to|paid to|transfer to|payment for|paid for|neft|imps|rtgs|upi)/i, '')
    .replace(/(payment|invoice|bill|receipt|transaction|ref|reference|txn|\/\d+).*/i, '')
    .replace(/\d{10,}/g, '')
    .trim()
  
  const words = cleaned.split(/\s+/).filter(w => w.length > 1)
  return words.slice(0, 3).join(' ') || 'Unknown'
}

function detectPaymentMethod(description: string): string | undefined {
  const desc = description.toUpperCase()
  if (desc.includes('UPI')) return 'UPI'
  if (desc.includes('NEFT')) return 'NEFT'
  if (desc.includes('RTGS')) return 'RTGS'
  if (desc.includes('IMPS')) return 'IMPS'
  if (desc.includes('CHEQUE') || desc.includes('CHQ')) return 'Cheque'
  return undefined
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return 1
  if (!s1.length || !s2.length) return 0
  
  // Simple word overlap similarity
  const words1 = new Set(s1.split(/\s+/))
  const words2 = new Set(s2.split(/\s+/))
  
  let overlap = 0
  for (const w of words1) {
    if (words2.has(w)) overlap++
  }
  
  return overlap / Math.max(words1.size, words2.size)
}
