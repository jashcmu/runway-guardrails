'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Filter, 
  RefreshCw,
  ChevronDown,
  Receipt,
  FileText,
  ArrowRight,
  Zap
} from 'lucide-react'

interface Transaction {
  id: string
  amount: number
  category: string
  description: string | null
  date: string
  vendorName: string | null
  expenseType: string
  frequency: string | null
  needsReview: boolean
  reviewReason: string | null
  confidenceScore: number | null
  transactionType: string | null
  matchedInvoiceId: string | null
  matchedBillId: string | null
  classificationReasoning: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
}

interface ReviewStats {
  pendingCount: number
  reviewedToday: number
  averageConfidence: number
  byReviewReason: Record<string, number>
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

const CATEGORIES = ['Hiring', 'Marketing', 'SaaS', 'Cloud', 'G_A']

const CATEGORY_COLORS: Record<string, string> = {
  Hiring: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Marketing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SaaS: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Cloud: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  G_A: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

function ReviewQueueContent() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId') || ''

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [pagination, setPagination] = useState<PaginationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (companyId) {
      fetchReviewQueue()
    }
  }, [companyId])

  const fetchReviewQueue = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/transactions/review?companyId=${companyId}`)
      if (!response.ok) throw new Error('Failed to fetch review queue')
      
      const data = await response.json()
      setTransactions(data.transactions)
      setStats(data.stats)
      setPagination(data.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (transactionId: string) => {
    setProcessingId(transactionId)
    try {
      const response = await fetch('/api/transactions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          transactionId,
          data: { notes: 'Approved via review queue' }
        })
      })
      
      if (!response.ok) throw new Error('Failed to approve transaction')
      
      // Remove from list
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      if (stats) {
        setStats({ ...stats, pendingCount: stats.pendingCount - 1, reviewedToday: stats.reviewedToday + 1 })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (transactionId: string) => {
    setProcessingId(transactionId)
    try {
      const response = await fetch('/api/transactions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          transactionId,
          data: { reason: 'Incorrect classification' }
        })
      })
      
      if (!response.ok) throw new Error('Failed to reject transaction')
      
      await fetchReviewQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRecategorize = async (transactionId: string, newCategory: string) => {
    setProcessingId(transactionId)
    setShowCategoryDropdown(null)
    try {
      const response = await fetch('/api/transactions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recategorize',
          transactionId,
          data: { category: newCategory, notes: `Recategorized to ${newCategory}` }
        })
      })
      
      if (!response.ok) throw new Error('Failed to recategorize transaction')
      
      // Remove from list
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      if (stats) {
        setStats({ ...stats, pendingCount: stats.pendingCount - 1, reviewedToday: stats.reviewedToday + 1 })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recategorize')
    } finally {
      setProcessingId(null)
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return
    
    setProcessingId('bulk')
    try {
      const response = await fetch('/api/transactions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_approve',
          transactionIds: Array.from(selectedIds),
          data: {}
        })
      })
      
      if (!response.ok) throw new Error('Failed to bulk approve')
      
      // Remove from list
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)))
      setSelectedIds(new Set())
      if (stats) {
        setStats({ 
          ...stats, 
          pendingCount: stats.pendingCount - selectedIds.size, 
          reviewedToday: stats.reviewedToday + selectedIds.size 
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk approve')
    } finally {
      setProcessingId(null)
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)))
    }
  }

  const getConfidenceColor = (score: number | null) => {
    if (score === null) return 'bg-gray-200 text-gray-700'
    if (score >= 80) return 'bg-green-100 text-green-800'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getReviewReasonLabel = (reason: string | null) => {
    const labels: Record<string, string> = {
      low_confidence: 'Low Confidence',
      unclear_description: 'Unclear Description',
      no_match: 'No Match Found',
      multiple_matches: 'Multiple Matches',
      user_rejected: 'User Rejected'
    }
    return reason ? labels[reason] || reason : 'Unknown'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (!companyId) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a company to view the review queue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Transaction Review Queue
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Review and approve transactions that need manual verification
            </p>
          </div>
          <button
            onClick={fetchReviewQueue}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Pending Review</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pendingCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Reviewed Today</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.reviewedToday}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Avg Confidence</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.averageConfidence.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Filter className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Low Confidence</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.byReviewReason['low_confidence'] || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="text-blue-800 dark:text-blue-200">
            {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkApprove}
              disabled={processingId === 'bulk'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500 dark:text-slate-400">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={selectedIds.size === transactions.length && transactions.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
            />
          </div>
          <div className="col-span-3">Description</div>
          <div className="col-span-1">Amount</div>
          <div className="col-span-1">Date</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-1">Confidence</div>
          <div className="col-span-1">Reason</div>
          <div className="col-span-2">Actions</div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            <p className="mt-2 text-slate-500">Loading review queue...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && transactions.length === 0 && (
          <div className="p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">All caught up!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              No transactions need review at the moment.
            </p>
            <Link
              href={`/dashboard/transactions?companyId=${companyId}`}
              className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
            >
              View all transactions
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Transaction Rows */}
        {!loading && transactions.map((txn) => (
          <div
            key={txn.id}
            className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
              selectedIds.has(txn.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            {/* Checkbox */}
            <div className="col-span-1 flex items-center">
              <input
                type="checkbox"
                checked={selectedIds.has(txn.id)}
                onChange={() => toggleSelect(txn.id)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
              />
            </div>

            {/* Description */}
            <div className="col-span-3">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {txn.description || 'No description'}
              </p>
              {txn.vendorName && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {txn.vendorName}
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="col-span-1">
              <span className={`font-semibold ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(txn.amount))}
              </span>
            </div>

            {/* Date */}
            <div className="col-span-1 text-slate-600 dark:text-slate-300 text-sm">
              {formatDate(txn.date)}
            </div>

            {/* Category with Dropdown */}
            <div className="col-span-2 relative">
              <button
                onClick={() => setShowCategoryDropdown(showCategoryDropdown === txn.id ? null : txn.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[txn.category] || CATEGORY_COLORS.G_A}`}
              >
                {txn.category}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showCategoryDropdown === txn.id && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1 min-w-32">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleRecategorize(txn.id, cat)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Confidence */}
            <div className="col-span-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(txn.confidenceScore)}`}>
                {txn.confidenceScore ? `${txn.confidenceScore}%` : 'N/A'}
              </span>
            </div>

            {/* Review Reason */}
            <div className="col-span-1 text-xs text-slate-500 dark:text-slate-400">
              {getReviewReasonLabel(txn.reviewReason)}
            </div>

            {/* Actions */}
            <div className="col-span-2 flex items-center gap-2">
              <button
                onClick={() => handleApprove(txn.id)}
                disabled={processingId === txn.id}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Approve"
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleReject(txn.id)}
                disabled={processingId === txn.id}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Reject"
              >
                <XCircle className="w-5 h-5" />
              </button>
              {txn.matchedInvoiceId && (
                <span className="p-2 text-purple-600" title="Matched to Invoice">
                  <Receipt className="w-5 h-5" />
                </span>
              )}
              {txn.matchedBillId && (
                <span className="p-2 text-orange-600" title="Matched to Bill">
                  <FileText className="w-5 h-5" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`px-3 py-1 rounded ${
                page === pagination.page
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReviewQueuePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
            <p className="text-slate-500">Loading review queue...</p>
          </div>
        </div>
      </div>
    }>
      <ReviewQueueContent />
    </Suspense>
  )
}
