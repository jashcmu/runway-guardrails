'use client'

import { useState } from 'react'
import { Category } from '@prisma/client'

type Transaction = {
  id: string
  amount: number
  category: Category
  description: string | null
  date: string
  currency: string
  gstRate?: number | null
  expenseType?: string
  frequency?: string | null
  nextDueDate?: string | null
}

type ExpenseTableProps = {
  transactions: Transaction[]
  onUpdate: () => void
}

export default function ExpenseTable({ transactions, onUpdate }: ExpenseTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    date: string
    description: string
    amount: number
    category: Category
  }>({
    date: '',
    description: '',
    amount: 0,
    category: 'Marketing' as Category,
  })
  const [loading, setLoading] = useState(false)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' & ')
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id)
    setEditForm({
      date: new Date(transaction.date).toISOString().split('T')[0],
      description: transaction.description || '',
      amount: transaction.amount,
      category: transaction.category,
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({
      date: '',
      description: '',
      amount: 0,
      category: 'Marketing' as Category,
    })
  }

  const handleSaveEdit = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        setEditingId(null)
        onUpdate()
      } else {
        const error = await response.json()
        alert(`Failed to update: ${error.error}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Failed to update expense')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onUpdate()
      } else {
        const error = await response.json()
        alert(`Failed to delete: ${error.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete expense')
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    'Marketing',
    'Operations',
    'Technology',
    'Hiring_Salaries',
    'Office_Rent',
    'Legal_Compliance',
    'Travel',
    'Miscellaneous',
  ]

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Expenses</h2>
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">No expenses yet</p>
          <p className="text-sm">Add your first expense above to start tracking your burn rate</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Recent Expenses</h2>
        <p className="text-sm text-gray-500 mt-1">
          Showing {transactions.length} most recent transactions
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((txn) => (
              <tr key={txn.id} className={editingId === txn.id ? 'bg-blue-50' : ''}>
                {editingId === txn.id ? (
                  // Edit mode
                  <>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        disabled={loading}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Description"
                        disabled={loading}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500">Edit on view mode</span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Category })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        disabled={loading}
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {formatCategory(cat)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                        className="block w-full text-right rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Amount"
                        min="0"
                        step="1"
                        disabled={loading}
                      />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleSaveEdit(txn.id)}
                        disabled={loading}
                        className="text-green-600 hover:text-green-900 font-medium text-sm disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={loading}
                        className="text-gray-600 hover:text-gray-900 font-medium text-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  // View mode
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(txn.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {txn.description || <span className="text-gray-400 italic">No description</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {txn.expenseType === 'one-time' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ⚡ One-Time
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          🔄 {txn.frequency ? txn.frequency.charAt(0).toUpperCase() + txn.frequency.slice(1) : 'Recurring'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatCategory(txn.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                      <button
                        onClick={() => handleEdit(txn)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-900 font-medium disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(txn.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

