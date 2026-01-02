'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/app/components/Navigation'

type Company = {
  id: string
  name: string
  createdAt: string
}

export default function SettingsPage() {
  const [companyId, setCompanyId] = useState('')
  const [company, setCompany] = useState<Company | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')

  useEffect(() => {
    fetchCompanyAndData()
  }, [])

  const fetchCompanyAndData = async () => {
    try {
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) {
        window.location.href = '/login'
        return
      }
      const meData = await meRes.json()
      
      const userCompanyId = meData.user.companies && meData.user.companies.length > 0 
        ? meData.user.companies[0].id 
        : null
      
      if (userCompanyId) {
        setCompanyId(userCompanyId)
        await fetchCompany(userCompanyId)
      }
      
      await fetchCompanies()
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompany = async (cId: string) => {
    if (!cId) return
    try {
      const response = await fetch(`/api/companies?companyId=${encodeURIComponent(cId)}`)
      if (response.ok) {
        const result = await response.json()
        setCompany(result.company)
        setEditName(result.company.name)
      }
    } catch (err) {
      console.error('Failed to fetch company:', err)
    }
  }

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies')
      if (response.ok) {
        const result = await response.json()
        setCompanies(result.companies || [])
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    }
  }

  const handleUpdate = async () => {
    if (!companyId || !editName) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, name: editName }),
      })

      if (response.ok) {
        alert('Company updated successfully')
        await fetchCompany(companyId)
        await fetchCompanies()
      } else {
        const errorData = await response.json()
        alert(`Failed to update: ${errorData.error}`)
      }
    } catch (err) {
      alert('Error updating company')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!companyId) return
    if (!confirm('Are you sure? This will delete all company data including transactions, budgets, and alerts.')) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/companies?companyId=${encodeURIComponent(companyId)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('Company deleted successfully')
        window.location.href = '/dashboard'
      } else {
        const errorData = await response.json()
        alert(`Failed to delete: ${errorData.error}`)
      }
    } catch (err) {
      alert('Error deleting company')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newCompanyName) {
      alert('Company name is required')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName }),
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Company created successfully! ID: ${result.company.id}`)
        setNewCompanyName('')
        setShowCreate(false)
        fetchCompanies()
      } else {
        const errorData = await response.json()
        alert(`Failed to create: ${errorData.error}`)
      }
    } catch (err) {
      alert('Error creating company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">⚙️ Settings</h1>

        {/* Current Company Management */}
        {companyId && company ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Company</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company ID</label>
              <input
                type="text"
                value={company.id}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
              <input
                type="text"
                value={new Date(company.createdAt).toLocaleString('en-IN')}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                disabled={loading || editName === company.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Updating...' : 'Update Company'}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
              >
                Delete Company
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">No company selected. Add companyId to URL or create a new company below.</p>
          </div>
        )}

        {/* Create New Company */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Create New Company</h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="text-blue-600 hover:text-blue-800"
            >
              {showCreate ? 'Cancel' : '+ New Company'}
            </button>
          </div>

          {showCreate && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter company name"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={loading || !newCompanyName}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Company'}
              </button>
            </div>
          )}
        </div>

        {/* All Companies List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Companies</h2>
          
          {companies.length === 0 ? (
            <p className="text-gray-500">No companies found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map((comp) => (
                    <tr key={comp.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {comp.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {comp.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(comp.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={`/dashboard?companyId=${comp.id}&cashBalance=0`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Dashboard
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

