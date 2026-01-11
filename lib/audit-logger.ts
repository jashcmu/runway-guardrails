/**
 * Audit Logger
 * Logs all critical financial operations for compliance and debugging
 * 
 * Features:
 * - Transaction creation/modification logging
 * - Category change tracking
 * - Invoice/Bill matching logs
 * - Cash balance updates
 * - User corrections
 * - Export capability for auditing
 */

import { prisma } from './prisma'

// Types
export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'categorize'
  | 'recategorize'
  | 'match_invoice'
  | 'match_bill'
  | 'unmatch'
  | 'cash_balance_update'
  | 'reconcile'
  | 'import'
  | 'export'
  | 'review'
  | 'bulk_action'

export type EntityType =
  | 'transaction'
  | 'invoice'
  | 'bill'
  | 'company'
  | 'bank_account'
  | 'vendor'
  | 'subscription'
  | 'budget'

export interface AuditLogEntry {
  companyId: string
  userId?: string
  userName?: string
  action: AuditAction
  entityType: EntityType
  entityId?: string
  changes?: Record<string, { before: unknown; after: unknown }>
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp?: Date
}

export interface AuditLogQuery {
  companyId: string
  entityType?: EntityType
  entityId?: string
  userId?: string
  action?: AuditAction
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * Log an audit entry
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<string> {
  try {
    const log = await prisma.activityLog.create({
      data: {
        companyId: entry.companyId,
        userId: entry.userId || 'system',
        userName: entry.userName || 'System',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: (entry.changes || {}) as any,
        metadata: (entry.metadata || {}) as any,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        timestamp: entry.timestamp || new Date()
      }
    })
    
    return log.id
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - logging failure shouldn't break the operation
    return ''
  }
}

/**
 * Log transaction creation
 */
export async function logTransactionCreate(
  companyId: string,
  transactionId: string,
  transactionData: Record<string, unknown>,
  userId?: string,
  userName?: string
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: 'create',
    entityType: 'transaction',
    entityId: transactionId,
    changes: {
      transaction: { before: null, after: transactionData }
    },
    metadata: {
      amount: transactionData.amount,
      category: transactionData.category,
      source: transactionData.source || 'manual'
    }
  })
}

/**
 * Log transaction update
 */
export async function logTransactionUpdate(
  companyId: string,
  transactionId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  userId?: string,
  userName?: string
): Promise<void> {
  // Calculate changed fields
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { before: before[key], after: after[key] }
    }
  }

  if (Object.keys(changes).length === 0) {
    return // No actual changes
  }

  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: 'update',
    entityType: 'transaction',
    entityId: transactionId,
    changes,
    metadata: {
      fieldsChanged: Object.keys(changes)
    }
  })
}

/**
 * Log category change
 */
export async function logCategoryChange(
  companyId: string,
  transactionId: string,
  oldCategory: string,
  newCategory: string,
  userId?: string,
  userName?: string,
  reason?: string
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: 'recategorize',
    entityType: 'transaction',
    entityId: transactionId,
    changes: {
      category: { before: oldCategory, after: newCategory }
    },
    metadata: {
      reason: reason || 'User correction',
      isUserCorrection: true
    }
  })
}

/**
 * Log invoice/bill matching
 */
export async function logMatch(
  companyId: string,
  transactionId: string,
  matchType: 'invoice' | 'bill',
  matchedId: string,
  matchedNumber: string,
  confidence: number,
  userId?: string,
  userName?: string,
  isAutomatic: boolean = false
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: matchType === 'invoice' ? 'match_invoice' : 'match_bill',
    entityType: 'transaction',
    entityId: transactionId,
    changes: {
      [matchType === 'invoice' ? 'matchedInvoiceId' : 'matchedBillId']: { 
        before: null, 
        after: matchedId 
      }
    },
    metadata: {
      matchedNumber,
      confidence,
      isAutomatic,
      matchType
    }
  })
}

/**
 * Log cash balance update
 */
export async function logCashBalanceUpdate(
  companyId: string,
  oldBalance: number,
  newBalance: number,
  reason: string,
  userId?: string,
  userName?: string
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: 'cash_balance_update',
    entityType: 'company',
    entityId: companyId,
    changes: {
      cashBalance: { before: oldBalance, after: newBalance }
    },
    metadata: {
      reason,
      difference: newBalance - oldBalance
    }
  })
}

/**
 * Log bulk action
 */
export async function logBulkAction(
  companyId: string,
  action: 'approve' | 'reject' | 'categorize' | 'delete',
  entityIds: string[],
  entityType: EntityType,
  userId?: string,
  userName?: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: 'bulk_action',
    entityType,
    changes: {
      entityIds: { before: null, after: entityIds }
    },
    metadata: {
      bulkAction: action,
      count: entityIds.length,
      ...additionalData
    }
  })
}

/**
 * Log bank statement import
 */
export async function logBankImport(
  companyId: string,
  fileName: string,
  results: {
    transactionsCreated: number
    duplicatesSkipped: number
    needsReview: number
    averageConfidence: number
  },
  userId?: string,
  userName?: string
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: 'import',
    entityType: 'bank_account',
    metadata: {
      fileName,
      ...results,
      importType: 'bank_statement'
    }
  })
}

/**
 * Log review action
 */
export async function logReviewAction(
  companyId: string,
  transactionId: string,
  action: 'approve' | 'reject' | 'recategorize',
  userId?: string,
  userName?: string,
  notes?: string
): Promise<void> {
  await logAuditEntry({
    companyId,
    userId,
    userName,
    action: action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'recategorize',
    entityType: 'transaction',
    entityId: transactionId,
    metadata: {
      reviewAction: action,
      notes
    }
  })
}

/**
 * Query audit logs
 */
export async function getAuditLogs(query: AuditLogQuery): Promise<{
  logs: Array<{
    id: string
    action: string
    entityType: string
    entityId: string | null
    userName: string
    changes: unknown
    metadata: unknown
    timestamp: Date
  }>
  total: number
  page: number
  pageSize: number
}> {
  const where: Record<string, unknown> = {
    companyId: query.companyId
  }

  if (query.entityType) where.entityType = query.entityType
  if (query.entityId) where.entityId = query.entityId
  if (query.userId) where.userId = query.userId
  if (query.action) where.action = query.action
  if (query.startDate || query.endDate) {
    where.timestamp = {}
    if (query.startDate) (where.timestamp as Record<string, Date>).gte = query.startDate
    if (query.endDate) (where.timestamp as Record<string, Date>).lte = query.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit || 50,
      skip: query.offset || 0,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userName: true,
        changes: true,
        metadata: true,
        timestamp: true
      }
    }),
    prisma.activityLog.count({ where })
  ])

  return {
    logs,
    total,
    page: Math.floor((query.offset || 0) / (query.limit || 50)) + 1,
    pageSize: query.limit || 50
  }
}

/**
 * Get audit summary for a period
 */
export async function getAuditSummary(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalActions: number
  byAction: Record<string, number>
  byEntityType: Record<string, number>
  byUser: Record<string, number>
  categoryChanges: number
  matchesCreated: number
  importsProcessed: number
}> {
  const logs = await prisma.activityLog.findMany({
    where: {
      companyId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      action: true,
      entityType: true,
      userName: true
    }
  })

  const byAction: Record<string, number> = {}
  const byEntityType: Record<string, number> = {}
  const byUser: Record<string, number> = {}
  let categoryChanges = 0
  let matchesCreated = 0
  let importsProcessed = 0

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1
    byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1
    byUser[log.userName] = (byUser[log.userName] || 0) + 1

    if (log.action === 'recategorize') categoryChanges++
    if (log.action === 'match_invoice' || log.action === 'match_bill') matchesCreated++
    if (log.action === 'import') importsProcessed++
  }

  return {
    totalActions: logs.length,
    byAction,
    byEntityType,
    byUser,
    categoryChanges,
    matchesCreated,
    importsProcessed
  }
}

/**
 * Export audit logs for compliance
 */
export async function exportAuditLogs(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  const logs = await prisma.activityLog.findMany({
    where: {
      companyId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { timestamp: 'asc' }
  })

  // Convert to CSV
  const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Changes', 'Metadata']
  const rows = logs.map(log => [
    log.timestamp.toISOString(),
    log.userName,
    log.action,
    log.entityType,
    log.entityId || '',
    JSON.stringify(log.changes || {}),
    JSON.stringify(log.metadata || {})
  ])

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  return csv
}

/**
 * Cleanup old audit logs
 */
export async function cleanupOldAuditLogs(
  companyId: string,
  retentionDays: number = 365
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const result = await prisma.activityLog.deleteMany({
    where: {
      companyId,
      timestamp: { lt: cutoffDate }
    }
  })

  return result.count
}
