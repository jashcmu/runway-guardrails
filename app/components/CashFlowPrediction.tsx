'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PredictionData {
  month: string
  predictedBurn: number
  predictedRevenue: number
  predictedBalance: number
  confidence: number
}

interface Props {
  companyId: string
}

export default function CashFlowPrediction({ companyId }: Props) {
  const [predictions, setPredictions] = useState<PredictionData[]>([])
  const [loading, setLoading] = useState(false)
  const [months, setMonths] = useState(6)

  const loadPredictions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cashflow/predict?companyId=${companyId}&months=${months}`)
      const data = await res.json()
      setPredictions(data.predictions || [])
    } catch (error) {
      console.error('Failed to load predictions:', error)
    }
    setLoading(false)
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">💡 Cash Flow Predictions</h3>
        <p className="text-gray-600 text-sm mb-4">
          See how long your money will last with AI-powered forecasting
        </p>
        <button
          onClick={loadPredictions}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Predictions'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📈 Cash Flow Forecast</h3>
          <p className="text-sm text-gray-600">Next {months} months prediction</p>
        </div>
        <select
          value={months}
          onChange={(e) => {
            setMonths(Number(e.target.value))
            loadPredictions()
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value={3}>3 months</option>
          <option value={6}>6 months</option>
          <option value={12}>12 months</option>
        </select>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={predictions}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number) => `₹${(value / 100000).toFixed(1)}L`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="predictedBalance"
              stroke="#4f46e5"
              strokeWidth={2}
              name="Cash Balance"
              dot={{ fill: '#4f46e5' }}
            />
            <Line
              type="monotone"
              dataKey="predictedBurn"
              stroke="#ef4444"
              strokeWidth={2}
              name="Burn Rate"
              dot={{ fill: '#ef4444' }}
            />
            <Line
              type="monotone"
              dataKey="predictedRevenue"
              stroke="#10b981"
              strokeWidth={2}
              name="Revenue"
              dot={{ fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {predictions.slice(0, 3).map((pred) => (
          <div key={pred.month} className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">{pred.month}</div>
            <div className="text-lg font-semibold text-gray-900">
              ₹{(pred.predictedBalance / 100000).toFixed(1)}L
            </div>
            <div className="text-xs text-gray-500">{pred.confidence}% confidence</div>
          </div>
        ))}
      </div>

      {predictions[predictions.length - 1]?.predictedBalance < 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">
            ⚠️ Warning: Predicted to run out of cash in{' '}
            {predictions.findIndex((p) => p.predictedBalance < 0) + 1} months
          </p>
        </div>
      )}
    </div>
  )
}



