/**
 * Auto-Categorization Module
 * Primary: LLM-powered categorization
 * Fallback: Rule-based keyword matching
 */

import { Category } from '@prisma/client'
import { categorizeWithLLM, categorizeTransactionsBatch, LLMCategorizationResult } from './llm-categorizer'
import { categorizeExpense, CATEGORY_DESCRIPTIONS } from './categorize'

export interface TransactionToCategorize {
  description: string
  amount: number
  date?: Date
  type?: 'credit' | 'debit'
}

export interface CategorizationResult {
  category: Category
  confidence: number
  reasoning: string
  vendorName: string | null
  paymentMethod: string | null
  isRecurring: boolean
  suggestedFrequency: string | null
  flags: string[]
  source: 'llm' | 'rules' | 'cache'
}

// Simple in-memory cache for repeated categorizations
const categorizationCache = new Map<string, CategorizationResult>()
const CACHE_TTL = 3600000 // 1 hour

/**
 * Auto-categorize a single transaction
 * Uses LLM as primary, falls back to rule-based
 */
export async function autoCategorizeTransaction(
  transaction: TransactionToCategorize
): Promise<Category> {
  const result = await categorizeTransactionEnhanced(transaction)
  return result.category
}

/**
 * Enhanced categorization returning full result with metadata
 */
export async function categorizeTransactionEnhanced(
  transaction: TransactionToCategorize
): Promise<CategorizationResult> {
  // Check cache first
  const cacheKey = `${transaction.description}|${transaction.amount}`.toLowerCase()
  const cached = categorizationCache.get(cacheKey)
  if (cached) {
    return { ...cached, source: 'cache' }
  }
  
  try {
    // Try LLM categorization
    const llmResult = await categorizeWithLLM({
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date,
      type: transaction.type
    })
    
    const result: CategorizationResult = {
      category: llmResult.category,
      confidence: llmResult.confidence,
      reasoning: llmResult.reasoning,
      vendorName: llmResult.vendorName,
      paymentMethod: llmResult.paymentMethod,
      isRecurring: llmResult.isRecurring,
      suggestedFrequency: llmResult.suggestedFrequency,
      flags: llmResult.flags,
      source: llmResult.flags.includes('llm_error') ? 'rules' : 'llm'
    }
    
    // Cache the result
    categorizationCache.set(cacheKey, result)
    setTimeout(() => categorizationCache.delete(cacheKey), CACHE_TTL)
    
    return result
  } catch (error) {
    console.error('Auto-categorization error:', error)
    
    // Fallback to rule-based
    const category = categorizeExpense(transaction.description)
    const result: CategorizationResult = {
      category,
      confidence: 50,
      reasoning: 'Rule-based categorization (LLM unavailable)',
      vendorName: null,
      paymentMethod: null,
      isRecurring: false,
      suggestedFrequency: null,
      flags: ['fallback'],
      source: 'rules'
    }
    
    return result
  }
}

/**
 * Bulk categorize multiple transactions
 * More efficient than individual calls
 */
export async function autoCategorizeBulk(
  transactions: TransactionToCategorize[]
): Promise<Array<{ transaction: TransactionToCategorize; category: Category; result: CategorizationResult }>> {
  if (transactions.length === 0) return []
  
  // Check cache first
  const uncached: { index: number; transaction: TransactionToCategorize }[] = []
  const results: Array<{ transaction: TransactionToCategorize; category: Category; result: CategorizationResult }> = 
    new Array(transactions.length)
  
  transactions.forEach((txn, index) => {
    const cacheKey = `${txn.description}|${txn.amount}`.toLowerCase()
    const cached = categorizationCache.get(cacheKey)
    
    if (cached) {
      results[index] = {
        transaction: txn,
        category: cached.category,
        result: { ...cached, source: 'cache' }
      }
    } else {
      uncached.push({ index, transaction: txn })
    }
  })
  
  // Process uncached transactions
  if (uncached.length > 0) {
    try {
      const llmResults = await categorizeTransactionsBatch(
        uncached.map(u => ({
          description: u.transaction.description,
          amount: u.transaction.amount,
          date: u.transaction.date,
          type: u.transaction.type
        }))
      )
      
      uncached.forEach((item, i) => {
        const llmResult = llmResults[i]
        const result: CategorizationResult = {
          category: llmResult.category,
          confidence: llmResult.confidence,
          reasoning: llmResult.reasoning,
          vendorName: llmResult.vendorName,
          paymentMethod: llmResult.paymentMethod,
          isRecurring: llmResult.isRecurring,
          suggestedFrequency: llmResult.suggestedFrequency,
          flags: llmResult.flags,
          source: llmResult.flags.includes('llm_error') || llmResult.flags.includes('batch_error') ? 'rules' : 'llm'
        }
        
        // Cache the result
        const cacheKey = `${item.transaction.description}|${item.transaction.amount}`.toLowerCase()
        categorizationCache.set(cacheKey, result)
        setTimeout(() => categorizationCache.delete(cacheKey), CACHE_TTL)
        
        results[item.index] = {
          transaction: item.transaction,
          category: result.category,
          result
        }
      })
    } catch (error) {
      console.error('Bulk categorization error:', error)
      
      // Fallback to rule-based for all uncached
      uncached.forEach((item) => {
        const category = categorizeExpense(item.transaction.description)
        const result: CategorizationResult = {
          category,
          confidence: 50,
          reasoning: 'Rule-based categorization (batch error)',
          vendorName: null,
          paymentMethod: null,
          isRecurring: false,
          suggestedFrequency: null,
          flags: ['batch_fallback'],
          source: 'rules'
        }
        
        results[item.index] = {
          transaction: item.transaction,
          category,
          result
        }
      })
    }
  }
  
  return results
}

/**
 * Get category suggestions with confidence for review
 */
export async function getCategorySuggestions(
  description: string,
  amount: number,
  count: number = 3
): Promise<Array<{ category: Category; confidence: number; reasoning: string }>> {
  const result = await categorizeTransactionEnhanced({
    description,
    amount,
    type: amount < 0 ? 'debit' : 'credit'
  })
  
  // Return primary suggestion plus alternatives based on category group
  const suggestions: Array<{ category: Category; confidence: number; reasoning: string }> = [
    {
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning
    }
  ]
  
  // Add lower-confidence alternatives from rule-based matching
  const allCategories = Object.values(Category)
  const desc = description.toLowerCase()
  
  for (const cat of allCategories) {
    if (cat !== result.category && suggestions.length < count) {
      const catDesc = CATEGORY_DESCRIPTIONS[cat]?.toLowerCase() || ''
      if (catDesc.split(',').some(keyword => desc.includes(keyword.trim()))) {
        suggestions.push({
          category: cat,
          confidence: Math.max(20, result.confidence - 30),
          reasoning: `Alternative based on keyword match`
        })
      }
    }
  }
  
  return suggestions.slice(0, count)
}

/**
 * Clear the categorization cache
 */
export function clearCategorizationCache(): void {
  categorizationCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; hitRate: number } {
  return {
    size: categorizationCache.size,
    hitRate: 0 // Would need to track hits/misses for this
  }
}
