'use client'

import { useState, useEffect } from 'react'

type Insight = {
  id: string
  type: 'success' | 'warning' | 'info' | 'achievement'
  title: string
  message: string
  recommendation?: string
  actionable: boolean
}

type SmartInsightsProps = {
  companyId: string
  cashBalance: number
}

export default function SmartInsights({ companyId, cashBalance }: SmartInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (companyId && cashBalance) {
      fetchInsights()
    }
  }, [companyId, cashBalance])

  const fetchInsights = async () => {
    try {
      setLoading(true)
      // Fetch smart alerts as insights
      const response = await fetch(`/api/alerts/smart?companyId=${encodeURIComponent(companyId)}&cashBalance=${encodeURIComponent(cashBalance)}`)
      if (response.ok) {
        const data = await response.json()
        const smartAlerts = data.alerts || []
        
        // Transform alerts to insights
        const transformedInsights: Insight[] = smartAlerts.map((alert: any) => ({
          id: alert.id,
          type: alert.severity === 'critical' ? 'warning' : 
                alert.severity === 'warning' ? 'warning' : 
                alert.type === 'burn_decrease' ? 'success' : 'info',
          title: alert.title,
          message: alert.message,
          recommendation: alert.recommendation,
          actionable: alert.actionable,
        }))

        // Add achievements
        const achievements = await generateAchievements(companyId, cashBalance)
        setInsights([...transformedInsights, ...achievements])
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAchievements = async (companyId: string, cashBalance: number): Promise<Insight[]> => {
    const achievements: Insight[] = []
    
    try {
      const dashboardResponse = await fetch(`/api/dashboard?companyId=${encodeURIComponent(companyId)}&cashBalance=${encodeURIComponent(cashBalance)}`)
      if (dashboardResponse.ok) {
        const dashboard = await dashboardResponse.json()
        
        if (dashboard.runway && dashboard.runway >= 12) {
          achievements.push({
            id: 'runway-12-plus',
            type: 'achievement',
            title: '🎯 Excellent Runway',
            message: `You have ${dashboard.runway.toFixed(1)} months of runway. Great financial discipline!`,
            actionable: false,
          })
        }

        // Check if burn is decreasing
        const trendsResponse = await fetch(`/api/trends?companyId=${encodeURIComponent(companyId)}`)
        if (trendsResponse.ok) {
          const trends = await trendsResponse.json()
          if (trends.trend === 'decreasing') {
            achievements.push({
              id: 'burn-decreasing',
              type: 'success',
              title: '📉 Burn Rate Improving',
              message: `Your burn rate is decreasing. This extends your runway and improves financial health.`,
              actionable: false,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate achievements:', error)
    }

    return achievements
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      case 'achievement':
        return 'bg-blue-50 border-blue-200 text-blue-900'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">💡 Smart Insights</h2>
        <div className="text-center text-gray-500">Loading insights...</div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">💡 Smart Insights</h2>
        <div className="text-center text-gray-500">No insights available yet. Add some transactions to get started!</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">💡 Smart Insights</h2>
      <div className="space-y-3">
        {insights.slice(0, 5).map((insight) => (
          <div
            key={insight.id}
            className={`p-4 rounded-lg border ${getTypeStyles(insight.type)}`}
          >
            <h3 className="font-semibold mb-1">{insight.title}</h3>
            <p className="text-sm mb-2">{insight.message}</p>
            {insight.recommendation && (
              <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                <p className="text-xs font-medium mb-1">💡 Recommendation:</p>
                <p className="text-xs whitespace-pre-line">{insight.recommendation}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {insights.length > 5 && (
        <button
          onClick={() => alert(`Showing ${insights.length} total insights. Full list coming soon!`)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800"
        >
          View all {insights.length} insights →
        </button>
      )}
    </div>
  )
}

