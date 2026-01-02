'use client'

import { useState, useEffect } from 'react'

type HealthScore = {
  overall: number
  breakdown: {
    liquidity: number
    profitability: number
    efficiency: number
    growth: number
  }
  recommendations: string[]
  alerts: string[]
  trend: 'improving' | 'stable' | 'declining'
}

export default function FinancialHealthWidget({ companyId }: { companyId: string }) {
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return

    const fetchHealthScore = async () => {
      try {
        const response = await fetch(`/api/health-score?companyId=${companyId}`)
        if (response.ok) {
          const data = await response.json()
          setHealthScore(data.healthScore)
        }
      } catch (error) {
        console.error('Failed to fetch health score:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHealthScore()
  }, [companyId])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!healthScore) return null

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    if (score >= 40) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getScoreBorderColor = (score: number) => {
    if (score >= 80) return 'border-green-500'
    if (score >= 60) return 'border-yellow-500'
    if (score >= 40) return 'border-orange-500'
    return 'border-red-500'
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return '📈'
    if (trend === 'declining') return '📉'
    return '➡️'
  }

  const getTrendColor = (trend: string) => {
    if (trend === 'improving') return 'text-green-600'
    if (trend === 'declining') return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className={`bg-gradient-to-br from-white to-blue-50 rounded-lg shadow-lg border-2 ${getScoreBorderColor(healthScore.overall)} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">💪 Financial Health Score</h2>
        <span className={`text-sm font-medium ${getTrendColor(healthScore.trend)}`}>
          {getTrendIcon(healthScore.trend)} {healthScore.trend}
        </span>
      </div>

      {/* Overall Score */}
      <div className="flex items-center justify-center mb-6">
        <div className={`relative w-40 h-40 rounded-full ${getScoreBgColor(healthScore.overall)} flex items-center justify-center border-4 ${getScoreBorderColor(healthScore.overall)}`}>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(healthScore.overall)}`}>
              {healthScore.overall}
            </div>
            <div className="text-sm text-gray-600">out of 100</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">💧 Liquidity</div>
          <div className={`text-2xl font-bold ${getScoreColor(healthScore.breakdown.liquidity)}`}>
            {healthScore.breakdown.liquidity}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">💰 Profitability</div>
          <div className={`text-2xl font-bold ${getScoreColor(healthScore.breakdown.profitability)}`}>
            {healthScore.breakdown.profitability}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">⚡ Efficiency</div>
          <div className={`text-2xl font-bold ${getScoreColor(healthScore.breakdown.efficiency)}`}>
            {healthScore.breakdown.efficiency}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">📈 Growth</div>
          <div className={`text-2xl font-bold ${getScoreColor(healthScore.breakdown.growth)}`}>
            {healthScore.breakdown.growth}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {healthScore.alerts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">🚨 Alerts</h3>
          {healthScore.alerts.map((alert, index) => (
            <div key={index} className="bg-red-50 border border-red-200 rounded p-2 mb-2 text-sm text-red-800">
              {alert}
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">💡 Recommendations</h3>
          {healthScore.recommendations.slice(0, 3).map((rec, index) => (
            <div key={index} className="bg-blue-50 border border-blue-200 rounded p-2 mb-2 text-sm text-blue-800">
              {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}




