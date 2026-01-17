'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useState } from 'react'

type CategoryData = {
  category: string
  amount: number
  percentage: number
  budget?: number
  trend?: 'up' | 'down' | 'stable'
  trendPercentage?: number
}

type CategorySpendChartProps = {
  data: CategoryData[]
  viewMode?: 'pie' | 'bar'
}

// Extended color palette for 40+ categories
const CATEGORY_COLORS: Record<string, string> = {
  // Personnel
  'Hiring': '#6366f1',
  'Salaries': '#818cf8',
  'Benefits': '#a5b4fc',
  'Training': '#c7d2fe',
  
  // Marketing & Sales
  'Marketing': '#22c55e',
  'Sales': '#4ade80',
  'Advertising': '#86efac',
  'Events': '#bbf7d0',
  
  // Technology
  'SaaS': '#3b82f6',
  'Cloud': '#60a5fa',
  'ITInfrastructure': '#93c5fd',
  'Software': '#bfdbfe',
  'Hardware': '#dbeafe',
  'Security': '#2563eb',
  
  // Operations
  'Rent': '#f59e0b',
  'Utilities': '#fbbf24',
  'OfficeSupplies': '#fcd34d',
  'Equipment': '#fde68a',
  'Maintenance': '#fef3c7',
  
  // Professional
  'Legal': '#8b5cf6',
  'Accounting': '#a78bfa',
  'Consulting': '#c4b5fd',
  'ProfessionalServices': '#ddd6fe',
  
  // Travel
  'Travel': '#ec4899',
  'Meals': '#f472b6',
  'Entertainment': '#f9a8d4',
  
  // Finance
  'Taxes': '#ef4444',
  'Insurance': '#f87171',
  'BankFees': '#fca5a5',
  'PaymentProcessing': '#fecaca',
  'InterestCharges': '#fee2e2',
  
  // Other
  'ResearchDevelopment': '#14b8a6',
  'CustomerSupport': '#2dd4bf',
  'Subscriptions': '#5eead4',
  'Refunds': '#99f6e4',
  'Depreciation': '#6b7280',
  'BadDebts': '#9ca3af',
  'G_A': '#d1d5db',
  'Other': '#e5e7eb',
}

// Display names for categories
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'Hiring': 'Hiring & Recruitment',
  'Salaries': 'Salaries & Wages',
  'Benefits': 'Employee Benefits',
  'Training': 'Training & Development',
  'Marketing': 'Marketing',
  'Sales': 'Sales',
  'Advertising': 'Advertising',
  'Events': 'Events & Conferences',
  'SaaS': 'SaaS Tools',
  'Cloud': 'Cloud Services',
  'ITInfrastructure': 'IT Infrastructure',
  'Software': 'Software',
  'Hardware': 'Hardware',
  'Security': 'Security',
  'Rent': 'Rent & Facilities',
  'Utilities': 'Utilities',
  'OfficeSupplies': 'Office Supplies',
  'Equipment': 'Equipment & Furniture',
  'Maintenance': 'Maintenance',
  'Legal': 'Legal',
  'Accounting': 'Accounting & Audit',
  'Consulting': 'Consulting',
  'ProfessionalServices': 'Professional Services',
  'Travel': 'Travel',
  'Meals': 'Meals & Food',
  'Entertainment': 'Entertainment',
  'Taxes': 'Taxes & Duties',
  'Insurance': 'Insurance',
  'BankFees': 'Bank Fees',
  'PaymentProcessing': 'Payment Processing',
  'InterestCharges': 'Interest & Finance',
  'ResearchDevelopment': 'R&D',
  'CustomerSupport': 'Customer Support',
  'Subscriptions': 'Subscriptions',
  'Refunds': 'Refunds & Returns',
  'Depreciation': 'Depreciation',
  'BadDebts': 'Bad Debts',
  'G_A': 'General & Admin',
  'Other': 'Other',
}

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16']

export default function CategorySpendChart({ data, viewMode = 'pie' }: CategorySpendChartProps) {
  const [activeView, setActiveView] = useState<'pie' | 'bar'>(viewMode)
  
  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
    return `₹${value.toFixed(0)}`
  }

  const formatCategory = (category: string) => {
    return CATEGORY_DISPLAY_NAMES[category] || category.replace(/_/g, ' & ')
  }

  const getColor = (category: string, index: number) => {
    return CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  }

  const chartData = data
    .filter(item => item.amount > 0)
    .map((item, index) => ({
      name: formatCategory(item.category),
      category: item.category,
      value: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)),
      percentage: item.percentage,
      color: getColor(item.category, index),
      trend: item.trend,
      trendPercentage: item.trendPercentage,
    }))
    .sort((a, b) => b.value - a.value)

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-700">
            Amount: <span className="font-medium">{formatCurrency(data.value)}</span>
          </p>
          <p className="text-sm text-gray-700">
            Share: <span className="font-medium">{Math.round((data.value / total) * 100)}%</span>
          </p>
          {data.trend && data.trend !== 'stable' && (
            <p className={`text-sm ${data.trend === 'up' ? 'text-red-600' : 'text-green-600'}`}>
              {data.trend === 'up' ? '↑' : '↓'} {Math.abs(data.trendPercentage || 0)}% vs last month
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full">
      {/* View Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('pie')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'pie' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🥧 Pie
          </button>
          <button
            onClick={() => setActiveView('bar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Bar
          </button>
        </div>
      </div>

      {activeView === 'pie' ? (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => chartData.length <= 8 ? `${name.split(' ')[0]}: ${formatCurrency(value)}` : ''}
              outerRadius={120}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => value}
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              layout="horizontal"
              align="center"
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 35)}>
          <BarChart
            data={chartData.slice(0, 15)} // Limit to top 15 for readability
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis 
              type="number" 
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fontSize: 11 }}
              width={95}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]}
            >
              {chartData.slice(0, 15).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          Total Spending: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
          {chartData.length > 0 && (
            <span className="text-gray-400 ml-2">({chartData.length} categories)</span>
          )}
        </p>
      </div>
    </div>
  )
}
