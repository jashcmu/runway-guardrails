'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

type BudgetData = {
  category: string
  budget: number
  actual: number
  percentage: number
  status: 'under' | 'warning' | 'over' | 'no-budget'
}

type BudgetVsActualChartProps = {
  data: BudgetData[]
}

export default function BudgetVsActualChart({ data }: BudgetVsActualChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' & ')
  }

  const chartData = data
    .filter(item => item.budget > 0 || item.actual > 0)
    .map(item => ({
      category: formatCategory(item.category),
      budget: typeof item.budget === 'number' ? item.budget : parseFloat(String(item.budget)),
      actual: typeof item.actual === 'number' ? item.actual : parseFloat(String(item.actual)),
      percentage: item.percentage,
      status: item.status,
      variance: item.budget > 0 ? item.actual - item.budget : 0,
    }))
    .sort((a, b) => b.budget - a.budget)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      case 'under':
        return '#10b981'
      default:
        return '#6b7280'
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const budget = payload.find((p: any) => p.dataKey === 'budget')
      const actual = payload.find((p: any) => p.dataKey === 'actual')
      
      if (budget && actual) {
        const variance = actual.value - budget.value
        const variancePercent = budget.value > 0 
          ? ((variance / budget.value) * 100).toFixed(1)
          : '0'
        
        return (
          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
            <p className="font-semibold text-gray-900 mb-2">{label}</p>
            <p className="text-sm text-gray-700">
              Budget: <span className="font-medium">{formatCurrency(budget.value)}</span>
            </p>
            <p className="text-sm text-gray-700">
              Actual: <span className="font-medium">{formatCurrency(actual.value)}</span>
            </p>
            <p className={`text-sm font-medium ${
              variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'
            }`}>
              Variance: {variance > 0 ? '+' : ''}{formatCurrency(variance)} ({variancePercent}%)
            </p>
          </div>
        )
      }
    }
    return null
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="category" 
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
          <Bar 
            dataKey="budget" 
            fill="#6b7280" 
            name="Budget"
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="actual" 
            name="Actual Spend"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-gray-600 text-center">
        <span className="inline-block mr-4">🟢 On Track</span>
        <span className="inline-block mr-4">🟡 Warning (80%+)</span>
        <span className="inline-block">🔴 Over Budget</span>
      </div>
    </div>
  )
}

