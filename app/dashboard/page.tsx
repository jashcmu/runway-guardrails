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
  gstRate?: number | null
}

type Alert = {
  id: string
  message: string
  severity: string
  isRead: boolean
  createdAt: string
}

export default function ModernDashboard() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unifiedStats, setUnifiedStats] = useState<any>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showUploadStatement, setShowUploadStatement] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [burnMetrics, setBurnMetrics] = useState<any>(null)

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'SaaS' as Category,
    description: '',
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      fetchDashboard()
      fetchTransactions()
      fetchAlerts()
      fetchUnifiedStats()
      fetchBurnMetrics()
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
      
      // Check if user has companies
      if (!data.user.companies || data.user.companies.length === 0) {
        // Redirect to onboarding if no company
        window.location.href = '/onboarding'
        return
      }
      
      setSelectedCompany(data.user.companies[0])
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

  const fetchAlerts = async () => {
    if (!selectedCompany) return

    try {
      const res = await fetch(`/api/alerts?companyId=${selectedCompany.id}`)
      const data = await res.json()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
  }

  const fetchUnifiedStats = async () => {
    if (!selectedCompany) return

    try {
      const res = await fetch(`/api/dashboard/unified?companyId=${selectedCompany.id}`)
      const data = await res.json()
      setUnifiedStats(data)
    } catch (error) {
      console.error('Failed to fetch unified stats:', error)
    }
  }

  const fetchBurnMetrics = async () => {
    if (!selectedCompany) return

    try {
      const res = await fetch(`/api/burn-rate?companyId=${selectedCompany.id}`)
      const data = await res.json()
      if (data.success) {
        setBurnMetrics(data)
      }
    } catch (error) {
      console.error('Failed to fetch burn metrics:', error)
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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCompany || !expenseForm.amount) return

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category,
          description: expenseForm.description,
          date: new Date(expenseForm.date),
        }),
      })

      if (res.ok) {
        setShowAddExpense(false)
        setExpenseForm({
          amount: '',
          category: 'SaaS',
          description: '',
          date: new Date().toISOString().split('T')[0],
        })
        fetchTransactions()
        fetchDashboard()
      }
    } catch (error) {
      console.error('Failed to add expense:', error)
    }
  }

  const handleFileUpload = async () => {
    if (!uploadFile || !selectedCompany) {
      alert('Please select a file and ensure you have a company selected')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('companyId', selectedCompany.id)

    try {
      const res = await fetch('/api/banks', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        // Show detailed success message
        const summary = data.summary
        const message = `✅ Bank Statement Processed Successfully!

📊 SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Transactions Created: ${summary.transactionsCreated}
📄 Bills Marked Paid: ${summary.billsMarkedPaid}
💵 Invoices Received: ${summary.invoicesMarkedPaid}
💸 Cash Change: ₹${summary.cashBalanceChange.toLocaleString()}
🏦 New Balance: ₹${summary.newCashBalance.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All transactions have been auto-categorized and your runway has been recalculated!`

        alert(message)
        setShowUploadStatement(false)
        setUploadFile(null)
        fetchTransactions()
        fetchDashboard()
        fetchUnifiedStats()
        fetchBurnMetrics()
      } else {
        // Show error message
        alert(`❌ Upload Failed\n\n${data.error}\n\n${data.details || data.hint || ''}`)
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
      alert(`❌ Upload Failed\n\nError: ${error instanceof Error ? error.message : 'Network error or server unavailable'}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4"
            style={{ border: '2px solid var(--border)', borderTopColor: 'var(--foreground)' }}
          />
          <p style={{ color: 'var(--foreground-secondary)' }}>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!selectedCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>No Company Found</h2>
          <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>Create a company to get started</p>
          <button
            onClick={() => window.location.href = '/onboarding'}
            className="px-6 py-3 rounded-lg font-medium"
            style={{ background: 'var(--foreground)', color: 'var(--background)' }}
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
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            Welcome back, {user?.name}!
          </h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            Here's what's happening with {selectedCompany.name}
          </p>
        </div>

        {/* Alerts Banner */}
        {alerts.filter(a => !a.isRead && a.severity === 'high').length > 0 && (
          <div 
            className="mb-6 p-4 rounded-xl"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-4" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold" style={{ color: 'rgb(239, 68, 68)' }}>
                  {alerts.filter(a => !a.isRead && a.severity === 'high').length} Critical Alert(s)
                </h4>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                  {alerts.filter(a => !a.isRead && a.severity === 'high')[0]?.message}
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/dashboard/alerts'}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgb(239, 68, 68)', color: 'white' }}
              >
                View All
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats Grid - New Unified Platform Features */}
        {unifiedStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {/* Pending Bills */}
            <div 
              className="rounded-xl p-6 hover-lift cursor-pointer"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              onClick={() => window.location.href = '/dashboard/bills'}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--foreground-tertiary)' }}>Pending Bills</p>
                  <p className="text-3xl font-semibold" style={{ color: 'rgb(249, 115, 22)' }}>{unifiedStats.pendingBills || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
                  <svg className="w-5 h-5" style={{ color: 'rgb(249, 115, 22)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: 'rgb(249, 115, 22)' }}>
                Review Bills →
              </p>
            </div>

            {/* Pending Invoices */}
            <div 
              className="rounded-xl p-6 hover-lift cursor-pointer"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              onClick={() => window.location.href = '/dashboard/invoices'}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--foreground-tertiary)' }}>Pending Invoices</p>
                  <p className="text-3xl font-semibold" style={{ color: 'rgb(59, 130, 246)' }}>{unifiedStats.pendingInvoices || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                  <svg className="w-5 h-5" style={{ color: 'rgb(59, 130, 246)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: 'rgb(59, 130, 246)' }}>
                View Invoices →
              </p>
            </div>

            {/* Subscriptions Renewing */}
            <div 
              className="rounded-xl p-6 hover-lift cursor-pointer"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              onClick={() => window.location.href = '/dashboard/subscriptions'}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--foreground-tertiary)' }}>Renewing Soon</p>
                  <p className="text-3xl font-semibold" style={{ color: 'rgb(168, 85, 247)' }}>{unifiedStats.subscriptionsRenewing || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                  <svg className="w-5 h-5" style={{ color: 'rgb(168, 85, 247)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: 'rgb(168, 85, 247)' }}>
                Manage Subscriptions →
              </p>
            </div>

            {/* Overdue Payments */}
            <div 
              className="rounded-xl p-6 hover-lift cursor-pointer"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              onClick={() => window.location.href = '/dashboard/payments'}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--foreground-tertiary)' }}>Overdue Payments</p>
                  <p className="text-3xl font-semibold" style={{ color: 'rgb(239, 68, 68)' }}>{unifiedStats.overduePayments || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                  <svg className="w-5 h-5" style={{ color: 'rgb(239, 68, 68)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: 'rgb(239, 68, 68)' }}>
                View Overdue →
              </p>
            </div>
          </div>
        )}

        {/* Burn Rate Metrics */}
        {burnMetrics && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Burn Rate Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Burn Rate */}
              <div 
                className="rounded-xl p-6"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}
              >
                <p className="text-sm opacity-70 mb-1">Gross Burn Rate</p>
                <p className="text-2xl font-semibold mb-2">{burnMetrics.metrics.grossBurnRateFormatted}</p>
                <p className="text-xs opacity-60">{burnMetrics.explanation.grossBurnRate}</p>
              </div>

              {/* Net Burn Rate */}
              <div 
                className="rounded-xl p-6"
                style={{ 
                  background: burnMetrics.metrics.profitability ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)', 
                  color: 'white' 
                }}
              >
                <p className="text-sm opacity-80 mb-1">Net Burn Rate</p>
                <p className="text-2xl font-semibold mb-2">{burnMetrics.metrics.netBurnRateFormatted}</p>
                <p className="text-xs opacity-70">{burnMetrics.explanation.netBurnRate}</p>
                {burnMetrics.metrics.profitability && (
                  <p className="text-xs mt-2 font-medium">✓ Profitable</p>
                )}
              </div>

              {/* Monthly Revenue */}
              <div 
                className="rounded-xl p-6"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <p className="text-sm mb-1" style={{ color: 'var(--foreground-tertiary)' }}>Monthly Revenue</p>
                <p className="text-2xl font-semibold mb-2" style={{ color: 'rgb(34, 197, 94)' }}>{burnMetrics.metrics.monthlyRevenueFormatted}</p>
                <p className="text-xs" style={{ color: 'var(--foreground-tertiary)' }}>Money coming in per month</p>
              </div>

              {/* Monthly Expenses */}
              <div 
                className="rounded-xl p-6"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <p className="text-sm mb-1" style={{ color: 'var(--foreground-tertiary)' }}>Monthly Expenses</p>
                <p className="text-2xl font-semibold mb-2" style={{ color: 'rgb(239, 68, 68)' }}>{burnMetrics.metrics.monthlyExpensesFormatted}</p>
                <p className="text-xs" style={{ color: 'var(--foreground-tertiary)' }}>Money going out per month</p>
                {burnMetrics.trend.trend === 'increasing' && (
                  <p className="text-xs mt-2" style={{ color: 'rgb(239, 68, 68)' }}>↑ +{burnMetrics.trend.percentageChange}% vs last month</p>
                )}
                {burnMetrics.trend.trend === 'decreasing' && (
                  <p className="text-xs mt-2" style={{ color: 'rgb(34, 197, 94)' }}>↓ {burnMetrics.trend.percentageChange}% vs last month</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Runway Widget - Takes 2 columns */}
          <div className="lg:col-span-2">
            <RunwayWidget
              runway={runway}
              cashBalance={cashBalance}
              monthlyBurn={burnMetrics?.metrics.netBurnRate || monthlyBurn}
              targetMonths={selectedCompany.targetMonths}
            />
          </div>

          {/* Quick Actions */}
          <div>
            <QuickActions
              onAddExpense={() => setShowAddExpense(true)}
              onUploadStatement={() => setShowUploadStatement(true)}
              onInviteInvestor={() => window.location.href = '/dashboard/settings'}
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

        {/* All-in-One Platform Features */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📦 All-in-One Financial Platform</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Accounts Payable */}
            <div 
              onClick={() => window.location.href = '/dashboard/bills'}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <div className="bg-orange-100 p-3 rounded-lg group-hover:bg-orange-200 transition-colors">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Accounts Payable</h3>
                  <p className="text-sm text-gray-600">Bill management & payments</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pending Bills</span>
                  <span className="font-semibold text-gray-900">{unifiedStats?.pendingBills || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active Vendors</span>
                  <span className="font-semibold text-gray-900">{unifiedStats?.activeVendors || 0}</span>
                </div>
              </div>
            </div>

            {/* Accounts Receivable */}
            <div 
              onClick={() => window.location.href = '/dashboard/invoices'}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Accounts Receivable</h3>
                  <p className="text-sm text-gray-600">Invoice & revenue tracking</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Outstanding</span>
                  <span className="font-semibold text-gray-900">{unifiedStats?.pendingInvoices || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Revenue</span>
                  <span className="font-semibold text-gray-900">₹{((unifiedStats?.totalRevenue || 0) / 100000).toFixed(1)}L</span>
                </div>
              </div>
            </div>

            {/* Subscriptions */}
            <div 
              onClick={() => window.location.href = '/dashboard/subscriptions'}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Subscriptions</h3>
                  <p className="text-sm text-gray-600">Recurring revenue tracking</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Renewing Soon</span>
                  <span className="font-semibold text-gray-900">{unifiedStats?.subscriptionsRenewing || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active Customers</span>
                  <span className="font-semibold text-gray-900">{unifiedStats?.activeCustomers || 0}</span>
                </div>
              </div>
            </div>

            {/* Compliance */}
            <div 
              onClick={() => window.location.href = '/dashboard/compliance'}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Compliance</h3>
                  <p className="text-sm text-gray-600">GST, TDS, PF/ESI</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST Due</span>
                  <span className="font-semibold text-yellow-600">15 days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <span className="font-semibold text-green-600">Up to date</span>
                </div>
              </div>
            </div>

            {/* Purchase Orders */}
            <div 
              onClick={() => window.location.href = '/dashboard/purchase-orders'}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 p-3 rounded-lg group-hover:bg-indigo-200 transition-colors">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Purchase Orders</h3>
                  <p className="text-sm text-gray-600">Procurement workflow</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Open POs</span>
                  <span className="font-semibold text-gray-900">5</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">In Transit</span>
                  <span className="font-semibold text-gray-900">2</span>
                </div>
              </div>
            </div>

            {/* Reports */}
            <div 
              onClick={() => window.location.href = '/dashboard/reports'}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <div className="bg-pink-100 p-3 rounded-lg group-hover:bg-pink-200 transition-colors">
                  <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Reports</h3>
                  <p className="text-sm text-gray-600">20+ comprehensive reports</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Financial</span>
                  <span className="font-semibold text-gray-900">5 types</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Compliance</span>
                  <span className="font-semibold text-gray-900">5 types</span>
                </div>
              </div>
            </div>
          </div>
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
              onUpdate={() => {
                fetchTransactions()
                fetchDashboard()
              }}
            />
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
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
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="5000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as Category })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Hiring">Hiring & Salaries</option>
                  <option value="Marketing">Marketing</option>
                  <option value="SaaS">SaaS Tools</option>
                  <option value="Cloud">Cloud Services</option>
                  <option value="G_A">General & Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="AWS hosting fees"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                Add Expense
              </button>
            </form>
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
                onClick={() => {
                  setShowUploadStatement(false)
                  setUploadFile(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <div className="text-4xl mb-4">📄</div>
                <p className="text-gray-600 mb-2">
                  {uploadFile ? uploadFile.name : 'Drag & drop your PDF or CSV'}
                </p>
                <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                <input
                  type="file"
                  accept=".pdf,.csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
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

              {uploadFile && (
                <button
                  onClick={handleFileUpload}
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload & Process'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
