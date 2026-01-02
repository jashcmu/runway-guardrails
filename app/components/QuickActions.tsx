'use client'

interface Props {
  onAddExpense: () => void
  onUploadStatement: () => void
  onInviteInvestor: () => void
  onViewBenchmarks: () => void
}

export default function QuickActions({
  onAddExpense,
  onUploadStatement,
  onInviteInvestor,
  onViewBenchmarks,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h3>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAddExpense}
          className="flex items-center space-x-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg border border-blue-200 transition-all"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl">
            +
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Add Expense</div>
            <div className="text-xs text-gray-600">Manual entry</div>
          </div>
        </button>

        <button
          onClick={onUploadStatement}
          className="flex items-center space-x-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-lg border border-green-200 transition-all"
        >
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl">
            📄
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Upload Statement</div>
            <div className="text-xs text-gray-600">PDF/CSV import</div>
          </div>
        </button>

        <button
          onClick={onInviteInvestor}
          className="flex items-center space-x-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border border-purple-200 transition-all"
        >
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xl">
            👥
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Invite Investor</div>
            <div className="text-xs text-gray-600">Share dashboard</div>
          </div>
        </button>

        <button
          onClick={onViewBenchmarks}
          className="flex items-center space-x-3 p-4 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-lg border border-orange-200 transition-all"
        >
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white text-xl">
            📊
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Benchmarks</div>
            <div className="text-xs text-gray-600">Compare peers</div>
          </div>
        </button>
      </div>
    </div>
  )
}




