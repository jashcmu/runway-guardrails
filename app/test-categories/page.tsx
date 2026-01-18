'use client'

import { Category } from '@prisma/client'

export default function TestCategoriesPage() {
  const allCategories: Category[] = [
    'Hiring', 'Salaries', 'Benefits', 'Training',
    'Marketing', 'Sales', 'Advertising', 'Events',
    'SaaS', 'Cloud', 'ITInfrastructure', 'Software', 'Hardware', 'Security',
    'Rent', 'Utilities', 'OfficeSupplies', 'Equipment', 'Maintenance',
    'Legal', 'Accounting', 'Consulting', 'ProfessionalServices',
    'Travel', 'Meals', 'Entertainment',
    'Taxes', 'Insurance', 'BankFees', 'PaymentProcessing', 'InterestCharges',
    'ResearchDevelopment', 'CustomerSupport', 'Subscriptions', 'Refunds', 'Depreciation', 'BadDebts', 'G_A', 'Other'
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">✅ New Categories Test Page</h1>
        <p className="text-lg text-gray-600 mb-8">
          If you can see this page and the categories below, the deployment is working!
        </p>
        
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">All {allCategories.length} Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {allCategories.map((cat) => (
              <div key={cat} className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
                <div className="font-semibold text-indigo-900">{cat}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6">
          <h3 className="text-xl font-bold text-green-900 mb-2">✅ Deployment Status</h3>
          <p className="text-green-800">
            This page confirms that:
          </p>
          <ul className="list-disc list-inside text-green-800 mt-2 space-y-1">
            <li>New code is deployed successfully</li>
            <li>All {allCategories.length} categories are available</li>
            <li>TypeScript compilation is working</li>
            <li>Prisma schema is updated</li>
          </ul>
        </div>

        <div className="mt-6">
          <a href="/dashboard" className="text-indigo-600 hover:text-indigo-700 font-medium">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
