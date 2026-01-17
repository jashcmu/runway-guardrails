export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'
import { CATEGORY_DISPLAY_NAMES, getCategoryGroup } from '@/lib/categorize'

/**
 * GET /api/analytics/drilldown
 * Drill-down analytics for categories, vendors, and time periods
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const drillType = searchParams.get('type') || 'category' // category, vendor, month
    const target = searchParams.get('target') // specific category, vendor, or month
    const period = searchParams.get('period') || '30' // days
    const limit = parseInt(searchParams.get('limit') || '50')
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(period))
    
    switch (drillType) {
      case 'category':
        return await drilldownCategory(companyId, target as Category | null, startDate, limit)
      
      case 'vendor':
        return await drilldownVendor(companyId, target, startDate, limit)
      
      case 'month':
        return await drilldownMonth(companyId, target, limit)
      
      case 'trend':
        return await getTrendAnalysis(companyId, target as Category | null, 6)
      
      default:
        return NextResponse.json({ error: 'Invalid drill type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Drilldown analytics error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Drill down by category - show all transactions in a category
 */
async function drilldownCategory(
  companyId: string,
  category: Category | null,
  startDate: Date,
  limit: number
) {
  const whereClause: any = {
    companyId,
    date: { gte: startDate },
    amount: { lt: 0 } // Expenses only
  }
  
  if (category) {
    whereClause.category = category
  }
  
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      category: true,
      vendorName: true,
      status: true
    }
  })
  
  // Calculate summary stats
  const totalSpend = transactions.reduce((s, t) => s + Math.abs(t.amount), 0)
  const avgTransaction = transactions.length > 0 ? totalSpend / transactions.length : 0
  
  // Group by vendor
  const byVendor: Record<string, { total: number; count: number }> = {}
  for (const txn of transactions) {
    const vendor = txn.vendorName || extractVendor(txn.description || '') || 'Unknown'
    if (!byVendor[vendor]) byVendor[vendor] = { total: 0, count: 0 }
    byVendor[vendor].total += Math.abs(txn.amount)
    byVendor[vendor].count++
  }
  
  const topVendors = Object.entries(byVendor)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
  
  return NextResponse.json({
    category: category || 'All Categories',
    displayName: category ? CATEGORY_DISPLAY_NAMES[category] : 'All Categories',
    group: category ? getCategoryGroup(category) : null,
    transactions: transactions.map(t => ({
      ...t,
      amount: Math.abs(t.amount)
    })),
    summary: {
      totalSpend,
      transactionCount: transactions.length,
      avgTransaction,
      topVendors
    }
  })
}

/**
 * Drill down by vendor - show all transactions for a vendor
 */
async function drilldownVendor(
  companyId: string,
  vendorName: string | null,
  startDate: Date,
  limit: number
) {
  let whereClause: any = {
    companyId,
    date: { gte: startDate },
    amount: { lt: 0 }
  }
  
  if (vendorName) {
    whereClause.OR = [
      { vendorName: { contains: vendorName, mode: 'insensitive' } },
      { description: { contains: vendorName, mode: 'insensitive' } }
    ]
  }
  
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'desc' },
    take: vendorName ? limit : 100, // More if looking at specific vendor
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      category: true,
      vendorName: true
    }
  })
  
  if (!vendorName) {
    // Return top vendors
    const vendorSpend: Record<string, { total: number; count: number; categories: Set<string> }> = {}
    
    for (const txn of transactions) {
      const vendor = txn.vendorName || extractVendor(txn.description || '') || 'Unknown'
      if (!vendorSpend[vendor]) {
        vendorSpend[vendor] = { total: 0, count: 0, categories: new Set() }
      }
      vendorSpend[vendor].total += Math.abs(txn.amount)
      vendorSpend[vendor].count++
      vendorSpend[vendor].categories.add(txn.category)
    }
    
    const vendors = Object.entries(vendorSpend)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        categories: Array.from(data.categories)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
    
    return NextResponse.json({
      vendors,
      totalVendors: Object.keys(vendorSpend).length
    })
  }
  
  // Specific vendor analysis
  const totalSpend = transactions.reduce((s, t) => s + Math.abs(t.amount), 0)
  const avgTransaction = transactions.length > 0 ? totalSpend / transactions.length : 0
  
  // Category breakdown
  const byCategory: Record<string, number> = {}
  for (const txn of transactions) {
    byCategory[txn.category] = (byCategory[txn.category] || 0) + Math.abs(txn.amount)
  }
  
  // Monthly trend
  const byMonth: Record<string, number> = {}
  for (const txn of transactions) {
    const monthKey = `${txn.date.getFullYear()}-${String(txn.date.getMonth() + 1).padStart(2, '0')}`
    byMonth[monthKey] = (byMonth[monthKey] || 0) + Math.abs(txn.amount)
  }
  
  return NextResponse.json({
    vendor: vendorName,
    transactions: transactions.map(t => ({
      ...t,
      amount: Math.abs(t.amount)
    })),
    summary: {
      totalSpend,
      transactionCount: transactions.length,
      avgTransaction,
      firstTransaction: transactions.length > 0 ? transactions[transactions.length - 1].date : null,
      lastTransaction: transactions.length > 0 ? transactions[0].date : null
    },
    byCategory,
    byMonth: Object.entries(byMonth).sort()
  })
}

/**
 * Drill down by month
 */
async function drilldownMonth(
  companyId: string,
  monthKey: string | null, // YYYY-MM format
  limit: number
) {
  let startDate: Date
  let endDate: Date
  
  if (monthKey) {
    const [year, month] = monthKey.split('-').map(Number)
    startDate = new Date(year, month - 1, 1)
    endDate = new Date(year, month, 0, 23, 59, 59, 999)
  } else {
    // Default to last 6 months summary
    endDate = new Date()
    startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 6)
  }
  
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
      amount: { lt: 0 }
    },
    orderBy: { date: 'desc' },
    take: monthKey ? 500 : 1000 // More for monthly detail
  })
  
  if (!monthKey) {
    // Return monthly summary
    const monthlyData: Record<string, {
      total: number
      count: number
      byCategory: Record<string, number>
    }> = {}
    
    for (const txn of transactions) {
      const key = `${txn.date.getFullYear()}-${String(txn.date.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyData[key]) {
        monthlyData[key] = { total: 0, count: 0, byCategory: {} }
      }
      monthlyData[key].total += Math.abs(txn.amount)
      monthlyData[key].count++
      monthlyData[key].byCategory[txn.category] = 
        (monthlyData[key].byCategory[txn.category] || 0) + Math.abs(txn.amount)
    }
    
    const months = Object.entries(monthlyData)
      .sort()
      .map(([month, data]) => ({
        month,
        ...data
      }))
    
    return NextResponse.json({ months })
  }
  
  // Specific month detail
  const totalSpend = transactions.reduce((s, t) => s + Math.abs(t.amount), 0)
  
  const byCategory: Record<string, number> = {}
  const byVendor: Record<string, number> = {}
  
  for (const txn of transactions) {
    byCategory[txn.category] = (byCategory[txn.category] || 0) + Math.abs(txn.amount)
    const vendor = txn.vendorName || extractVendor(txn.description || '') || 'Unknown'
    byVendor[vendor] = (byVendor[vendor] || 0) + Math.abs(txn.amount)
  }
  
  return NextResponse.json({
    month: monthKey,
    transactions: transactions.slice(0, limit).map(t => ({
      ...t,
      amount: Math.abs(t.amount)
    })),
    summary: {
      totalSpend,
      transactionCount: transactions.length
    },
    byCategory: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ 
        category, 
        displayName: CATEGORY_DISPLAY_NAMES[category as Category] || category,
        amount 
      })),
    byVendor: Object.entries(byVendor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([vendor, amount]) => ({ vendor, amount }))
  })
}

/**
 * Get trend analysis for a category or overall
 */
async function getTrendAnalysis(
  companyId: string,
  category: Category | null,
  months: number
) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  const whereClause: any = {
    companyId,
    date: { gte: startDate, lte: endDate },
    amount: { lt: 0 }
  }
  
  if (category) {
    whereClause.category = category
  }
  
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'asc' }
  })
  
  // Build monthly trend
  const monthlyTrend: Array<{
    month: string
    total: number
    count: number
    avg: number
  }> = []
  
  const monthlyData: Record<string, { total: number; count: number }> = {}
  
  for (const txn of transactions) {
    const key = `${txn.date.getFullYear()}-${String(txn.date.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyData[key]) {
      monthlyData[key] = { total: 0, count: 0 }
    }
    monthlyData[key].total += Math.abs(txn.amount)
    monthlyData[key].count++
  }
  
  for (const [month, data] of Object.entries(monthlyData).sort()) {
    monthlyTrend.push({
      month,
      total: data.total,
      count: data.count,
      avg: data.count > 0 ? data.total / data.count : 0
    })
  }
  
  // Calculate trend metrics
  let trendDirection: 'up' | 'down' | 'stable' = 'stable'
  let trendPercentage = 0
  
  if (monthlyTrend.length >= 2) {
    const recent = monthlyTrend.slice(-2)
    const change = recent[1].total - recent[0].total
    if (recent[0].total > 0) {
      trendPercentage = (change / recent[0].total) * 100
      if (trendPercentage > 10) trendDirection = 'up'
      else if (trendPercentage < -10) trendDirection = 'down'
    }
  }
  
  return NextResponse.json({
    category: category || 'All Categories',
    displayName: category ? CATEGORY_DISPLAY_NAMES[category] : 'All Categories',
    monthlyTrend,
    trend: {
      direction: trendDirection,
      percentage: Math.round(trendPercentage)
    },
    summary: {
      totalSpend: transactions.reduce((s, t) => s + Math.abs(t.amount), 0),
      transactionCount: transactions.length,
      avgMonthly: monthlyTrend.length > 0 
        ? monthlyTrend.reduce((s, m) => s + m.total, 0) / monthlyTrend.length 
        : 0
    }
  })
}

/**
 * Extract vendor name from description
 */
function extractVendor(description: string): string {
  const cleaned = description
    .replace(/^(payment to|paid to|transfer to|neft|imps|rtgs|upi)/i, '')
    .replace(/(payment|invoice|ref|txn).*/i, '')
    .replace(/\d{10,}/g, '')
    .trim()
  
  return cleaned.split(/\s+/).slice(0, 3).join(' ') || 'Unknown'
}
