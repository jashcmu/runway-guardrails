'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import AuthGuard from '@/app/components/AuthGuard'

type Revenue = {
  id: string
  invoiceId: string | null
  amount: number
  date: string
  description: string
  gstRate: number
  gstAmount: number
  amountReceived: number
  status: string
  invoice?: {
    invoiceNumber: string
    customerName: string
  }
}

export default function RevenuePage() {
  return (
    <AuthGuard>
      <RevenueContent />
    </AuthGuard>
  )
}

function RevenueContent() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId')
  
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (!companyId) return

    const fetchRevenues = async () => {
      try {
        const url = statusFilter === 'all'
          ? `/api/revenue?companyId=${companyId}`
          : `/api/revenue?companyId=${companyId}&status=${statusFilter}`
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setRevenues(data.revenues)
        }
      } catch (error) {
        console.error('Failed to fetch revenues:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenues()
  }, [companyId, statusFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'pending': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0)
  const totalReceived = revenues.reduce((sum, r) => sum + r.amountReceived, 0)
  const totalOutstanding = totalRevenue - totalReceived

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">💰 Revenue Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track invoices, payments, and outstanding receivables
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-gray-900">
              ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">{revenues.length} invoices</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Amount Received</div>
            <div className="text-3xl font-bold text-green-600">
              ₹{totalReceived.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((totalReceived / totalRevenue) * 100 || 0).toFixed(1)}% collected
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">Outstanding</div>
            <div className="text-3xl font-bold text-red-600">
              ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">Accounts Receivable</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                statusFilter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({revenues.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                statusFilter === 'pending' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                statusFilter === 'partial' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Partial
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                statusFilter === 'paid' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Paid
            </button>
          </div>
        </div>

        {/* Revenue Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : revenues.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No revenue records found.</p>
            <p className="text-sm text-gray-400 mt-2">Create an invoice to track revenue.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Invoice / Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Received
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Outstanding
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {revenues.map((revenue) => {
                    const outstanding = revenue.amount - revenue.amountReceived
                    return (
                      <tr key={revenue.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(revenue.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-gray-900">
                            {revenue.invoice?.invoiceNumber || revenue.description}
                          </div>
                          {revenue.invoice && (
                            <div className="text-xs text-gray-500">
                              {revenue.invoice.customerName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          ₹{revenue.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                          ₹{revenue.amountReceived.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                          ₹{outstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(revenue.status)}`}>
                            {revenue.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



