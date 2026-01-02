'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import BudgetModal from '@/app/components/BudgetModal'

type Budget = {
  id: string
  category: string
  amount: number
  startDate: string
  endDate: string
  createdAt: string
}

export default function BudgetsPage() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId') || ''
  
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (companyId) {
      fetchBudgets()
    }
  }, [companyId])

  const fetchBudgets = async () => {
    if (!companyId) return
    try {
      setLoading(true)
      const response = await fetch(`/api/budgets?companyId=${encodeURIComponent(companyId)}`)
      if (response.ok) {
        const result = await response.json()
        setBudgets(result.budgets || [])
      }
    } catch (err) {
      console.error('Failed to fetch budgets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return
    
    try {
      const response = await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchBudgets()
      } else {
        alert('Failed to delete budget')
      }
    } catch (err) {
      alert('Error deleting budget')
    }
  }

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

  if (!companyId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center text-gray-500">
            Please provide company ID in URL
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">💰 Budget Management</h1>
          <button
            onClick={() => {
              setEditingBudget(null)
              setShowModal(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            + Create Budget
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Budgets Yet</h2>
            <p className="text-gray-600 mb-6">Create your first budget to start tracking spending</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Create Budget
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgets.map((budget) => (
                  <tr key={budget.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCategory(budget.category)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(budget.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(budget.startDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(budget.endDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingBudget(budget)
                            setShowModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(budget.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <BudgetModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setEditingBudget(null)
          }}
          companyId={companyId}
          onBudgetCreated={() => {
            fetchBudgets()
          }}
          editingBudget={editingBudget}
        />
      </div>
    </div>
  )
}

