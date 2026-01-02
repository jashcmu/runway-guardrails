// Financial Overview Widget - Shows Cash, AR, AP, Working Capital
'use client';

import { useEffect, useState } from 'react';

interface FinancialOverview {
  cashBalance: number;
  accountsReceivable: number; // AR - Money owed TO you
  accountsPayable: number;     // AP - Money you OWE
  workingCapital: number;
  netCashFlow: number;
}

export default function FinancialOverviewWidget({ companyId }: { companyId: string }) {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, [companyId]);

  const fetchFinancialData = async () => {
    try {
      const res = await fetch(`/api/dashboard/financial-overview?companyId=${companyId}`);
      if (res.ok) {
        const overview = await res.json();
        setData(overview);
      }
    } catch (error) {
      console.error('Error fetching financial overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">💰 Financial Position</h3>
      
      <div className="space-y-4">
        {/* Cash Balance */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-600">Cash Balance</p>
            <p className="text-xs text-gray-500 mt-0.5">Available funds</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              ₹{(data.cashBalance / 100000).toFixed(2)}L
            </p>
            <p className="text-xs text-gray-500">₹{data.cashBalance.toLocaleString()}</p>
          </div>
        </div>

        {/* Accounts Receivable (AR) */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-600">Accounts Receivable (AR)</p>
            <p className="text-xs text-green-600 mt-0.5">Money owed to you</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-green-600">
              +₹{(data.accountsReceivable / 100000).toFixed(2)}L
            </p>
            <p className="text-xs text-gray-500">₹{data.accountsReceivable.toLocaleString()}</p>
          </div>
        </div>

        {/* Accounts Payable (AP) */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-600">Accounts Payable (AP)</p>
            <p className="text-xs text-red-600 mt-0.5">Money you owe</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-red-600">
              -₹{(data.accountsPayable / 100000).toFixed(2)}L
            </p>
            <p className="text-xs text-gray-500">₹{data.accountsPayable.toLocaleString()}</p>
          </div>
        </div>

        {/* Working Capital */}
        <div className="flex items-center justify-between pt-3 bg-indigo-50 rounded-lg p-3">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Working Capital</p>
            <p className="text-xs text-indigo-600 mt-0.5">Cash + AR - AP</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${data.workingCapital >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
              ₹{(data.workingCapital / 100000).toFixed(2)}L
            </p>
            <p className="text-xs text-indigo-600">₹{data.workingCapital.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-6 flex gap-2">
        <a
          href="/dashboard/invoices"
          className="flex-1 text-center px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
        >
          View AR
        </a>
        <a
          href="/dashboard/bills"
          className="flex-1 text-center px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
        >
          View AP
        </a>
      </div>

      {/* Explanation */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
        <p className="font-semibold mb-1">Understanding Your Finances:</p>
        <ul className="space-y-1">
          <li>• <strong>Cash</strong>: Money in your bank accounts</li>
          <li>• <strong>AR</strong>: Invoices sent but not paid yet</li>
          <li>• <strong>AP</strong>: Bills received but not paid yet</li>
          <li>• <strong>Working Capital</strong>: Your net liquid position</li>
        </ul>
      </div>
    </div>
  );
}


