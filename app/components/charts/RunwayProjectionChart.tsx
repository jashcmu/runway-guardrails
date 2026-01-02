'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

type RunwayData = {
  month: string
  current: number | null
  optimistic?: number | null
  pessimistic?: number | null
}

type RunwayProjectionChartProps = {
  data: RunwayData[]
  currentRunway: number | null
  cashBalance: number
  monthlyBurn: number
}

export default function RunwayProjectionChart({ 
  data, 
  currentRunway, 
  cashBalance, 
  monthlyBurn 
}: RunwayProjectionChartProps) {
  const formatMonths = (value: number | null) => {
    if (value === null || value === Infinity) return '∞'
    return `${value.toFixed(1)}m`
  }

  // Generate projection data
  const generateProjections = () => {
    if (!currentRunway || currentRunway === Infinity || monthlyBurn <= 0) return data

    const projections: RunwayData[] = [...data]
    const monthsToProject = 12
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    for (let i = 1; i <= monthsToProject; i++) {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + i)
      const monthLabel = futureDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      // Optimistic: 10% burn reduction
      const optimisticBurn = monthlyBurn * 0.9
      const optimisticRunway = optimisticBurn > 0 ? (cashBalance - (monthlyBurn * i)) / optimisticBurn : null

      // Pessimistic: 20% burn increase
      const pessimisticBurn = monthlyBurn * 1.2
      const pessimisticRunway = pessimisticBurn > 0 ? (cashBalance - (monthlyBurn * i)) / pessimisticBurn : null

      // Current trend
      const currentRunwayProjected = currentRunway - i

      projections.push({
        month: monthLabel,
        current: currentRunwayProjected > 0 ? currentRunwayProjected : 0,
        optimistic: optimisticRunway && optimisticRunway > 0 ? optimisticRunway : 0,
        pessimistic: pessimisticRunway && pessimisticRunway > 0 ? pessimisticRunway : 0,
      })
    }

    return projections
  }

  const chartData = generateProjections()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatMonths(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorPessimistic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="month" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={formatMonths}
            label={{ value: 'Runway (months)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={6} stroke="#f59e0b" strokeDasharray="3 3" label="6 Month Threshold" />
          <ReferenceLine y={12} stroke="#10b981" strokeDasharray="3 3" label="12 Month Threshold" />
          {chartData.some(d => d.pessimistic !== undefined) && (
            <Area
              type="monotone"
              dataKey="pessimistic"
              stackId="1"
              stroke="#ef4444"
              fillOpacity={0.3}
              fill="url(#colorPessimistic)"
              name="Pessimistic (+20% burn)"
            />
          )}
          <Area
            type="monotone"
            dataKey="current"
            stackId="1"
            stroke="#3b82f6"
            fillOpacity={0.6}
            fill="url(#colorCurrent)"
            name="Current Trend"
          />
          {chartData.some(d => d.optimistic !== undefined) && (
            <Area
              type="monotone"
              dataKey="optimistic"
              stackId="1"
              stroke="#10b981"
              fillOpacity={0.3}
              fill="url(#colorOptimistic)"
              name="Optimistic (-10% burn)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-gray-600 text-center">
        <span className="inline-block mr-4">🟢 Safe (12+ months)</span>
        <span className="inline-block mr-4">🟡 Risky (6-12 months)</span>
        <span className="inline-block">🔴 Critical (&lt;6 months)</span>
      </div>
    </div>
  )
}

