'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import RunwayWidget from '@/app/components/RunwayWidget';
import FinancialHealthWidget from '@/app/components/FinancialHealthWidget';
import CashFlowPrediction from '@/app/components/CashFlowPrediction';
import BenchmarkWidget from '@/app/components/BenchmarkWidget';

export default function UnifiedDashboard() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingBills: 0,
    pendingInvoices: 0,
    subscriptionsRenewing: 0,
    overduePayments: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    activeVendors: 0,
    activeCustomers: 0
  });
  const [runwayData, setRunwayData] = useState({
    runway: null as number | null,
    cashBalance: 0,
    monthlyBurn: 0,
    targetMonths: null as number | null
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const meData = await meRes.json();
        setCompanyId(meData.companyId);

        // Fetch dashboard stats
        const statsRes = await fetch(`/api/dashboard/unified?companyId=${meData.companyId}`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        
        // Fetch runway data
        const dashboardRes = await fetch(`/api/dashboard?companyId=${meData.companyId}`);
        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          setRunwayData({
            runway: dashboardData.runway || null,
            cashBalance: dashboardData.cashBalance || 0,
            monthlyBurn: dashboardData.monthlyBurn || 0,
            targetMonths: dashboardData.targetMonths || null
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">Loading your dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            All-in-One Financial Platform
          </h1>
          <p className="text-gray-600">
            Complete visibility into your startup's finances, operations, and compliance
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Pending Bills */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Bills</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingBills}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <button 
              onClick={() => router.push('/dashboard/bills')}
              className="mt-4 text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Review Bills →
            </button>
          </div>

          {/* Pending Invoices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Invoices</p>
                <p className="text-3xl font-bold text-blue-600">{stats.pendingInvoices}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
            </div>
            <button 
              onClick={() => router.push('/dashboard/invoices')}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Invoices →
            </button>
          </div>

          {/* Subscriptions Renewing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Renewing Soon</p>
                <p className="text-3xl font-bold text-purple-600">{stats.subscriptionsRenewing}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            <button 
              onClick={() => router.push('/dashboard/subscriptions')}
              className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Manage Subscriptions →
            </button>
          </div>

          {/* Overdue Payments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Overdue Payments</p>
                <p className="text-3xl font-bold text-red-600">{stats.overduePayments}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <button 
              onClick={() => router.push('/dashboard/payments')}
              className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              View Overdue →
            </button>
          </div>
        </div>

        {/* Main Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Runway Widget - Spans 2 columns */}
          <div className="lg:col-span-2">
            <RunwayWidget 
              runway={runwayData.runway}
              cashBalance={runwayData.cashBalance}
              monthlyBurn={runwayData.monthlyBurn}
              targetMonths={runwayData.targetMonths}
            />
          </div>

          {/* Financial Health */}
          <div>
            <FinancialHealthWidget companyId={companyId} />
          </div>
        </div>

        {/* Feature Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Accounts Payable */}
          <div 
            onClick={() => router.push('/dashboard/bills')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <div className="bg-orange-100 p-3 rounded-lg group-hover:bg-orange-200 transition-colors">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">Accounts Payable</h3>
                <p className="text-sm text-gray-600">Bill management & payments</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Bills</span>
                <span className="font-semibold text-gray-900">{stats.pendingBills}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Vendors</span>
                <span className="font-semibold text-gray-900">{stats.activeVendors}</span>
              </div>
            </div>
          </div>

          {/* Accounts Receivable */}
          <div 
            onClick={() => router.push('/dashboard/invoices')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">Accounts Receivable</h3>
                <p className="text-sm text-gray-600">Invoice & revenue tracking</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Outstanding</span>
                <span className="font-semibold text-gray-900">{stats.pendingInvoices}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-semibold text-gray-900">₹{(stats.totalRevenue / 100000).toFixed(1)}L</span>
              </div>
            </div>
          </div>

          {/* Subscriptions */}
          <div 
            onClick={() => router.push('/dashboard/subscriptions')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">Subscriptions</h3>
                <p className="text-sm text-gray-600">Recurring revenue tracking</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Renewing Soon</span>
                <span className="font-semibold text-gray-900">{stats.subscriptionsRenewing}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Customers</span>
                <span className="font-semibold text-gray-900">{stats.activeCustomers}</span>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div 
            onClick={() => router.push('/dashboard/compliance')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">Compliance</h3>
                <p className="text-sm text-gray-600">GST, TDS, PF/ESI</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST Due</span>
                <span className="font-semibold text-yellow-600">15 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="font-semibold text-green-600">Up to date</span>
              </div>
            </div>
          </div>

          {/* Purchase Orders */}
          <div 
            onClick={() => router.push('/dashboard/purchase-orders')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <div className="bg-indigo-100 p-3 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">Purchase Orders</h3>
                <p className="text-sm text-gray-600">Procurement workflow</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Open POs</span>
                <span className="font-semibold text-gray-900">5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">In Transit</span>
                <span className="font-semibold text-gray-900">2</span>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div 
            onClick={() => router.push('/dashboard/documents')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <div className="bg-gray-100 p-3 rounded-lg group-hover:bg-gray-200 transition-colors">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">Documents</h3>
                <p className="text-sm text-gray-600">Central repository</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Files</span>
                <span className="font-semibold text-gray-900">47</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Storage Used</span>
                <span className="font-semibold text-gray-900">2.4 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow & Benchmarks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CashFlowPrediction companyId={companyId} />
          <BenchmarkWidget companyId={companyId} />
        </div>
      </div>
    </div>
  );
}

