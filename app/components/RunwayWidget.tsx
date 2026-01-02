'use client'

interface Props {
  runway: number | null
  cashBalance: number
  monthlyBurn: number
  targetMonths?: number | null
}

export default function RunwayWidget({ runway, cashBalance, monthlyBurn, targetMonths }: Props) {
  const getStatus = () => {
    if (!runway) return { color: 'gray', emoji: '❓', label: 'Unknown' }
    if (runway >= 18) return { color: 'green', emoji: '🎉', label: 'Excellent' }
    if (runway >= 12) return { color: 'blue', emoji: '👍', label: 'Good' }
    if (runway >= 6) return { color: 'yellow', emoji: '⚠️', label: 'Warning' }
    return { color: 'red', emoji: '🚨', label: 'Critical' }
  }

  const status = getStatus()

  const getProgressColor = () => {
    if (!runway) return 'bg-gray-300'
    if (runway >= 18) return 'bg-gradient-to-r from-green-500 to-emerald-500'
    if (runway >= 12) return 'bg-gradient-to-r from-blue-500 to-cyan-500'
    if (runway >= 6) return 'bg-gradient-to-r from-yellow-500 to-orange-500'
    return 'bg-gradient-to-r from-red-500 to-pink-500'
  }

  const progress = runway && targetMonths ? Math.min((runway / targetMonths) * 100, 100) : 0

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-lg border-2 ${
      status.color === 'green' ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' :
      status.color === 'blue' ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50' :
      status.color === 'yellow' ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50' :
      status.color === 'red' ? 'border-red-300 bg-gradient-to-br from-red-50 to-pink-50' :
      'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50'
    }`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Cash Runway</div>
            <div className="flex items-baseline space-x-3">
              <span className="text-6xl font-bold text-gray-900">
                {runway ? runway.toFixed(1) : '--'}
              </span>
              <span className="text-2xl font-medium text-gray-600">months</span>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full ${
            status.color === 'green' ? 'bg-green-100 text-green-800' :
            status.color === 'blue' ? 'bg-blue-100 text-blue-800' :
            status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
            status.color === 'red' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            <span className="text-xl mr-1">{status.emoji}</span>
            <span className="font-semibold">{status.label}</span>
          </div>
        </div>

        {/* Progress Bar */}
        {targetMonths && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Current Progress</span>
              <span>Target: {targetMonths} months</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor()} transition-all duration-500`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/80 backdrop-blur rounded-xl border border-gray-200">
            <div className="text-xs text-gray-600 font-medium mb-1">Cash Balance</div>
            <div className="text-2xl font-bold text-gray-900">
              ₹{(cashBalance / 100000).toFixed(1)}L
            </div>
            <div className="text-xs text-gray-500 mt-1">Available funds</div>
          </div>

          <div className="p-4 bg-white/80 backdrop-blur rounded-xl border border-gray-200">
            <div className="text-xs text-gray-600 font-medium mb-1">Monthly Burn</div>
            <div className="text-2xl font-bold text-gray-900">
              ₹{(monthlyBurn / 100000).toFixed(1)}L
            </div>
            <div className="text-xs text-gray-500 mt-1">Avg. spending</div>
          </div>
        </div>

        {/* Warnings */}
        {runway && runway < 6 && (
          <div className="mt-4 p-4 bg-red-100 border-2 border-red-300 rounded-xl">
            <p className="text-sm font-semibold text-red-900">
              🚨 Critical: Only {runway.toFixed(1)} months of runway left!
            </p>
            <p className="text-xs text-red-700 mt-1">
              Consider fundraising or reducing expenses immediately
            </p>
          </div>
        )}

        {runway && runway < 12 && runway >= 6 && (
          <div className="mt-4 p-4 bg-yellow-100 border-2 border-yellow-300 rounded-xl">
            <p className="text-sm font-semibold text-yellow-900">
              ⚠️ Warning: {runway.toFixed(1)} months runway
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Start planning your next fundraise or cost optimization
            </p>
          </div>
        )}
      </div>
    </div>
  )
}



