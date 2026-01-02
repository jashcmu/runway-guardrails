'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type BurnData = {
  month: string
  burn: number
  transactionCount: number
}

type BurnTrendChartProps = {
  data: BurnData[]
  currentBurn?: number
}

export default function BurnTrendChart({ data, currentBurn }: BurnTrendChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const chartData = data.map(item => ({
    month: item.month,
    burn: typeof item.burn === 'number' ? item.burn : parseFloat(String(item.burn)),
    transactions: item.transactionCount,
  }))

  // Calculate trend line (simple linear regression)
  const calculateTrend = () => {
    if (chartData.length < 2) return []
    const n = chartData.length
    const sumX = chartData.reduce((sum, _, i) => sum + i, 0)
    const sumY = chartData.reduce((sum, item) => sum + item.burn, 0)
    const sumXY = chartData.reduce((sum, item, i) => sum + i * item.burn, 0)
    const sumX2 = chartData.reduce((sum, _, i) => sum + i * i, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    return chartData.map((_, i) => ({
      month: chartData[i].month,
      trend: intercept + slope * i,
    }))
  }

  const trendData = calculateTrend()
  const combinedData = chartData.map((item, i) => ({
    ...item,
    trend: trendData[i]?.trend || item.burn,
  }))

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="month" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => {
              if (value >= 1000000) return `₹${(value / 1000000).toFixed(1)}M`
              if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
              return `₹${value}`
            }}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: '#374151', fontWeight: 'bold' }}
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="burn" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Monthly Burn"
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="trend" 
            stroke="#10b981" 
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Trend"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {currentBurn && (
        <div className="mt-2 text-sm text-gray-600 text-center">
          Current Monthly Burn: <span className="font-semibold">{formatCurrency(currentBurn)}</span>
        </div>
      )}
    </div>
  )
}

