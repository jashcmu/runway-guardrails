'use client'

import { useState } from 'react'

interface Props {
  companyId: string
  currentBurn: number
  currentBalance: number
}

export default function FundraisingCalculator({ companyId, currentBurn, currentBalance }: Props) {
  const [show, setShow] = useState(false)
  const [amountRaising, setAmountRaising] = useState('')
  const [preMoneyValuation, setPreMoneyValuation] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const calculate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fundraising/calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          amountRaising: parseFloat(amountRaising),
          preMoneyValuation: parseFloat(preMoneyValuation),
          currentBurnRate: currentBurn,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error('Failed to calculate:', error)
    }
    setLoading(false)
  }

  if (!show) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">💰 Fundraising Calculator</h3>
        <p className="text-gray-600 text-sm mb-4">
          Model dilution and runway extension from your next funding round
        </p>
        <button
          onClick={() => setShow(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Open Calculator
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">💰 Fundraising Calculator</h3>
        <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount Raising (₹)
          </label>
          <input
            type="number"
            value={amountRaising}
            onChange={(e) => setAmountRaising(e.target.value)}
            placeholder="5000000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pre-Money Valuation (₹)
          </label>
          <input
            type="number"
            value={preMoneyValuation}
            onChange={(e) => setPreMoneyValuation(e.target.value)}
            placeholder="20000000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={calculate}
          disabled={loading || !amountRaising || !preMoneyValuation}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Calculating...' : 'Calculate Impact'}
        </button>
      </div>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-xs text-purple-600 font-medium mb-1">Dilution</div>
              <div className="text-2xl font-bold text-purple-900">
                {result.calculation.dilution}%
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-xs text-green-600 font-medium mb-1">New Runway</div>
              <div className="text-2xl font-bold text-green-900">
                {result.calculation.newRunway?.toFixed(1)} mo
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Post-Money Valuation</span>
              <span className="font-semibold text-gray-900">
                ₹{(result.calculation.postMoneyValuation / 10000000).toFixed(1)}Cr
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">New Balance</span>
              <span className="font-semibold text-gray-900">
                ₹{(result.calculation.newBalance / 100000).toFixed(1)}L
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Runway Extension</span>
              <span className="font-semibold text-green-600">
                +{result.calculation.runwayExtension?.toFixed(1)} months
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900">Scenarios</h4>
            {result.scenarios.map((scenario: any, idx: number) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{scenario.name}</div>
                    <div className="text-xs text-gray-600">{scenario.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {scenario.runway?.toFixed(1)} mo
                    </div>
                    <div className="text-xs text-gray-500">runway</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {result.recommendations && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec: string, idx: number) => (
                  <li key={idx} className="text-sm text-blue-800">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}



