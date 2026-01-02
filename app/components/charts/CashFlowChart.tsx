'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts'

type CashFlowData = {
  date: string
  balance: number
  inflow?: number
  outflow?: number
}

type CashFlowChartProps = {
  data: CashFlowData[]
  currentBalance: number
}

export default function CashFlowChart({ data, currentBalance }: CashFlowChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const chartData = data.map(item => ({
    date: item.date,
    balance: typeof item.balance === 'number' ? item.balance : parseFloat(String(item.balance)),
    inflow: item.inflow ? (typeof item.inflow === 'number' ? item.inflow : parseFloat(String(item.inflow))) : 0,
    outflow: item.outflow ? (typeof item.outflow === 'number' ? item.outflow : parseFloat(String(item.outflow))) : 0,
  }))

  // Project future cash flow (next 6 months)
  const projectFuture = () => {
    if (chartData.length < 2) return chartData
    
    const lastBalance = chartData[chartData.length - 1].balance
    const avgOutflow = chartData.reduce((sum, item) => sum + item.outflow, 0) / chartData.length
    
    const projections = []
    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + i)
      const dateLabel = futureDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      projections.push({
        date: dateLabel,
        balance: Math.max(0, lastBalance - (avgOutflow * i)),
        inflow: 0,
        outflow: avgOutflow,
        isProjection: true,
      })
    }
    
    return [...chartData, ...projections]
  }

  const fullData = projectFuture()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const balance = payload.find((p: any) => p.dataKey === 'balance')
      const inflow = payload.find((p: any) => p.dataKey === 'inflow')
      const outflow = payload.find((p: any) => p.dataKey === 'outflow')
      const isProjection = payload[0]?.payload?.isProjection
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            {label} {isProjection && <span className="text-xs text-gray-500">(Projected)</span>}
          </p>
          {balance && (
            <p className="text-sm text-gray-700">
              Balance: <span className="font-medium">{formatCurrency(balance.value)}</span>
            </p>
          )}
          {inflow && inflow.value > 0 && (
            <p className="text-sm text-green-600">
              Inflow: <span className="font-medium">{formatCurrency(inflow.value)}</span>
            </p>
          )}
          {outflow && outflow.value > 0 && (
            <p className="text-sm text-red-600">
              Outflow: <span className="font-medium">{formatCurrency(outflow.value)}</span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={fullData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
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
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceArea 
            x1={chartData.length > 0 ? chartData[chartData.length - 1].date : undefined}
            x2={fullData.length > 0 ? fullData[fullData.length - 1].date : undefined}
            fill="#fef3c7"
            fillOpacity={0.3}
            label="Projection"
          />
          <Line 
            type="monotone" 
            dataKey="balance" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Cash Balance"
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="inflow" 
            stroke="#10b981" 
            strokeWidth={1}
            strokeDasharray="5 5"
            name="Inflow"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="outflow" 
            stroke="#ef4444" 
            strokeWidth={1}
            strokeDasharray="5 5"
            name="Outflow"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 text-sm text-gray-600 text-center">
        Current Balance: <span className="font-semibold">{formatCurrency(currentBalance)}</span>
      </div>
    </div>
  )
}

