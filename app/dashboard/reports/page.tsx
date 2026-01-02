'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';

interface ReportCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  reports: Report[];
}

interface Report {
  id: string;
  name: string;
  description: string;
  type: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [reportTitle, setReportTitle] = useState('');

  useEffect(() => {
    const fetchData = async () => {
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
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const reportCategories: ReportCategory[] = [
    {
      id: 'financial',
      name: 'Financial Reports',
      description: 'Balance sheets, P&L, cash flow statements',
      icon: '💰',
      reports: [
        { id: 'balance-sheet', name: 'Balance Sheet', description: 'Assets, Liabilities, Equity', type: 'financial' },
        { id: 'pl', name: 'Profit & Loss', description: 'Income statement', type: 'financial' },
        { id: 'cashflow', name: 'Cash Flow Statement', description: 'Operating, investing, financing activities', type: 'financial' },
        { id: 'trial-balance', name: 'Trial Balance', description: 'All account balances', type: 'financial' },
        { id: 'ledger', name: 'General Ledger', description: 'All journal entries', type: 'financial' }
      ]
    },
    {
      id: 'compliance',
      name: 'Compliance Reports',
      description: 'GST, TDS, PF/ESI reports',
      icon: '📋',
      reports: [
        { id: 'gstr1', name: 'GSTR-1', description: 'Outward supplies', type: 'compliance' },
        { id: 'gstr3b', name: 'GSTR-3B', description: 'Monthly return', type: 'compliance' },
        { id: 'tds-quarterly', name: 'TDS Quarterly', description: 'TDS deductions report', type: 'compliance' },
        { id: 'pf-monthly', name: 'PF Monthly', description: 'PF contributions', type: 'compliance' },
        { id: 'esi-monthly', name: 'ESI Monthly', description: 'ESI contributions', type: 'compliance' }
      ]
    },
    {
      id: 'operational',
      name: 'Operational Reports',
      description: 'Vendors, purchases, inventory',
      icon: '📊',
      reports: [
        { id: 'vendor-aging', name: 'Vendor Aging', description: 'Outstanding payables by age', type: 'operational' },
        { id: 'customer-aging', name: 'Customer Aging', description: 'Outstanding receivables by age', type: 'operational' },
        { id: 'purchase-register', name: 'Purchase Register', description: 'All purchases', type: 'operational' },
        { id: 'sales-register', name: 'Sales Register', description: 'All sales', type: 'operational' },
        { id: 'expense-by-category', name: 'Expense by Category', description: 'Category-wise spending', type: 'operational' }
      ]
    },
    {
      id: 'analytics',
      name: 'Analytics & Insights',
      description: 'Trends, forecasts, benchmarks',
      icon: '📈',
      reports: [
        { id: 'runway-analysis', name: 'Runway Analysis', description: 'Cash runway projections', type: 'analytics' },
        { id: 'burn-rate', name: 'Burn Rate Trend', description: 'Monthly burn analysis', type: 'analytics' },
        { id: 'revenue-trends', name: 'Revenue Trends', description: 'Revenue growth analysis', type: 'analytics' },
        { id: 'vendor-spend', name: 'Vendor Spend Analysis', description: 'Top vendors by spend', type: 'analytics' },
        { id: 'benchmarks', name: 'Industry Benchmarks', description: 'Compare with peers', type: 'analytics' }
      ]
    }
  ];

  const handleGenerateReport = async (reportId: string, reportType: string, reportName: string) => {
    try {
      setLoading(true);
      let url = '';
      
      switch (reportType) {
        case 'financial':
          url = `/api/reports/accounting?companyId=${companyId}&type=${reportId}`;
          break;
        case 'compliance':
          const month = new Date().getMonth() + 1;
          const year = new Date().getFullYear();
          url = `/api/gst/reports?companyId=${companyId}&type=${reportId.toUpperCase()}&month=${month}&year=${year}`;
          break;
        case 'operational':
        case 'analytics':
          // For now, show sample data
          alert(`${reportName} will be available soon! The backend API is ready.`);
          setLoading(false);
          return;
      }

      const res = await fetch(url, {
        method: reportType === 'compliance' ? 'POST' : 'GET'
      });

      if (res.ok) {
        const data = await res.json();
        
        // Show report in modal
        setCurrentReport(data);
        setReportTitle(reportName);
        setShowReportModal(true);
        
        // Also offer download
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${reportId}_${new Date().toISOString().split('T')[0]}.json`;
        // Don't auto-click, let user download from modal if needed
      } else {
        const error = await res.json();
        alert(`Failed to generate report: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to generate report'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const filteredCategories = selectedCategory === 'all'
    ? reportCategories
    : reportCategories.filter(cat => cat.id === selectedCategory);

  if (loading && !companyId) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports Center</h1>
          <p className="text-gray-600 mt-1">Generate comprehensive financial, compliance, and operational reports</p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Reports
          </button>
          {reportCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>

        {/* Report Categories */}
        <div className="space-y-8">
          {filteredCategories.map((category) => (
            <div key={category.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{category.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.reports.map((report) => (
                    <div
                      key={report.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                    >
                      <h3 className="font-semibold text-gray-900 mb-1">{report.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">{report.description}</p>
                      <button
                        onClick={() => handleGenerateReport(report.id, report.type, report.name)}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Generating...' : 'Generate Report'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-2">Need Custom Reports?</h3>
          <p className="mb-4 text-indigo-100">Schedule automated reports or create custom report templates</p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/reports/schedule')}
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
            >
              Schedule Reports
            </button>
            <button
              onClick={() => router.push('/dashboard/reports/custom')}
              className="px-4 py-2 bg-indigo-400 text-white rounded-lg hover:bg-indigo-300 transition-colors font-medium"
            >
              Create Custom Report
            </button>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recently Generated</h3>
          <div className="space-y-3">
            {[
              { name: 'Balance Sheet', date: '2024-01-15', size: '245 KB' },
              { name: 'GSTR-1', date: '2024-01-10', size: '189 KB' },
              { name: 'Vendor Aging', date: '2024-01-08', size: '312 KB' }
            ].map((report, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{report.name}</p>
                    <p className="text-xs text-gray-500">{report.date} • {report.size}</p>
                  </div>
                </div>
                <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Report Viewer Modal */}
        {showReportModal && currentReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">{reportTitle}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadReport}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      Download JSON
                    </button>
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(currentReport, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
