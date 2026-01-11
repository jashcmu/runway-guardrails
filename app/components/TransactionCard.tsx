'use client'

import { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Receipt,
  FileText,
  ChevronDown,
  Edit2,
  Link as LinkIcon
} from 'lucide-react'

// Types
interface Transaction {
  id: string
  amount: number
  category: string
  description: string | null
  date: string | Date
  vendorName: string | null
  expenseType: string
  frequency: string | null
  needsReview: boolean
  reviewReason: string | null
  confidenceScore: number | null
  transactionType: string | null
  matchedInvoiceId: string | null
  matchedBillId: string | null
}

interface TransactionCardProps {
  transaction: Transaction
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onRecategorize?: (id: string, newCategory: string) => void
  onMatchInvoice?: (id: string) => void
  onMatchBill?: (id: string) => void
  isProcessing?: boolean
  showActions?: boolean
  compact?: boolean
}

const CATEGORIES = ['Hiring', 'Marketing', 'SaaS', 'Cloud', 'G_A']

const CATEGORY_COLORS: Record<string, string> = {
  Hiring: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Marketing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SaaS: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Cloud: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  G_A: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  invoice_payment: 'Invoice Payment',
  bill_payment: 'Bill Payment',
  expense: 'Expense',
  revenue: 'Revenue',
  transfer: 'Transfer',
  unknown: 'Unknown'
}

export default function TransactionCard({
  transaction,
  onApprove,
  onReject,
  onRecategorize,
  onMatchInvoice,
  onMatchBill,
  isProcessing = false,
  showActions = true,
  compact = false
}: TransactionCardProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Math.abs(amount))
  }

  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getConfidenceColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-600'
    if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    if (score >= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }

  const getConfidenceLabel = (score: number | null) => {
    if (score === null) return 'N/A'
    if (score >= 80) return 'High'
    if (score >= 60) return 'Medium'
    return 'Low'
  }

  const getReviewReasonLabel = (reason: string | null) => {
    const labels: Record<string, string> = {
      low_confidence: 'Low Confidence',
      unclear_description: 'Unclear',
      no_match: 'No Match',
      multiple_matches: 'Multiple Matches',
      user_rejected: 'Rejected'
    }
    return reason ? labels[reason] || reason : ''
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
        {/* Left: Amount & Description */}
        <div className="flex items-center gap-4">
          <div className={`text-lg font-semibold ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {transaction.amount < 0 ? '-' : '+'}{formatCurrency(transaction.amount)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">
              {transaction.description || transaction.vendorName || 'No description'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(transaction.date)}
            </p>
          </div>
        </div>

        {/* Right: Category & Confidence */}
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.G_A}`}>
            {transaction.category}
          </span>
          
          {transaction.confidenceScore !== null && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(transaction.confidenceScore)}`}>
              {transaction.confidenceScore}%
            </span>
          )}

          {transaction.needsReview && (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}

          {transaction.matchedInvoiceId && (
            <Receipt className="w-4 h-4 text-purple-500" />
          )}

          {transaction.matchedBillId && (
            <FileText className="w-4 h-4 text-orange-500" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border ${
      transaction.needsReview 
        ? 'border-amber-200 dark:border-amber-800' 
        : 'border-slate-200 dark:border-slate-700'
    } overflow-hidden hover:shadow-md transition-shadow`}>
      {/* Header with Review Status */}
      {transaction.needsReview && (
        <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 flex items-center gap-2 border-b border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Needs Review
          </span>
          {transaction.reviewReason && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              — {getReviewReasonLabel(transaction.reviewReason)}
            </span>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        {/* Top Row: Amount, Description, Date */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-xl font-bold ${
                transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {transaction.amount < 0 ? '-' : '+'}{formatCurrency(transaction.amount)}
              </span>
              
              {transaction.transactionType && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                  {TRANSACTION_TYPE_LABELS[transaction.transactionType] || transaction.transactionType}
                </span>
              )}
            </div>
            
            <p className="text-slate-800 dark:text-slate-200 font-medium">
              {transaction.description || 'No description'}
            </p>
            
            {transaction.vendorName && transaction.vendorName !== transaction.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {transaction.vendorName}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDate(transaction.date)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {transaction.expenseType === 'recurring' && transaction.frequency 
                ? `Recurring (${transaction.frequency})` 
                : 'One-time'}
            </p>
          </div>
        </div>

        {/* Middle Row: Category, Confidence, Matches */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Category with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={isProcessing}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.G_A} hover:opacity-80 transition-opacity`}
            >
              {transaction.category}
              {onRecategorize && <ChevronDown className="w-3 h-3" />}
            </button>
            
            {showCategoryDropdown && onRecategorize && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1 min-w-32">
                {CATEGORIES.filter(c => c !== transaction.category).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      onRecategorize(transaction.id, cat)
                      setShowCategoryDropdown(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Confidence Score */}
          {transaction.confidenceScore !== null && (
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getConfidenceColor(transaction.confidenceScore)}`}>
              {transaction.confidenceScore}% Confidence
            </span>
          )}

          {/* Match Indicators */}
          {transaction.matchedInvoiceId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs">
              <Receipt className="w-3 h-3" />
              Invoice Matched
            </span>
          )}

          {transaction.matchedBillId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full text-xs">
              <FileText className="w-3 h-3" />
              Bill Matched
            </span>
          )}
        </div>

        {/* Actions Row */}
        {showActions && (onApprove || onReject || onMatchInvoice || onMatchBill) && (
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            {onApprove && (
              <button
                onClick={() => onApprove(transaction.id)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            )}

            {onReject && (
              <button
                onClick={() => onReject(transaction.id)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}

            {onMatchInvoice && transaction.amount > 0 && !transaction.matchedInvoiceId && (
              <button
                onClick={() => onMatchInvoice(transaction.id)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                Match Invoice
              </button>
            )}

            {onMatchBill && transaction.amount < 0 && !transaction.matchedBillId && (
              <button
                onClick={() => onMatchBill(transaction.id)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                Match Bill
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// List variant for showing multiple transactions
export function TransactionList({
  transactions,
  onApprove,
  onReject,
  onRecategorize,
  processingIds = new Set(),
  showActions = true
}: {
  transactions: Transaction[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onRecategorize?: (id: string, category: string) => void
  processingIds?: Set<string>
  showActions?: boolean
}) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No transactions found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map((txn) => (
        <TransactionCard
          key={txn.id}
          transaction={txn}
          onApprove={onApprove}
          onReject={onReject}
          onRecategorize={onRecategorize}
          isProcessing={processingIds.has(txn.id)}
          showActions={showActions}
        />
      ))}
    </div>
  )
}
