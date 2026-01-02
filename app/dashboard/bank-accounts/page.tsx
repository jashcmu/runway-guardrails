'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

export default function BankAccountsPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedAccount, setSelectedAccount] = useState('');

  const [formData, setFormData] = useState({
    accountName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountType: 'savings',
    balance: ''
  });

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      
      // Get company ID from user's first company
      const userCompanyId = meData.user.companies && meData.user.companies.length > 0 
        ? meData.user.companies[0].id 
        : null;
      
      if (!userCompanyId) {
        router.push('/onboarding');
        return;
      }
      
      setCompanyId(userCompanyId);

      const res = await fetch(`/api/bank-accounts?companyId=${userCompanyId}`);
      if (res.ok) {
        const data = await res.json();
        setBankAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId,
          balance: parseFloat(formData.balance)
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        fetchBankAccounts();
        setFormData({
          accountName: '',
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          accountType: 'savings',
          balance: ''
        });
        alert('Bank account added successfully!');
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error adding bank account:', error);
      alert('Failed to add bank account');
    }
  };

  const handleUploadStatement = async () => {
    if (!uploadFile || !selectedAccount) {
      alert('Please select an account and choose a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('companyId', companyId);
    formData.append('bankAccountId', selectedAccount);

    try {
      const res = await fetch('/api/banks', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        
        // Show detailed success message
        const summary = data.summary;
        const message = `
✅ Bank Statement Processed Successfully!

📊 SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Transactions Created: ${summary.transactionsCreated}
📄 Bills Marked Paid: ${summary.billsMarkedPaid}
💵 Invoices Received: ${summary.invoicesMarkedPaid}

💰 CASH BALANCE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Change: ₹${summary.cashBalanceChange.toLocaleString()}
New Balance: ₹${summary.newCashBalance.toLocaleString()}

All transactions have been auto-categorized and synced with your AR/AP!
        `;
        
        alert(message);
        setUploadFile(null);
        setSelectedAccount('');
        // Refresh to show updated balance
        fetchBankAccounts();
        
        // Optionally redirect to transactions to see the imported data
        if (confirm('View imported transactions?')) {
          router.push('/dashboard/transactions');
        }
      } else {
        const data = await res.json();
        alert(`❌ Upload Failed

Error: ${data.error || 'Failed to upload statement'}

${data.details || data.hint || ''}

Tip: Make sure your CSV has these columns:
- Date (DD/MM/YYYY or YYYY-MM-DD)
- Description
- Debit (expenses/withdrawals)
- Credit (income/deposits)
- Balance (optional)`);
      }
    } catch (error) {
      console.error('Error uploading statement:', error);
      alert(`❌ Upload Failed

Error: ${error instanceof Error ? error.message : 'Network error'}

Please check:
1. Your internet connection
2. The server is running
3. The file format is correct (CSV)`);
    } finally {
      setUploading(false);
    }
  };

  const toggleAccount = async (accountId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          isActive: !isActive
        })
      });

      if (res.ok) {
        fetchBankAccounts();
      }
    } catch (error) {
      console.error('Error toggling account:', error);
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bank Accounts</h1>
            <p className="text-gray-600 mt-1">Manage your bank accounts and upload statements</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Bank Account
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Accounts</p>
            <p className="text-2xl font-bold text-gray-900">{bankAccounts.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Active Accounts</p>
            <p className="text-2xl font-bold text-green-600">
              {bankAccounts.filter(acc => acc.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Balance</p>
            <p className="text-2xl font-bold text-indigo-600">
              ₹{bankAccounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Upload Statement Section */}
        {bankAccounts.length > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upload Bank Statement</h2>
              <a
                href="/sample-bank-statement.csv"
                download
                className="px-3 py-1 bg-white text-indigo-600 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
              >
                📥 Download Sample CSV
              </a>
            </div>
            <p className="text-sm mb-4 opacity-90">
              Upload your bank statement CSV to auto-match bills & invoices, categorize expenses, and update cash balance & runway!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Account</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 rounded-lg focus:ring-2 focus:ring-white"
                >
                  <option value="">Choose an account...</option>
                  {bankAccounts.filter(acc => acc.isActive).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} - {account.bankName} (****{account.accountNumber.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Choose File (PDF or CSV)</label>
                <input
                  type="file"
                  accept=".pdf,.csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 text-gray-900 rounded-lg"
                />
              </div>
            </div>
            {uploadFile && selectedAccount && (
              <button
                onClick={handleUploadStatement}
                disabled={uploading}
                className="mt-4 px-6 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium disabled:opacity-50"
              >
                {uploading ? 'Processing...' : 'Upload & Process Statement'}
              </button>
            )}
          </div>
        )}

        {/* Bank Accounts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bankAccounts.map((account) => (
            <div key={account.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{account.accountName}</h3>
                  <p className="text-sm text-gray-600">{account.bankName}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  account.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {account.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Account Number</span>
                  <span className="font-medium text-gray-900">****{account.accountNumber.slice(-4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IFSC Code</span>
                  <span className="font-medium text-gray-900">{account.ifscCode}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Type</span>
                  <span className="font-medium text-gray-900 capitalize">{account.accountType}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-gray-600">Balance</span>
                  <span className="font-bold text-indigo-600">₹{account.balance.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => toggleAccount(account.id, account.isActive)}
                className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  account.isActive
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {account.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>

        {bankAccounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No bank accounts added yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
              Add your first bank account
            </button>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add Bank Account</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    placeholder="e.g., Main Business Account"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g., HDFC Bank"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Type *
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                      <option value="overdraft">Overdraft</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="Enter account number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                      placeholder="e.g., HDFC0001234"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Balance *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


