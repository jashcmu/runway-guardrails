'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import AuthGuard from '@/app/components/AuthGuard'

type Account = {
  id: string
  accountCode: string
  name: string
  type: string
  subtype: string | null
  category: string | null
  balance: number
  isActive: boolean
  accountGroup: string | null
  isGSTApplicable: boolean
}

export default function ChartOfAccountsPage() {
  return (
    <AuthGuard>
      <ChartOfAccountsContent />
    </AuthGuard>
  )
}

function ChartOfAccountsContent() {
  const searchParams = useSearchParams()
  const urlCompanyId = searchParams.get('companyId')
  
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [creatingAccounts, setCreatingAccounts] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  // Fetch user and get companyId from session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
          // Use URL companyId if available, otherwise use first company from user
          const activeCompanyId = urlCompanyId || data.user.companies[0]?.id
          setCompanyId(activeCompanyId)
          console.log('✓ CompanyId set to:', activeCompanyId)
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      }
    }
    fetchUser()
  }, [urlCompanyId])

  useEffect(() => {
    if (!companyId) return

    const fetchAccounts = async () => {
      try {
        const url = filter === 'all' 
          ? `/api/accounts?companyId=${companyId}`
          : `/api/accounts?companyId=${companyId}&type=${filter}`
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setAccounts(data.accounts || [])
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  }, [companyId, filter])

  const handleCreateDefaultAccounts = async () => {
    console.log('🎯 Button clicked! CompanyId:', companyId, 'Creating accounts:', creatingAccounts)
    
    if (!companyId) {
      alert('❌ No company ID found. Please make sure you are logged in.')
      return
    }
    
    if (creatingAccounts) {
      console.log('Already creating accounts, skipping...')
      return
    }
    
    setCreatingAccounts(true)
    console.log('Making POST request to /api/accounts with companyId:', companyId)
    
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      
      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)
      
      if (response.ok) {
        alert(`✅ Successfully created ${data.count || 0} default accounts!`)
        // Refresh accounts
        setLoading(true)
        const refreshResponse = await fetch(`/api/accounts?companyId=${companyId}`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          setAccounts(refreshData.accounts || [])
          console.log('Accounts refreshed, count:', refreshData.accounts?.length)
        }
      } else {
        alert(`❌ Failed to create accounts: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating default accounts:', error)
      alert('❌ An error occurred while creating default accounts')
    } finally {
      setCreatingAccounts(false)
      setLoading(false)
    }
  }

  const handleSyncAccounting = async () => {
    if (!companyId) {
      alert('❌ No company ID found. Please make sure you are logged in.')
      return
    }
    
    if (syncing) {
      return
    }
    
    const confirmed = confirm(
      '🔄 This will create journal entries for all existing transactions that don\'t have them yet.\n\n' +
      'This is safe to run multiple times - it only processes transactions without journal entries.\n\n' +
      'Continue?'
    )
    
    if (!confirmed) return
    
    setSyncing(true)
    console.log('🔄 Starting accounting sync for companyId:', companyId)
    
    try {
      const response = await fetch('/api/accounting/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      
      const data = await response.json()
      console.log('Sync response:', data)
      
      if (response.ok) {
        const stats = data.stats
        alert(
          `✅ Accounting Sync Complete!\n\n` +
          `Total Transactions: ${stats.totalTransactions}\n` +
          `Already Synced: ${stats.alreadySynced}\n` +
          `Newly Synced: ${stats.newlySynced}\n` +
          `Errors: ${stats.errors}\n\n` +
          `Your Chart of Accounts has been updated!`
        )
        
        // Refresh accounts to show updated balances
        setLoading(true)
        const refreshResponse = await fetch(`/api/accounts?companyId=${companyId}`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          setAccounts(refreshData.accounts || [])
          console.log('✅ Accounts refreshed after sync')
        }
      } else {
        alert(`❌ Sync failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Error syncing accounting:', error)
      alert('❌ An error occurred during sync')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Asset': return 'bg-green-100 text-green-800'
      case 'Liability': return 'bg-red-100 text-red-800'
      case 'Equity': return 'bg-blue-100 text-blue-800'
      case 'Revenue': return 'bg-purple-100 text-purple-800'
      case 'Expense': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = []
    }
    acc[account.type].push(account)
    return acc
  }, {} as Record<string, Account[]>)

  const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">📚 Chart of Accounts</h1>
          <p className="mt-2 text-sm text-gray-600">
            View and manage your company's account structure
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  filter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Accounts ({accounts.length})
              </button>
              {accountTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filter === type 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type} ({groupedAccounts[type]?.length || 0})
                </button>
              ))}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateDefaultAccounts}
                disabled={creatingAccounts}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
              >
                {creatingAccounts ? '⏳ Creating...' : accounts.length === 0 ? '🎯 Create Default Accounts' : '🔄 Reset & Recreate Accounts'}
              </button>
              
              <button
                onClick={handleSyncAccounting}
                disabled={syncing || accounts.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
                title="Create journal entries for all existing transactions"
              >
                {syncing ? '⏳ Syncing...' : '🔄 Sync Accounting'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {accountTypes.map((type) => {
              const typeAccounts = groupedAccounts[type] || []
              if (filter !== 'all' && filter !== type) return null
              if (typeAccounts.length === 0) return null

              const totalBalance = typeAccounts.reduce((sum, acc) => sum + acc.balance, 0)

              return (
                <div key={type} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className={`px-6 py-4 ${getTypeColor(type)} border-b`}>
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold">{type}</h2>
                      <span className="text-sm font-medium">
                        Total: ₹{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Account Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subtype
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            GST
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {typeAccounts.map((account) => (
                          <tr key={account.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                              {account.accountCode}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {account.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {account.subtype || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {account.category || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                              ₹{account.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {account.isGSTApplicable ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  No
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {!loading && accounts.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">📊 Account Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {accountTypes.map((type) => {
                const typeAccounts = groupedAccounts[type] || []
                const total = typeAccounts.reduce((sum, acc) => sum + acc.balance, 0)
                return (
                  <div key={type} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">{type}</div>
                    <div className="text-lg font-bold text-gray-900">
                      ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {typeAccounts.length} accounts
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

