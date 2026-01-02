'use client'

import { useState, useEffect } from 'react'
import Navigation from '@/app/components/Navigation'
import RunwayWidget from '@/app/components/RunwayWidget'
import QuickActions from '@/app/components/QuickActions'
import CashFlowPrediction from '@/app/components/CashFlowPrediction'
import FundraisingCalculator from '@/app/components/FundraisingCalculator'
import BenchmarkWidget from '@/app/components/BenchmarkWidget'
import AIChat from '@/app/components/AIChat'
import ExpenseTable from '@/app/components/ExpenseTable'
import { Category } from '@prisma/client'

type Company = {
  id: string
  name: string
  slug: string
  cashBalance: number
  targetMonths: number | null
}

type CurrentUser = {
  id: string
  email: string
  name: string
  companies: Company[]
}

type Transaction = {
  id: string
  amount: number
  category: Category
  description: string | null
  date: string
  currency: string
}

export default function ModernDashboard() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showUploadStatement, setShowUploadStatement] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      fetchDashboard()
      fetchTransactions()
    }
  }, [selectedCompany])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      
      if (!response.ok) {
        window.location.href = '/login'
        return
      }

      const data = await response.json()
      setUser(data.user)
      
      if (data.user.companies && data.user.companies.length > 0) {
        setSelectedCompany(data.user.companies[0])
      }
    } catch (error) {
      console.error('Auth check error:', error)
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboard = async () => {
    if (!selectedCompany) return

    try {
      const res = await fetch(`/api/dashboard?companySlug=${selectedCompany.slug}`)
      const data = await res.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    }
  }

  const fetchTransactions = async () => {
    if (!selectedCompany) return

    try {
      const res = await fetch(`/api/transactions?companyId=${selectedCompany.id}`)
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!selectedCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Company Found</h2>
          <p className="text-gray-600 mb-6">Create a company to get started</p>
          <button
            onClick={() => window.location.href = '/onboarding'}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Create Company
          </button>
        </div>
      </div>
    )
  }

  const runway = dashboardData?.runway || null
  const cashBalance = selectedCompany.cashBalance || 0
  const monthlyBurn = dashboardData?.monthlyBurn || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-gray-600">
            Here's what's happening with {selectedCompany.name}
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Runway Widget - Takes 2 columns */}
          <div className="lg:col-span-2">
            <RunwayWidget
              runway={runway}
              cashBalance={cashBalance}
              monthlyBurn={monthlyBurn}
              targetMonths={selectedCompany.targetMonths}
            />
          </div>

          {/* Quick Actions */}
          <div>
            <QuickActions
              onAddExpense={() => setShowAddExpense(true)}
              onUploadStatement={() => setShowUploadStatement(true)}
              onInviteInvestor={() => alert('Investor invite modal - implement next')}
              onViewBenchmarks={() => {}}
            />
          </div>
        </div>

        {/* Cash Flow Prediction & Fundraising */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CashFlowPrediction companyId={selectedCompany.id} />
          <FundraisingCalculator
            companyId={selectedCompany.id}
            currentBurn={monthlyBurn}
            currentBalance={cashBalance}
          />
        </div>

        {/* Benchmarks */}
        <div className="mb-6">
          <BenchmarkWidget companyId={selectedCompany.id} />
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">📝 Recent Transactions</h3>
            <button
              onClick={() => window.location.href = '/dashboard/transactions'}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View All →
            </button>
          </div>
          
          {transactions.length > 0 ? (
            <ExpenseTable
              transactions={transactions.slice(0, 10)}
              onUpdate={() => fetchTransactions()}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No transactions yet</p>
              <button
                onClick={() => setShowAddExpense(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Your First Transaction
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat - Floating */}
      <AIChat companyId={selectedCompany.id} />

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Add Expense</h3>
              <button
                onClick={() => setShowAddExpense(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            {/* Add your expense form here */}
            <p className="text-gray-600 text-sm mb-4">
              Expense form will go here - use existing ExpenseTable component logic
            </p>
            <button
              onClick={() => setShowAddExpense(false)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Upload Statement Modal */}
      {showUploadStatement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Upload Bank Statement</h3>
              <button
                onClick={() => setShowUploadStatement(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            {/* Add your upload form here */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-600 mb-2">Drag & drop your PDF or CSV</p>
              <p className="text-sm text-gray-500 mb-4">or click to browse</p>
              <input
                type="file"
                accept=".pdf,.csv"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
              >
                Choose File
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



