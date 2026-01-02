'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';

interface ComplianceData {
  gst: {
    gstr1Status: string;
    gstr3bStatus: string;
    nextDueDate: string;
    daysRemaining: number;
    totalGSTLiability: number;
  };
  tds: {
    quarterlyDue: string;
    totalTDSDeducted: number;
    pendingReturns: number;
    nextReturnDate: string;
  };
  pfEsi: {
    pfDue: string;
    esiDue: string;
    totalPFContribution: number;
    totalESIContribution: number;
  };
  overall: {
    complianceScore: number;
    criticalItems: number;
    upcomingDeadlines: number;
  };
}

export default function ComplianceDashboard() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      
      const userCompanyId = meData.user.companies && meData.user.companies.length > 0 
        ? meData.user.companies[0].id 
        : null;
      
      if (!userCompanyId) {
        router.push('/onboarding');
        return;
      }
      
      setCompanyId(userCompanyId);

      const res = await fetch(`/api/compliance?companyId=${userCompanyId}`);
      if (res.ok) {
        const data = await res.json();
        setComplianceData(data);
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGSTR1 = async () => {
    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      
      const res = await fetch(`/api/gst/reports?companyId=${companyId}&type=GSTR-1&month=${month}&year=${year}`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        // Download JSON
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GSTR-1_${month}_${year}.json`;
        a.click();
        alert('GSTR-1 generated successfully!');
      }
    } catch (error) {
      console.error('Error generating GSTR-1:', error);
      alert('Failed to generate GSTR-1');
    }
  };

  const handleGenerateGSTR3B = async () => {
    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      
      const res = await fetch(`/api/gst/reports?companyId=${companyId}&type=GSTR-3B&month=${month}&year=${year}`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GSTR-3B_${month}_${year}.json`;
        a.click();
        alert('GSTR-3B generated successfully!');
      }
    } catch (error) {
      console.error('Error generating GSTR-3B:', error);
      alert('Failed to generate GSTR-3B');
    }
  };

  const getComplianceScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      filed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      'not-required': 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
        {status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!complianceData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-600">Failed to load compliance data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
          <p className="text-gray-600 mt-1">GST, TDS, PF/ESI compliance tracking and reporting</p>
        </div>

        {/* Compliance Score Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Overall Compliance Score</h2>
              <p className="text-indigo-100">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold mb-2">
                {complianceData.overall.complianceScore}
              </div>
              <div className="text-indigo-100">out of 100</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm text-indigo-100 mb-1">Critical Items</p>
              <p className="text-2xl font-bold">{complianceData.overall.criticalItems}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm text-indigo-100 mb-1">Upcoming Deadlines</p>
              <p className="text-2xl font-bold">{complianceData.overall.upcomingDeadlines}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm text-indigo-100 mb-1">Status</p>
              <p className="text-2xl font-bold">
                {complianceData.overall.complianceScore >= 90 ? '✓ Good' : 
                 complianceData.overall.complianceScore >= 70 ? '⚠ Warning' : '✗ Critical'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['overview', 'gst', 'tds', 'pf-esi'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.split('-').map(word => word.toUpperCase()).join('/')}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* GST Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">GST Returns</h3>
                <div className="bg-green-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">GSTR-1</span>
                  {getStatusBadge(complianceData.gst.gstr1Status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">GSTR-3B</span>
                  {getStatusBadge(complianceData.gst.gstr3bStatus)}
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 mb-1">Next Due Date</p>
                  <p className="text-lg font-bold text-gray-900">{complianceData.gst.nextDueDate}</p>
                  <p className="text-xs text-orange-600 mt-1">{complianceData.gst.daysRemaining} days remaining</p>
                </div>
              </div>
              
              <button
                onClick={() => setActiveTab('gst')}
                className="mt-4 w-full px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
              >
                View GST Details →
              </button>
            </div>

            {/* TDS Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">TDS Returns</h3>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Quarterly Due</span>
                  <span className="text-sm font-medium text-gray-900">{complianceData.tds.quarterlyDue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Pending Returns</span>
                  <span className="text-sm font-bold text-yellow-600">{complianceData.tds.pendingReturns}</span>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 mb-1">Total Deducted (YTD)</p>
                  <p className="text-lg font-bold text-gray-900">₹{complianceData.tds.totalTDSDeducted.toLocaleString()}</p>
                </div>
              </div>
              
              <button
                onClick={() => setActiveTab('tds')}
                className="mt-4 w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                View TDS Details →
              </button>
            </div>

            {/* PF/ESI Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">PF & ESI</h3>
                <div className="bg-purple-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">PF Due Date</span>
                  <span className="text-sm font-medium text-gray-900">{complianceData.pfEsi.pfDue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ESI Due Date</span>
                  <span className="text-sm font-medium text-gray-900">{complianceData.pfEsi.esiDue}</span>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 mb-1">Total Contributions (MTD)</p>
                  <p className="text-lg font-bold text-gray-900">
                    ₹{(complianceData.pfEsi.totalPFContribution + complianceData.pfEsi.totalESIContribution).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setActiveTab('pf-esi')}
                className="mt-4 w-full px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
              >
                View PF/ESI Details →
              </button>
            </div>
          </div>
        )}

        {/* GST Tab */}
        {activeTab === 'gst' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">GST Returns & Compliance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">GSTR-1 (Outward Supplies)</h4>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      {getStatusBadge(complianceData.gst.gstr1Status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Due Date</span>
                      <span className="text-sm font-medium">{complianceData.gst.nextDueDate}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateGSTR1}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Generate GSTR-1
                  </button>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">GSTR-3B (Monthly Return)</h4>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      {getStatusBadge(complianceData.gst.gstr3bStatus)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Liability</span>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{complianceData.gst.totalGSTLiability.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateGSTR3B}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Generate GSTR-3B
                  </button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Important Notes</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>GSTR-1 must be filed by 11th of next month</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>GSTR-3B must be filed by 20th of next month</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>Late filing attracts penalty of ₹50/day (₹20/day for nil returns)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TDS Tab */}
        {activeTab === 'tds' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">TDS Management</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Deducted (YTD)</p>
                <p className="text-2xl font-bold text-gray-900">₹{complianceData.tds.totalTDSDeducted.toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Pending Returns</p>
                <p className="text-2xl font-bold text-yellow-600">{complianceData.tds.pendingReturns}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Next Return Date</p>
                <p className="text-2xl font-bold text-gray-900">{complianceData.tds.nextReturnDate}</p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-3">TDS Sections</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">194J - Professional Services</p>
                    <p className="text-sm text-gray-600">10% on payments to contractors</p>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                    Calculate →
                  </button>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">194C - Contractor Payments</p>
                    <p className="text-sm text-gray-600">1-2% on contractor payments</p>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                    Calculate →
                  </button>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">194H - Commission Payments</p>
                    <p className="text-sm text-gray-600">5% on commission & brokerage</p>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                    Calculate →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PF/ESI Tab */}
        {activeTab === 'pf-esi' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Provident Fund (PF)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Due Date</p>
                  <p className="text-lg font-bold text-gray-900">{complianceData.pfEsi.pfDue}</p>
                  <p className="text-xs text-gray-500 mt-1">15th of every month</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Contribution (MTD)</p>
                  <p className="text-lg font-bold text-gray-900">₹{complianceData.pfEsi.totalPFContribution.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">12% employer + 12% employee</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Employee State Insurance (ESI)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Due Date</p>
                  <p className="text-lg font-bold text-gray-900">{complianceData.pfEsi.esiDue}</p>
                  <p className="text-xs text-gray-500 mt-1">21st of every month</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Contribution (MTD)</p>
                  <p className="text-lg font-bold text-gray-900">₹{complianceData.pfEsi.totalESIContribution.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">3.25% employer + 0.75% employee</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

