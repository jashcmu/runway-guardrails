'use client'

import { useEffect, useState } from 'react'

type InvestorMetrics = {
  cashBalance: number
  netBurnRate: number
  grossBurn: number
  runway: number | null
  cashCoverageRatio: number | null
  burnMultiple: number | null
  burnMultipleNote?: string
  capitalEfficiency: number | null
  capitalEfficiencyNote?: string
  quickRatio: number | null
  quickRatioNote?: string
  monthlyBurnTrend: Array<{ month: string; burn: number; transactions: number }>
  burnAcceleration: number
  currentMonthBurn: number
  previousMonthBurn: number
  daysOfCash: number | null
  cashDepletionDate: string | null
  efficiencyScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
}

type InvestorMetricsProps = {
  companyId: string
}

export default function InvestorMetrics({ companyId }: InvestorMetricsProps) {
  const [metrics, setMetrics] = useState<InvestorMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [companyId])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/metrics?companyId=${encodeURIComponent(companyId)}`)
      if (response.ok) {
        const result = await response.json()
        setMetrics(result.metrics)
      }
    } catch (err) {
      console.error('Failed to fetch investor metrics:', err)
    } finally {
      setLoading(false)
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

  const getRiskBadge = (riskLevel: string) => {
    const styles = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[riskLevel as keyof typeof styles]}`}>
        {riskLevel.toUpperCase()}
      </span>
    )
  }

  const getEfficiencyColor = (score: number) => {
    if (score >= 70) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getTrendIcon = (acceleration: number) => {
    if (acceleration > 10) return '📈'
    if (acceleration < -10) return '📉'
    return '➡️'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">💼 Investor Metrics</h2>
        <div className="text-center text-gray-500">Loading metrics...</div>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Runway */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Runway</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.runway !== null ? `${metrics.runway.toFixed(1)} months` : '∞'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.daysOfCash !== null ? `${metrics.daysOfCash} days` : 'No burn'}
              </p>
            </div>
            <div>
              {getRiskBadge(metrics.riskLevel)}
            </div>
          </div>
        </div>

        {/* Net Burn Rate */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <p className="text-sm font-medium text-gray-500">Monthly Burn</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(metrics.netBurnRate)}
          </p>
          <div className="flex items-center mt-1">
            <span className="text-xs text-gray-500">
              {getTrendIcon(metrics.burnAcceleration)} {Math.abs(metrics.burnAcceleration).toFixed(1)}% vs last month
            </span>
          </div>
        </div>

        {/* Efficiency Score */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500">Efficiency Score</p>
          <p className={`text-2xl font-bold mt-1 ${getEfficiencyColor(metrics.efficiencyScore)}`}>
            {metrics.efficiencyScore}/100
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.efficiencyScore >= 70 ? 'Excellent' : metrics.efficiencyScore >= 50 ? 'Good' : 'Needs Improvement'}
          </p>
        </div>

        {/* Cash Coverage */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <p className="text-sm font-medium text-gray-500">Cash Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(metrics.cashBalance)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.cashCoverageRatio !== null 
              ? `${metrics.cashCoverageRatio.toFixed(1)}x monthly burn` 
              : 'No burn yet'}
          </p>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">📊 Advanced Metrics</h3>
          <p className="text-sm text-gray-500 mt-1">Key indicators for investors and strategic planning</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Burn Multiple */}
            <div>
              <p className="text-sm font-medium text-gray-700">Burn Multiple</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {metrics.burnMultiple !== null ? metrics.burnMultiple.toFixed(2) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.burnMultipleNote || 'Net burn / Net new ARR'}
              </p>
            </div>

            {/* Capital Efficiency */}
            <div>
              <p className="text-sm font-medium text-gray-700">Capital Efficiency</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {metrics.capitalEfficiency !== null ? `${(metrics.capitalEfficiency * 100).toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.capitalEfficiencyNote || 'ARR / Total raised'}
              </p>
            </div>

            {/* Quick Ratio */}
            <div>
              <p className="text-sm font-medium text-gray-700">Quick Ratio</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {metrics.quickRatio !== null ? metrics.quickRatio.toFixed(2) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.quickRatioNote || 'New MRR / Churned MRR'}
              </p>
            </div>

            {/* Gross Burn */}
            <div>
              <p className="text-sm font-medium text-gray-700">Gross Burn</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {formatCurrency(metrics.grossBurn)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total monthly expenses</p>
            </div>

            {/* Cash Depletion Date */}
            <div>
              <p className="text-sm font-medium text-gray-700">Cash Depletion Date</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {metrics.cashDepletionDate 
                  ? new Date(metrics.cashDepletionDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                  : 'None'}
              </p>
              <p className="text-xs text-gray-500 mt-1">At current burn rate</p>
            </div>

            {/* Burn Acceleration */}
            <div>
              <p className="text-sm font-medium text-gray-700">Burn Acceleration</p>
              <p className={`text-lg font-semibold mt-1 ${metrics.burnAcceleration > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.burnAcceleration > 0 ? '+' : ''}{metrics.burnAcceleration.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Month-over-month change</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 AI Recommendations</h3>
          <div className="space-y-3">
            {metrics.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 bg-white bg-opacity-60 rounded-lg p-3">
                <span className="text-lg flex-shrink-0">
                  {rec.includes('URGENT') ? '🚨' : rec.includes('✅') ? '✅' : '💡'}
                </span>
                <p className="text-sm text-gray-800">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

