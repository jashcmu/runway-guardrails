'use client'

type CategoryData = {
  category: string
  budget: number
  spend: number
  percentage: number
  status: 'under' | 'warning' | 'over' | 'no-budget'
}

type BudgetVsActualProps = {
  categories: CategoryData[]
}

export default function BudgetVsActual({ categories }: BudgetVsActualProps) {
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

  const getVariance = (budget: number, spend: number) => {
    if (budget === 0) return 0
    return ((spend - budget) / budget) * 100
  }

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'over': return 'bg-red-500'
      case 'warning': return 'bg-yellow-500'
      case 'under': return 'bg-green-500'
      default: return 'bg-gray-300'
    }
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Budget vs Actual</h2>
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">No budgets set</p>
          <p className="text-sm">Create budgets to track spending by category</p>
        </div>
      </div>
    )
  }

  const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0)
  const totalSpend = categories.reduce((sum, cat) => sum + cat.spend, 0)
  const overallVariance = getVariance(totalBudget, totalSpend)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">📊 Budget vs Actual Spending</h2>
        <p className="text-sm text-gray-500 mt-1">Track spending against budgets by category</p>
        
        {/* Overall Summary */}
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Budget</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Spend</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Variance</p>
              <p className={`text-lg font-bold ${overallVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {overallVariance > 0 ? '+' : ''}{overallVariance.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Budget
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actual
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Variance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.map((category) => {
              const variance = getVariance(category.budget, category.spend)
              return (
                <tr key={category.category} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCategory(category.category)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(category.budget)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                    {formatCurrency(category.spend)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <span className={`font-medium ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${getProgressBarColor(category.status)} transition-all duration-300`}
                          style={{ width: `${Math.min(category.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 min-w-[3rem] text-right">
                        {category.percentage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      category.status === 'over' ? 'bg-red-100 text-red-800' :
                      category.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      category.status === 'no-budget' ? 'bg-gray-100 text-gray-600' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {category.status === 'over' ? '🚨 Over' :
                       category.status === 'warning' ? '⚠️ Warning' :
                       category.status === 'no-budget' ? 'No Budget' :
                       '✅ On Track'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">💡 Quick Insights</h3>
        <div className="space-y-1 text-sm text-gray-600">
          {categories.filter(c => c.status === 'over').length > 0 && (
            <p>• {categories.filter(c => c.status === 'over').length} categor{categories.filter(c => c.status === 'over').length === 1 ? 'y is' : 'ies are'} over budget</p>
          )}
          {categories.filter(c => c.status === 'warning').length > 0 && (
            <p>• {categories.filter(c => c.status === 'warning').length} categor{categories.filter(c => c.status === 'warning').length === 1 ? 'y is' : 'ies are'} approaching budget limit</p>
          )}
          {categories.filter(c => c.status === 'under').length === categories.length && (
            <p>• ✅ All categories are within budget!</p>
          )}
          {totalSpend === 0 && (
            <p>• No spending recorded yet. Add expenses to see budget utilization.</p>
          )}
        </div>
      </div>
    </div>
  )
}



