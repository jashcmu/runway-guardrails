'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import AuthGuard from '@/app/components/AuthGuard'

type TrialBalanceEntry = {
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
  balance: number
}

type TrialBalanceData = {
  entries: TrialBalanceEntry[]
  totalDebits: number
  totalCredits: number
  difference: number
  isBalanced: boolean
  asOfDate: string
}

export default function TrialBalancePage() {
  return (
    <AuthGuard>
      <TrialBalanceContent />
    </AuthGuard>
  )
}

function TrialBalanceContent() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId')
  
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return

    const fetchTrialBalance = async () => {
      try {
        const response = await fetch(`/api/reports/accounting?companyId=${companyId}&type=trial-balance`)
        if (response.ok) {
          const data = await response.json()
          setTrialBalance(data)
        }
      } catch (error) {
        console.error('Failed to fetch trial balance:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrialBalance()
  }, [companyId])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Asset': return 'text-green-800'
      case 'Liability': return 'text-red-800'
      case 'Equity': return 'text-blue-800'
      case 'Revenue': return 'text-purple-800'
      case 'Expense': return 'text-orange-800'
      default: return 'text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">⚖️ Trial Balance</h1>
          <p className="mt-2 text-sm text-gray-600">
            Verify that total debits equal total credits
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : !trialBalance ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Failed to load trial balance.</p>
          </div>
        ) : (
          <>
            {/* Balance Status */}
            <div className={`mb-6 rounded-lg p-6 border-2 ${
              trialBalance.isBalanced 
                ? 'bg-green-50 border-green-500' 
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-4xl mr-4">{trialBalance.isBalanced ? '✅' : '⚠️'}</span>
                  <div>
                    <h3 className={`text-xl font-bold ${
                      trialBalance.isBalanced ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {trialBalance.isBalanced ? 'Books Are Balanced!' : 'Books NOT Balanced'}
                    </h3>
                    <p className={`text-sm ${
                      trialBalance.isBalanced ? 'text-green-700' : 'text-red-700'
                    }`}>
                      As of {new Date(trialBalance.asOfDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    Total Debits: ₹{trialBalance.totalDebits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    Total Credits: ₹{trialBalance.totalCredits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  {!trialBalance.isBalanced && (
                    <div className="text-sm font-semibold text-red-600 mt-1">
                      Difference: ₹{Math.abs(trialBalance.difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Trial Balance Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">
                        Account Code
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">
                        Account Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider">
                        Debit (₹)
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider">
                        Credit (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trialBalance.entries.map((entry, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {entry.accountCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {entry.accountName}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getTypeColor(entry.accountType)}`}>
                          {entry.accountType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {entry.debit > 0 ? entry.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {entry.credit > 0 ? entry.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-800 text-white">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-left text-sm font-bold uppercase">
                        Total
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold">
                        ₹{trialBalance.totalDebits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold">
                        ₹{trialBalance.totalCredits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">📚 How to Read</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Assets & Expenses</strong>: Debit side increases balance</li>
                <li>• <strong>Liabilities, Equity & Revenue</strong>: Credit side increases balance</li>
                <li>• <strong>Balanced Books</strong>: Total Debits must equal Total Credits</li>
                <li>• <strong>Accounts shown</strong>: Only accounts with non-zero balances</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}



