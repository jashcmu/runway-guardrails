'use client'

import { useState, useEffect } from 'react'

interface Props {
  companyId: string
}

export default function BenchmarkWidget({ companyId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  const loadBenchmarks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/benchmarks?companyId=${companyId}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Failed to load benchmarks:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (show && !data) {
      loadBenchmarks()
    }
  }, [show])

  if (!show) {
    return (
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Peer Benchmarks</h3>
        <p className="text-gray-600 text-sm mb-4">
          See how your metrics compare with similar startups
        </p>
        <button
          onClick={() => setShow(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          View Benchmarks
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const getBadge = (status: string) => {
    if (status === 'excellent') return { bg: 'bg-green-100', text: 'text-green-800', emoji: '🏆' }
    if (status === 'good') return { bg: 'bg-blue-100', text: 'text-blue-800', emoji: '👍' }
    if (status === 'average') return { bg: 'bg-yellow-100', text: 'text-yellow-800', emoji: '➖' }
    return { bg: 'bg-red-100', text: 'text-red-800', emoji: '⚠️' }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📊 Benchmark Comparison</h3>
          <p className="text-sm text-gray-600">
            vs {data.metadata.peerCount} similar {data.metadata.industry} startups
          </p>
        </div>
        <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {/* Burn Rate */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Burn Rate</span>
          {(() => {
            const badge = getBadge(data.comparison.burn.status)
            return (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                {badge.emoji} {data.comparison.burn.status}
              </span>
            )
          })()}
        </div>
        <div className="flex items-baseline space-x-2 mb-2">
          <span className="text-2xl font-bold text-gray-900">
            ₹{(data.yourMetrics.burnRate / 100000).toFixed(1)}L
          </span>
          <span className="text-sm text-gray-600">/month</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Peer median: ₹{(data.peerBenchmarks.burnRate.p50 / 100000).toFixed(1)}L</span>
          <span
            className={
              data.comparison.burn.percentDiff > 0 ? 'text-red-600' : 'text-green-600'
            }
          >
            {data.comparison.burn.percentDiff > 0 ? '+' : ''}
            {data.comparison.burn.percentDiff}%
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-orange-500"
            style={{
              width: `${Math.min(
                (data.yourMetrics.burnRate / data.peerBenchmarks.burnRate.p75) * 100,
                100
              )}%`,
            }}
          />
        </div>
      </div>

      {/* Revenue */}
      {data.yourMetrics.revenue > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly Revenue</span>
            {(() => {
              const badge = getBadge(data.comparison.revenue?.status || 'average')
              return (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                  {badge.emoji} {data.comparison.revenue?.status}
                </span>
              )
            })()}
          </div>
          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-2xl font-bold text-gray-900">
              ₹{(data.yourMetrics.revenue / 100000).toFixed(1)}L
            </span>
            <span className="text-sm text-gray-600">/month</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Peer median: ₹{(data.peerBenchmarks.revenue.p50 / 100000).toFixed(1)}L</span>
            <span
              className={
                data.comparison.revenue.percentDiff > 0 ? 'text-green-600' : 'text-red-600'
              }
            >
              {data.comparison.revenue.percentDiff > 0 ? '+' : ''}
              {data.comparison.revenue.percentDiff}%
            </span>
          </div>
        </div>
      )}

      {/* Insights */}
      {data.insights && data.insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">💡 Insights</h4>
          {data.insights.map((insight: string, idx: number) => (
            <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">{insight}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={loadBenchmarks}
        className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        🔄 Refresh Data
      </button>
    </div>
  )
}



