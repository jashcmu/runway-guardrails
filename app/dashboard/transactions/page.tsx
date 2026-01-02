'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/app/components/Navigation'

type Transaction = {
  id: string
  amount: number
  category: string
  description: string | null
  date: string
}

export default function TransactionsPage() {
  const [companyId, setCompanyId] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompanyAndTransactions()
  }, [])

  const fetchCompanyAndTransactions = async () => {
    try {
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) {
        window.location.href = '/login'
        return
      }
      const meData = await meRes.json()
      
      const userCompanyId = meData.user.companies && meData.user.companies.length > 0 
        ? meData.user.companies[0].id 
        : null
      
      if (!userCompanyId) {
        window.location.href = '/onboarding'
        return
      }
      
      setCompanyId(userCompanyId)
      await fetchTransactions(userCompanyId)
    } catch (err) {
      console.error('Failed to fetch company:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async (cId: string) => {
    try {
      const response = await fetch(`/api/transactions?companyId=${encodeURIComponent(cId)}`)
      if (response.ok) {
        const result = await response.json()
        setTransactions(result.transactions || [])
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">💳 Transactions</h1>

        {loading ? (
          <div className="text-center py-8">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">💳</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Transactions Yet</h2>
            <p className="text-gray-600 mb-6">Import bank statements or add transactions manually</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(txn.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {txn.description || 'No description'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCategory(txn.category)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

