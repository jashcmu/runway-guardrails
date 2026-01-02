'use client'

import { useState, useEffect } from 'react'
import Navigation from '@/app/components/Navigation'
import BurnTrendChart from '@/app/components/charts/BurnTrendChart'
import CategorySpendChart from '@/app/components/charts/CategorySpendChart'
import RunwayProjectionChart from '@/app/components/charts/RunwayProjectionChart'
import BudgetVsActualChart from '@/app/components/charts/BudgetVsActualChart'
import CashFlowChart from '@/app/components/charts/CashFlowChart'

type Company = {
  id: string
  name: string
  cashBalance: number
  targetMonths: number | null
  slug: string
}

type DashboardData = {
  cashBalance: number
  monthlyBurn: number
  runway: number | null
  categories: Array<{
    category: string
    budget: number
    spend: number
    percentage: number
    status: string
  }>
}

type BurnTrend = {
  months: Array<{ month: string; burn: number; transactionCount: number }>
}

export default function AnalyticsPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [trend, setTrend] = useState<BurnTrend | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (!response.ok) {
        window.location.href = '/login'
        return
      }

      const { user } = await response.json()
      if (user.companies && user.companies.length > 0) {
        const firstCompany = user.companies[0]
        setCompany(firstCompany)
        await fetchData(firstCompany.id, firstCompany.cashBalance)
      }
    } catch (error) {
      console.error('Auth error:', error)
      window.location.href = '/login'
    }
  }

  const fetchData = async (companyId: string, cashBalance: number) => {
    try {
      setLoading(true)
      const [dashboardRes, trendsRes] = await Promise.all([
        fetch(`/api/dashboard?companyId=${encodeURIComponent(companyId)}&cashBalance=${cashBalance}`),
        fetch(`/api/trends?companyId=${encodeURIComponent(companyId)}`),
      ])

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json()
        setData(dashboardData)
      }

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json()
        setTrend(trendsData)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center">Loading analytics...</div>
        </div>
      </div>
    )
  }

  if (!company || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center text-gray-500">
            {loading ? 'Loading...' : 'No company data found. Please add expenses first from the dashboard.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">📈 Visual Analytics</h1>

        {/* Burn Trend Chart */}
        {trend && trend.months.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Burn Rate Trend</h2>
            <BurnTrendChart data={trend.months} currentBurn={data.monthlyBurn} />
          </div>
        )}

        {/* Category Spending Chart */}
        {data.categories.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h2>
            <CategorySpendChart 
              data={data.categories.map(cat => ({
                category: cat.category,
                amount: cat.spend,
                percentage: cat.percentage,
              }))} 
            />
          </div>
        )}

        {/* Runway Projection Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Runway Projection</h2>
          <RunwayProjectionChart
            data={trend?.months.map(m => ({
              month: m.month,
              current: data.runway,
            })) || []}
            currentRunway={data.runway}
            cashBalance={data.cashBalance}
            monthlyBurn={data.monthlyBurn}
          />
        </div>

        {/* Budget vs Actual Chart */}
        {data.categories.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual Spending</h2>
            <BudgetVsActualChart 
              data={data.categories.map(cat => ({
                category: cat.category,
                budget: cat.budget,
                actual: cat.spend,
                percentage: cat.percentage,
                status: cat.status as 'under' | 'warning' | 'over' | 'no-budget',
              }))} 
            />
          </div>
        )}

        {/* Cash Flow Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Timeline</h2>
          <CashFlowChart
            data={trend?.months.map((m, i) => ({
              date: m.month,
              balance: data.cashBalance - (data.monthlyBurn * (trend.months.length - i)),
              outflow: m.burn,
            })) || []}
            currentBalance={data.cashBalance}
          />
        </div>
      </div>
    </div>
  )
}

