'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import AuthGuard from '@/app/components/AuthGuard'

type ReconciliationHistory = {
  id: string
  statementDate: string
  statementBalance: number
  bookBalance: number
  difference: number
  isReconciled: boolean
  bankAccount: {
    name: string
    accountCode: string
  }
  createdAt: string
}

export default function ReconciliationPage() {
  return (
    <AuthGuard>
      <ReconciliationContent />
    </AuthGuard>
  )
}

function ReconciliationContent() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId')
  
  const [history, setHistory] = useState<ReconciliationHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return

    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/reconciliation/history?companyId=${companyId}`)
        if (response.ok) {
          const data = await response.json()
          setHistory(data.history || [])
        }
      } catch (error) {
        console.error('Failed to fetch reconciliation history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [companyId])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🔄 Bank Reconciliation</h1>
          <p className="mt-2 text-sm text-gray-600">
            Match bank statements with your accounting records
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📥 Start Reconciliation</h2>
              <p className="text-blue-100 mb-4">
                Upload your bank statement (CSV/PDF) to automatically match transactions
              </p>
              <button
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md"
                onClick={() => {
                  // TODO: Open upload modal
                  alert('Reconciliation upload feature - Coming soon! Upload feature exists in the Bank Upload section.')
                }}
              >
                📤 Upload Bank Statement
              </button>
            </div>
            <div className="hidden md:block text-6xl">
              🏦
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 AI-Powered Reconciliation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <h4 className="font-semibold text-gray-900 mb-1">1. Upload Statement</h4>
              <p className="text-sm text-gray-600">
                Upload your bank statement in CSV or PDF format
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🔍</div>
              <h4 className="font-semibold text-gray-900 mb-1">2. AI Matches</h4>
              <p className="text-sm text-gray-600">
                Our AI automatically matches transactions with your records
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <h4 className="font-semibold text-gray-900 mb-1">3. Review & Approve</h4>
              <p className="text-sm text-gray-600">
                Review matched transactions and approve reconciliation
              </p>
            </div>
          </div>
        </div>

        {/* Reconciliation History */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">📊 Reconciliation History</h3>
          </div>
          
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No reconciliation history yet.</p>
              <p className="text-sm text-gray-400 mt-2">Upload a bank statement to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Statement Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Bank Account
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Statement Balance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Book Balance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Difference
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.statementDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{record.bankAccount.name}</div>
                        <div className="text-xs text-gray-500">{record.bankAccount.accountCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        ₹{record.statementBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        ₹{record.bookBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                        Math.abs(record.difference) < 0.01 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ₹{record.difference.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.isReconciled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.isReconciled ? '✓ Reconciled' : '✗ Not Reconciled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Pro Tip</h3>
          <p className="text-sm text-blue-800">
            Reconcile your bank statements monthly to ensure accuracy. Our AI can detect duplicate payments, 
            unusual transactions, and help you maintain clean books.
          </p>
        </div>
      </div>
    </div>
  )
}



