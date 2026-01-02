'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerGSTIN: string | null;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount?: number;
  balanceAmount?: number;
  paidDate?: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  isInterState: boolean;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGSTRModal, setShowGSTRModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [sendingPaymentLink, setSendingPaymentLink] = useState<string | null>(null);

  // Form state for creating invoice
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerName: '',
    customerGSTIN: '',
    amount: '',
    gstRate: '18',
    isInterState: false,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: '',
    placeOfSupply: ''
  });

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  const fetchInvoices = async () => {
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

      const url = `/api/invoices?companyId=${userCompanyId}${filter !== 'all' ? `&status=${filter}` : ''}`;
      const res = await fetch(url);
      
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId,
          amount: parseFloat(formData.amount),
          gstRate: parseInt(formData.gstRate)
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchInvoices();
        // Reset form
        setFormData({
          invoiceNumber: '',
          customerName: '',
          customerGSTIN: '',
          amount: '',
          gstRate: '18',
          isInterState: false,
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          items: '',
          placeOfSupply: ''
        });
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice');
    }
  };

  const handleGenerateGSTR1 = async () => {
    try {
      const res = await fetch(`/api/gst/reports?companyId=${companyId}&type=GSTR-1&month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        setShowGSTRModal(true);
        // Download JSON file
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GSTR-1_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Error generating GSTR-1:', error);
      alert('Failed to generate GSTR-1');
    }
  };

  const handleSendPaymentLink = async (invoice: Invoice) => {
    setSendingPaymentLink(invoice.id);
    
    try {
      const res = await fetch('/api/payments/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payment_link',
          companyId,
          invoiceId: invoice.id,
          customerInfo: {
            name: invoice.customerName,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(data.paymentLink);
          alert(`✅ Payment link created and copied to clipboard!\n\n💳 Amount: ₹${data.amount.toLocaleString()}\n🔗 Link: ${data.paymentLink}\n\nShare this link with ${invoice.customerName} via WhatsApp, Email, or SMS to collect payment.`);
        } catch (clipboardError) {
          alert(`✅ Payment link created!\n\n💳 Amount: ₹${data.amount.toLocaleString()}\n🔗 Link: ${data.paymentLink}\n\nShare this link with ${invoice.customerName} to collect payment.`);
        }
        
        fetchInvoices(); // Refresh list
      } else {
        const errorData = await res.json();
        if (errorData.error === 'Razorpay not configured') {
          alert(`⚠️ Razorpay Not Configured\n\n${errorData.message}\n\nPlease add your Razorpay credentials to the .env file:\n- RAZORPAY_KEY_ID\n- RAZORPAY_KEY_SECRET`);
        } else {
          alert(`❌ Failed: ${errorData.error}\n${errorData.message || ''}`);
        }
      }
    } catch (error) {
      console.error('Error creating payment link:', error);
      alert('Failed to create payment link due to network error');
    } finally {
      setSendingPaymentLink(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const balance = (selectedInvoice.balanceAmount !== undefined && selectedInvoice.balanceAmount !== null) 
      ? selectedInvoice.balanceAmount 
      : (selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0));

    if (amount > balance) {
      alert(`Payment amount (₹${amount.toLocaleString()}) cannot exceed balance due (₹${balance.toLocaleString()})`);
      return;
    }

    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          action: 'record_payment',
          paymentAmount: amount
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✅ ${data.message}\n💰 New Cash Balance: ₹${data.cashBalance.toLocaleString()}`);
        setShowPaymentModal(false);
        setSelectedInvoice(null);
        setPaymentAmount('');
        fetchInvoices();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-orange-100 text-orange-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-600'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoices & AR</h1>
            <p className="text-gray-600 mt-1">Manage invoices and track receivables</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateGSTR1}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate GSTR-1
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Invoice
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white md:col-span-2">
            <p className="text-sm opacity-90 mb-1">Total Accounts Receivable (AR)</p>
            <p className="text-3xl font-bold mb-2">
              ₹{invoices
                .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
                .reduce((sum, inv) => {
                  const balance = inv.balanceAmount !== undefined && inv.balanceAmount !== null 
                    ? inv.balanceAmount 
                    : (inv.totalAmount - (inv.paidAmount || 0));
                  return sum + balance;
                }, 0)
                .toLocaleString()}
            </p>
            <p className="text-xs opacity-75">
              Money customers owe you ({invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled').length} unpaid invoices)
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {invoices.filter(inv => inv.status === 'sent' || inv.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Paid</p>
            <p className="text-2xl font-bold text-green-600">
              {invoices.filter(inv => inv.status === 'paid').length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'draft', 'sent', 'partial', 'paid', 'overdue'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{invoice.customerName}</div>
                      {invoice.customerGSTIN && (
                        <div className="text-xs text-gray-500">{invoice.customerGSTIN}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div>{new Date(invoice.invoiceDate).toLocaleDateString()}</div>
                      {invoice.dueDate && (
                        <div className="text-xs text-gray-400">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₹{invoice.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    ₹{(invoice.paidAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                    ₹{((invoice.balanceAmount !== undefined && invoice.balanceAmount !== null) 
                      ? invoice.balanceAmount 
                      : (invoice.totalAmount - (invoice.paidAmount || 0))
                    ).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => handleSendPaymentLink(invoice)}
                            disabled={sendingPaymentLink === invoice.id}
                            className="text-blue-600 hover:text-blue-900 font-medium mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingPaymentLink === invoice.id ? (
                              <>⏳ Generating...</>
                            ) : (
                              <>💳 Send Payment Link</>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              const balance = (invoice.balanceAmount !== undefined && invoice.balanceAmount !== null) 
                                ? invoice.balanceAmount 
                                : (invoice.totalAmount - (invoice.paidAmount || 0));
                              setPaymentAmount(balance.toString());
                              setShowPaymentModal(true);
                            }}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            💰 Record Payment
                          </button>
                        </>
                      )}
                      {invoice.status === 'paid' && (
                        <span className="text-green-600">✓ Paid</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {invoices.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No invoices found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                Create your first invoice
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Invoice</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number *
                    </label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Date *
                    </label>
                    <input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer GSTIN
                  </label>
                  <input
                    type="text"
                    value={formData.customerGSTIN}
                    onChange={(e) => setFormData({ ...formData, customerGSTIN: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="27XXXXX1234X1Z5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (Before GST) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Rate (%) *
                    </label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isInterState}
                      onChange={(e) => setFormData({ ...formData, isInterState: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Inter-state supply (IGST)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Items / Description
                  </label>
                  <textarea
                    value={formData.items}
                    onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="List items or services provided..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create Invoice
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedInvoice(null);
                    setPaymentAmount('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Invoice: <span className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</span></p>
                  <p className="text-sm text-gray-600">Customer: <span className="font-semibold text-gray-900">{selectedInvoice.customerName}</span></p>
                  <p className="text-sm text-gray-600 mt-2">Total Amount: <span className="font-semibold text-gray-900">₹{selectedInvoice.totalAmount.toLocaleString()}</span></p>
                  <p className="text-sm text-gray-600">Already Paid: <span className="font-semibold text-green-600">₹{(selectedInvoice.paidAmount || 0).toLocaleString()}</span></p>
                  <p className="text-sm text-gray-600">Balance Due: <span className="font-semibold text-red-600">₹{((selectedInvoice.balanceAmount !== undefined && selectedInvoice.balanceAmount !== null) 
                    ? selectedInvoice.balanceAmount 
                    : (selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0))
                  ).toLocaleString()}</span></p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    You can enter a partial amount or the full balance
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedInvoice(null);
                      setPaymentAmount('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    💰 Record Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

