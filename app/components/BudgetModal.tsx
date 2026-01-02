'use client'

import { useState, useEffect } from 'react'
import { Category } from '@prisma/client'

type Budget = {
  id: string
  category: string
  amount: number
  startDate: string
  endDate: string
}

type BudgetModalProps = {
  isOpen: boolean
  onClose: () => void
  companyId: string
  onBudgetCreated: () => void
  editingBudget?: Budget | null
}

export default function BudgetModal({ isOpen, onClose, companyId, onBudgetCreated, editingBudget }: BudgetModalProps) {
  const [category, setCategory] = useState<Category>(Category.Marketing)
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingBudget) {
      setCategory(editingBudget.category as Category)
      setAmount(editingBudget.amount.toString())
      setStartDate(new Date(editingBudget.startDate).toISOString().split('T')[0])
      setEndDate(new Date(editingBudget.endDate).toISOString().split('T')[0])
    } else {
      // Set default dates for new budget (current month)
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setStartDate(start.toISOString().split('T')[0])
      setEndDate(end.toISOString().split('T')[0])
      setAmount('')
      setCategory(Category.Marketing)
    }
  }, [editingBudget, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = editingBudget ? `/api/budgets/${editingBudget.id}` : '/api/budgets'
      const method = editingBudget ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          category,
          amount: parseFloat(amount),
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || errorData.details || 'Failed to save budget'
        console.error('Budget creation error:', errorData)
        throw new Error(errorMessage)
      }

      onBudgetCreated()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save budget'
      console.error('Budget modal error:', err)
      setError(errorMessage)
      // Show alert for better visibility
      alert(`Error: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              {Object.values(Category).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' & ')}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter budget amount"
              min="0"
              step="1"
              required
              autoComplete="off"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : editingBudget ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

