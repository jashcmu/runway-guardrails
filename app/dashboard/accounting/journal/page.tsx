'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import AuthGuard from '@/app/components/AuthGuard'

type JournalEntry = {
  id: string
  date: string
  description: string
  reference: string | null
  account: {
    accountCode: string
    name: string
    type: string
  }
  debit: number
  credit: number
}

export default function JournalEntriesPage() {
  return (
    <AuthGuard>
      <JournalEntriesContent />
    </AuthGuard>
  )
}

function JournalEntriesContent() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId')
  
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    // Set default dates (last 30 days)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (!companyId || !startDate || !endDate) return

    const fetchEntries = async () => {
      try {
        const url = `/api/journal?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setEntries(data.journalEntries)
        }
      } catch (error) {
        console.error('Failed to fetch journal entries:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
  }, [companyId, startDate, endDate])

  // Group entries by date and transaction
  const groupedEntries: Record<string, JournalEntry[]> = {}
  entries.forEach((entry) => {
    const key = `${entry.date}-${entry.description}`
    if (!groupedEntries[key]) {
      groupedEntries[key] = []
    }
    groupedEntries[key].push(entry)
  })

  const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0)
  const totalCredits = entries.reduce((sum, entry) => sum + entry.credit, 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">📖 Journal Entries</h1>
          <p className="mt-2 text-sm text-gray-600">
            View all double-entry bookkeeping transactions
          </p>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setTimeout(() => {
                    const end = new Date()
                    const start = new Date()
                    start.setDate(start.getDate() - 30)
                    setStartDate(start.toISOString().split('T')[0])
                    setEndDate(end.toISOString().split('T')[0])
                  }, 100)
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Reset to Last 30 Days
              </button>
            </div>
          </div>
        </div>

        {/* Balance Check */}
        {!loading && entries.length > 0 && (
          <div className={`mb-6 rounded-lg p-4 border-2 ${isBalanced ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">{isBalanced ? '✅' : '⚠️'}</span>
                <div>
                  <h3 className={`text-sm font-semibold ${isBalanced ? 'text-green-900' : 'text-red-900'}`}>
                    {isBalanced ? 'Books Balanced' : 'Books NOT Balanced!'}
                  </h3>
                  <p className={`text-xs ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                    Total Debits = Total Credits {isBalanced ? '✓' : '✗'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">
                  Debits: ₹{totalDebits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm font-medium text-gray-700">
                  Credits: ₹{totalCredits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No journal entries found for the selected period.</p>
            <p className="text-sm text-gray-400 mt-2">Add some transactions to see journal entries here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedEntries).map(([key, transactionEntries]) => {
              const firstEntry = transactionEntries[0]
              const transactionDebits = transactionEntries.reduce((sum, e) => sum + e.debit, 0)
              const transactionCredits = transactionEntries.reduce((sum, e) => sum + e.credit, 0)
              
              return (
                <div key={key} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-50 px-6 py-3 border-b border-blue-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-semibold text-blue-900">
                          {new Date(firstEntry.date).toLocaleDateString('en-IN', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                        {firstEntry.reference && (
                          <span className="ml-3 text-xs text-blue-600">
                            Ref: {firstEntry.reference}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-blue-700">
                        ₹{transactionDebits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-sm text-blue-800 mt-1">{firstEntry.description}</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Account
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Debit (₹)
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Credit (₹)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactionEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <div className="text-sm font-medium text-gray-900">
                                {entry.account.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {entry.account.accountCode} - {entry.account.type}
                              </div>
                            </td>
                            <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                              {entry.debit > 0 ? entry.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                              {entry.credit > 0 ? entry.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-6 py-3 text-sm text-gray-700">Total</td>
                          <td className="px-6 py-3 text-right text-sm text-gray-900">
                            {transactionDebits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-3 text-right text-sm text-gray-900">
                            {transactionCredits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}



