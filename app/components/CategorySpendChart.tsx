'use client'

import { useState, useMemo } from 'react'
import { Category } from '@prisma/client'

interface CategoryData {
  category: Category
  displayName: string
  group: string
  spend: number
  budget: number
  percentage: number
  status: 'under' | 'warning' | 'over' | 'no-budget'
  transactionCount: number
  percentOfTotal: number
  trend: 'up' | 'down' | 'stable'
  previousMonthSpend: number
  trendPercentage: number
}

interface CategorySpendChartProps {
  categories: CategoryData[]
  totalMonthSpend: number
  viewMode?: 'pie' | 'bar' | 'table'
  onCategoryClick?: (category: string) => void
}

// Color palette for categories
const CATEGORY_COLORS: Record<string, string> = {
  'Personnel': '#6366f1', // Indigo
  'Sales & Marketing': '#22c55e', // Green
  'Technology': '#3b82f6', // Blue
  'Operations': '#f59e0b', // Amber
  'Professional Services': '#8b5cf6', // Purple
  'Travel & Entertainment': '#ec4899', // Pink
  'Finance': '#ef4444', // Red
  'Other': '#6b7280', // Gray
}

export function CategorySpendChart({ 
  categories, 
  totalMonthSpend,
  viewMode = 'bar',
  onCategoryClick 
}: CategorySpendChartProps) {
  const [activeView, setActiveView] = useState<'pie' | 'bar' | 'table'>(viewMode)
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  
  // Sort categories by spend
  const sortedCategories = useMemo(() => 
    [...categories].sort((a, b) => b.spend - a.spend).filter(c => c.spend > 0),
    [categories]
  )
  
  // Group by category group
  const groupedSpend = useMemo(() => {
    const groups: Record<string, number> = {}
    for (const cat of categories) {
      groups[cat.group] = (groups[cat.group] || 0) + cat.spend
    }
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
  }, [categories])
  
  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
    return `₹${amount.toFixed(0)}`
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Spend by Category</h3>
          <p className="text-sm text-gray-500">
            Total: {formatCurrency(totalMonthSpend)} this month
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['bar', 'pie', 'table'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === view
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {view === 'bar' ? '📊' : view === 'pie' ? '🥧' : '📋'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Bar Chart View */}
      {activeView === 'bar' && (
        <div className="space-y-3">
          {sortedCategories.slice(0, 10).map((cat, idx) => (
            <div
              key={cat.category}
              className="group cursor-pointer"
              onClick={() => onCategoryClick?.(cat.category)}
              onMouseEnter={() => setHoveredCategory(cat.category)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {cat.displayName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {cat.transactionCount} txns
                  </span>
                  {cat.trend !== 'stable' && (
                    <span className={`text-xs ${cat.trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                      {cat.trend === 'up' ? '↑' : '↓'}{Math.abs(cat.trendPercentage)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(cat.spend)}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({cat.percentOfTotal}%)
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, cat.percentOfTotal * 2)}%`,
                    backgroundColor: CATEGORY_COLORS[cat.group] || '#6b7280',
                    opacity: hoveredCategory === cat.category ? 1 : 0.8
                  }}
                />
                {cat.budget > 0 && (
                  <div
                    className="absolute top-0 w-0.5 h-full bg-gray-400"
                    style={{ left: `${Math.min(100, (cat.budget / totalMonthSpend) * 100 * 2)}%` }}
                    title={`Budget: ${formatCurrency(cat.budget)}`}
                  />
                )}
              </div>
              
              {/* Budget status */}
              {cat.budget > 0 && (
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${
                    cat.status === 'over' ? 'text-red-500' :
                    cat.status === 'warning' ? 'text-amber-500' :
                    'text-green-500'
                  }`}>
                    {cat.percentage}% of budget
                  </span>
                </div>
              )}
            </div>
          ))}
          
          {sortedCategories.length > 10 && (
            <p className="text-xs text-gray-400 text-center pt-2">
              +{sortedCategories.length - 10} more categories
            </p>
          )}
        </div>
      )}
      
      {/* Pie Chart View (CSS-only) */}
      {activeView === 'pie' && (
        <div className="flex items-center gap-8">
          {/* Simple CSS Donut */}
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {groupedSpend.reduce((acc, [group, amount], idx) => {
                const percentage = (amount / totalMonthSpend) * 100
                const previousTotal = acc.total
                acc.elements.push(
                  <circle
                    key={group}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={CATEGORY_COLORS[group] || '#6b7280'}
                    strokeWidth="20"
                    strokeDasharray={`${percentage * 2.51327} ${251.327 - percentage * 2.51327}`}
                    strokeDashoffset={-previousTotal * 2.51327}
                    className="transition-all duration-300"
                    style={{ opacity: hoveredCategory === group ? 1 : 0.8 }}
                    onMouseEnter={() => setHoveredCategory(group)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                )
                acc.total += percentage
                return acc
              }, { elements: [] as React.ReactNode[], total: 0 }).elements}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalMonthSpend)}
              </span>
              <span className="text-xs text-gray-500">Total Spend</span>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex-1 space-y-2">
            {groupedSpend.map(([group, amount]) => (
              <div
                key={group}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  hoveredCategory === group ? 'bg-gray-50' : ''
                }`}
                onMouseEnter={() => setHoveredCategory(group)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[group] || '#6b7280' }}
                  />
                  <span className="text-sm text-gray-700">{group}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(amount)}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {Math.round((amount / totalMonthSpend) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Table View */}
      {activeView === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-600">Category</th>
                <th className="text-right py-2 font-medium text-gray-600">Spend</th>
                <th className="text-right py-2 font-medium text-gray-600">Budget</th>
                <th className="text-right py-2 font-medium text-gray-600">Used</th>
                <th className="text-right py-2 font-medium text-gray-600">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((cat) => (
                <tr
                  key={cat.category}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onCategoryClick?.(cat.category)}
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[cat.group] || '#6b7280' }}
                      />
                      <span className="font-medium text-gray-900">{cat.displayName}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 font-medium text-gray-900">
                    {formatCurrency(cat.spend)}
                  </td>
                  <td className="text-right py-3 text-gray-600">
                    {cat.budget > 0 ? formatCurrency(cat.budget) : '-'}
                  </td>
                  <td className="text-right py-3">
                    {cat.budget > 0 ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        cat.status === 'over' ? 'bg-red-100 text-red-700' :
                        cat.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {cat.percentage}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-right py-3">
                    <span className={`text-xs font-medium ${
                      cat.trend === 'up' ? 'text-red-500' :
                      cat.trend === 'down' ? 'text-green-500' :
                      'text-gray-400'
                    }`}>
                      {cat.trend === 'up' ? '↑' : cat.trend === 'down' ? '↓' : '→'}
                      {cat.trendPercentage !== 0 ? ` ${Math.abs(cat.trendPercentage)}%` : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-3 text-gray-900">Total</td>
                <td className="text-right py-3 text-gray-900">{formatCurrency(totalMonthSpend)}</td>
                <td className="text-right py-3 text-gray-600">
                  {formatCurrency(categories.reduce((s, c) => s + c.budget, 0))}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default CategorySpendChart
