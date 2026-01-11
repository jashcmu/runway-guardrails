/**
 * Category Learning System
 * Learns from user corrections to improve future categorization accuracy
 * 
 * Features:
 * - Stores vendor → category mappings
 * - Tracks description patterns
 * - Builds confidence over time
 * - Suggests categories based on learned patterns
 */

import { prisma } from './prisma'
import { Category } from '@prisma/client'

// Types
export interface LearnedPattern {
  pattern: string
  category: Category
  vendorName?: string
  occurrences: number
  confidence: number
  lastUsed: Date
}

export interface CategorySuggestion {
  category: Category
  confidence: number
  reason: string
  source: 'vendor' | 'pattern' | 'amount' | 'historical'
}

// In-memory cache for faster lookups
const vendorCategoryCache: Map<string, { category: Category; confidence: number }> = new Map()
const patternCache: Map<string, { category: Category; confidence: number }> = new Map()

/**
 * Learn from a user correction or approval
 */
export async function learnFromCorrection(
  companyId: string,
  originalCategory: Category,
  correctedCategory: Category,
  description: string,
  vendorName?: string,
  amount?: number
): Promise<void> {
  const normalizedDesc = normalizeDescription(description)
  const normalizedVendor = vendorName ? normalizeVendorName(vendorName) : null

  // Update or create vendor mapping
  if (normalizedVendor) {
    await updateVendorMapping(companyId, normalizedVendor, correctedCategory)
  }

  // Update description pattern
  await updateDescriptionPattern(companyId, normalizedDesc, correctedCategory)

  // Log the learning event
  console.log(`📚 Learned: "${normalizedVendor || normalizedDesc}" → ${correctedCategory}`)
  
  // Invalidate cache
  if (normalizedVendor) {
    vendorCategoryCache.delete(`${companyId}:${normalizedVendor}`)
  }
  patternCache.delete(`${companyId}:${normalizedDesc}`)
}

/**
 * Learn from user approval (reinforces existing categorization)
 */
export async function learnFromApproval(
  companyId: string,
  category: Category,
  description: string,
  vendorName?: string
): Promise<void> {
  const normalizedDesc = normalizeDescription(description)
  const normalizedVendor = vendorName ? normalizeVendorName(vendorName) : null

  // Reinforce vendor mapping
  if (normalizedVendor) {
    await reinforceVendorMapping(companyId, normalizedVendor, category)
  }

  // Reinforce description pattern
  await reinforceDescriptionPattern(companyId, normalizedDesc, category)
}

/**
 * Get category suggestion based on learned patterns
 */
export async function getSuggestedCategory(
  companyId: string,
  description: string,
  vendorName?: string,
  amount?: number
): Promise<CategorySuggestion | null> {
  const normalizedDesc = normalizeDescription(description)
  const normalizedVendor = vendorName ? normalizeVendorName(vendorName) : null

  // 1. Check vendor mapping (highest priority)
  if (normalizedVendor) {
    const vendorSuggestion = await getVendorCategory(companyId, normalizedVendor)
    if (vendorSuggestion && vendorSuggestion.confidence >= 70) {
      return {
        category: vendorSuggestion.category,
        confidence: vendorSuggestion.confidence,
        reason: `Learned from previous "${normalizedVendor}" transactions`,
        source: 'vendor'
      }
    }
  }

  // 2. Check description pattern
  const patternSuggestion = await getPatternCategory(companyId, normalizedDesc)
  if (patternSuggestion && patternSuggestion.confidence >= 60) {
    return {
      category: patternSuggestion.category,
      confidence: patternSuggestion.confidence,
      reason: 'Matches learned description pattern',
      source: 'pattern'
    }
  }

  // 3. Check similar historical transactions
  const historicalSuggestion = await getHistoricalCategory(companyId, normalizedDesc, amount)
  if (historicalSuggestion) {
    return historicalSuggestion
  }

  return null
}

/**
 * Get all learned patterns for a company
 */
export async function getLearnedPatterns(
  companyId: string
): Promise<{
  vendorMappings: Array<{ vendor: string; category: Category; occurrences: number; confidence: number }>
  descriptionPatterns: Array<{ pattern: string; category: Category; occurrences: number; confidence: number }>
}> {
  // Get vendor mappings from Vendor model
  const vendors = await prisma.vendor.findMany({
    where: {
      companyId,
      category: { not: null }
    },
    select: {
      name: true,
      category: true,
      billsCount: true
    }
  })

  // Get historical transactions grouped by description keywords and category
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      needsReview: false,
      confidenceScore: { gte: 80 }
    },
    select: {
      description: true,
      category: true,
      vendorName: true
    },
    take: 500
  })

  // Build pattern map
  const patternMap = new Map<string, { category: Category; count: number }>()
  
  for (const txn of transactions) {
    if (!txn.description) continue
    
    const normalized = normalizeDescription(txn.description)
    const key = `${normalized}:${txn.category}`
    
    const existing = patternMap.get(key)
    if (existing) {
      existing.count++
    } else {
      patternMap.set(key, { category: txn.category, count: 1 })
    }
  }

  // Convert to arrays
  const vendorMappings = vendors.map(v => ({
    vendor: v.name,
    category: (v.category as Category) || Category.G_A,
    occurrences: v.billsCount,
    confidence: Math.min(100, 50 + v.billsCount * 10)
  }))

  const descriptionPatterns = Array.from(patternMap.entries()).map(([key, value]) => {
    const [pattern] = key.split(':')
    return {
      pattern,
      category: value.category,
      occurrences: value.count,
      confidence: Math.min(100, 40 + value.count * 15)
    }
  })

  return { vendorMappings, descriptionPatterns }
}

/**
 * Clear learned patterns for a company
 */
export async function clearLearnedPatterns(companyId: string): Promise<void> {
  // Clear vendor categories
  await prisma.vendor.updateMany({
    where: { companyId },
    data: { category: null }
  })

  // Clear cache
  for (const key of vendorCategoryCache.keys()) {
    if (key.startsWith(`${companyId}:`)) {
      vendorCategoryCache.delete(key)
    }
  }
  
  for (const key of patternCache.keys()) {
    if (key.startsWith(`${companyId}:`)) {
      patternCache.delete(key)
    }
  }
}

// Helper Functions

function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5) // Take first 5 words
    .join(' ')
}

function normalizeVendorName(vendorName: string): string {
  return vendorName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(pvt|private|ltd|limited|llp|inc|corp|co)$/i, '')
    .trim()
}

async function updateVendorMapping(
  companyId: string,
  vendorName: string,
  category: Category
): Promise<void> {
  // Try to find existing vendor
  const existing = await prisma.vendor.findFirst({
    where: {
      companyId,
      name: { contains: vendorName, mode: 'insensitive' }
    }
  })

  if (existing) {
    await prisma.vendor.update({
      where: { id: existing.id },
      data: { 
        category: category,
        billsCount: { increment: 1 }
      }
    })
  } else {
    // Create new vendor entry
    try {
      await prisma.vendor.create({
        data: {
          companyId,
          name: vendorName,
          category: category,
          billsCount: 1
        }
      })
    } catch (e) {
      // Vendor might already exist with different casing, ignore
      console.log(`Could not create vendor: ${vendorName}`)
    }
  }

  // Update cache
  vendorCategoryCache.set(`${companyId}:${vendorName}`, {
    category,
    confidence: 80
  })
}

async function reinforceVendorMapping(
  companyId: string,
  vendorName: string,
  category: Category
): Promise<void> {
  const existing = await prisma.vendor.findFirst({
    where: {
      companyId,
      name: { contains: vendorName, mode: 'insensitive' }
    }
  })

  if (existing) {
    await prisma.vendor.update({
      where: { id: existing.id },
      data: { billsCount: { increment: 1 } }
    })

    // Update cache with higher confidence
    const currentConfidence = vendorCategoryCache.get(`${companyId}:${vendorName}`)?.confidence || 60
    vendorCategoryCache.set(`${companyId}:${vendorName}`, {
      category,
      confidence: Math.min(100, currentConfidence + 5)
    })
  }
}

async function updateDescriptionPattern(
  companyId: string,
  pattern: string,
  category: Category
): Promise<void> {
  // Update cache
  const currentConfidence = patternCache.get(`${companyId}:${pattern}`)?.confidence || 50
  patternCache.set(`${companyId}:${pattern}`, {
    category,
    confidence: Math.min(100, currentConfidence + 10)
  })
}

async function reinforceDescriptionPattern(
  companyId: string,
  pattern: string,
  category: Category
): Promise<void> {
  const existing = patternCache.get(`${companyId}:${pattern}`)
  
  if (existing && existing.category === category) {
    patternCache.set(`${companyId}:${pattern}`, {
      category,
      confidence: Math.min(100, existing.confidence + 5)
    })
  } else {
    patternCache.set(`${companyId}:${pattern}`, {
      category,
      confidence: 55
    })
  }
}

async function getVendorCategory(
  companyId: string,
  vendorName: string
): Promise<{ category: Category; confidence: number } | null> {
  // Check cache first
  const cacheKey = `${companyId}:${vendorName}`
  if (vendorCategoryCache.has(cacheKey)) {
    return vendorCategoryCache.get(cacheKey)!
  }

  // Query database
  const vendor = await prisma.vendor.findFirst({
    where: {
      companyId,
      name: { contains: vendorName, mode: 'insensitive' },
      category: { not: null }
    },
    select: {
      category: true,
      billsCount: true
    }
  })

  if (vendor && vendor.category) {
    const confidence = Math.min(100, 50 + (vendor.billsCount || 0) * 10)
    const result = { category: vendor.category as Category, confidence }
    vendorCategoryCache.set(cacheKey, result)
    return result
  }

  return null
}

async function getPatternCategory(
  companyId: string,
  pattern: string
): Promise<{ category: Category; confidence: number } | null> {
  // Check cache first
  const cacheKey = `${companyId}:${pattern}`
  if (patternCache.has(cacheKey)) {
    return patternCache.get(cacheKey)!
  }

  // Look for similar historical transactions
  const words = pattern.split(' ').filter(w => w.length >= 3)
  if (words.length === 0) return null

  // Search for transactions with similar words
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      needsReview: false,
      description: { contains: words[0], mode: 'insensitive' }
    },
    select: {
      category: true
    },
    take: 20
  })

  if (transactions.length >= 3) {
    // Find most common category
    const categoryCounts: Record<string, number> = {}
    for (const txn of transactions) {
      categoryCounts[txn.category] = (categoryCounts[txn.category] || 0) + 1
    }

    const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      const [category, count] = sorted[0]
      const confidence = Math.min(100, 40 + (count / transactions.length) * 60)
      const result = { category: category as Category, confidence }
      patternCache.set(cacheKey, result)
      return result
    }
  }

  return null
}

async function getHistoricalCategory(
  companyId: string,
  description: string,
  amount?: number
): Promise<CategorySuggestion | null> {
  // Find similar historical transactions
  const words = description.split(' ').filter(w => w.length >= 3)
  if (words.length === 0) return null

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      needsReview: false,
      confidenceScore: { gte: 70 },
      OR: words.slice(0, 3).map(word => ({
        description: { contains: word, mode: 'insensitive' as const }
      }))
    },
    select: {
      category: true,
      amount: true,
      description: true
    },
    take: 50
  })

  if (transactions.length < 2) return null

  // Group by category
  const categoryStats: Record<string, { count: number; totalAmount: number }> = {}
  
  for (const txn of transactions) {
    if (!categoryStats[txn.category]) {
      categoryStats[txn.category] = { count: 0, totalAmount: 0 }
    }
    categoryStats[txn.category].count++
    categoryStats[txn.category].totalAmount += Math.abs(txn.amount)
  }

  // Find best matching category
  const sorted = Object.entries(categoryStats).sort((a, b) => b[1].count - a[1].count)
  
  if (sorted.length > 0) {
    const [category, stats] = sorted[0]
    const confidence = Math.min(90, 30 + (stats.count / transactions.length) * 60)
    
    return {
      category: category as Category,
      confidence,
      reason: `Similar to ${stats.count} previous transactions`,
      source: 'historical'
    }
  }

  return null
}

/**
 * Export learning data for analytics
 */
export async function exportLearningData(companyId: string): Promise<{
  vendorMappings: number
  patternsCached: number
  totalTransactionsLearned: number
}> {
  const vendors = await prisma.vendor.count({
    where: { companyId, category: { not: null } }
  })

  const learned = await prisma.transaction.count({
    where: { companyId, needsReview: false, confidenceScore: { gte: 80 } }
  })

  let patternCount = 0
  for (const key of patternCache.keys()) {
    if (key.startsWith(`${companyId}:`)) patternCount++
  }

  return {
    vendorMappings: vendors,
    patternsCached: patternCount,
    totalTransactionsLearned: learned
  }
}
