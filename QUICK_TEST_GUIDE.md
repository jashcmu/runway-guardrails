# 🚀 Quick Test Guide - New Features

## Prerequisites

1. Server is running: `npm run dev`
2. You're logged in to the dashboard
3. You have a company created

---

## Test 1: Upload Bank Statement (EASIEST)

### Steps:

1. **Go to:** http://localhost:3000/dashboard/bank-accounts

2. **Click:** "Upload Bank Statement"

3. **Select:** The sample file at `public/comprehensive-bank-statement.csv`

4. **Click:** "Process Statement"

### Expected Results:

✅ Success message showing:
- Transactions created
- New cash balance
- Invoices/bills created

✅ Dashboard updates automatically:
- Cash balance changes
- AR/AP updated
- Runway recalculated

### How to Verify:

```javascript
// Open browser console (F12) and run:
fetch('/api/transactions?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => console.log('Transactions:', data))

fetch('/api/invoices?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => console.log('Invoices:', data))

fetch('/api/bills?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => console.log('Bills:', data))
```

---

## Test 2: Check Subscriptions Auto-Detection

### Steps:

1. After uploading bank statement from Test 1

2. **Run in browser console:**

```javascript
// Get your company ID first
const companyId = 'YOUR_COMPANY_ID' // Get from /api/auth/me

// Check subscriptions
fetch(`/api/subscriptions?companyId=${companyId}`)
  .then(r => r.json())
  .then(data => console.log('📊 Subscriptions:', data))
```

### Expected Results:

✅ Should see subscriptions detected from bank statement:
- AWS Cloud Services (monthly)
- SaaS tools
- Any recurring payments

---

## Test 3: Test Overdue Tracking

### Steps:

1. **Create a test invoice with past due date:**

```javascript
fetch('/api/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    companyId: 'YOUR_COMPANY_ID',
    invoiceNumber: 'INV-TEST-001',
    customerName: 'Test Customer',
    amount: 50000,
    gstRate: 18,
    invoiceDate: '2024-11-01', // 2 months ago
    dueDate: '2024-11-15',     // Past due date
  })
}).then(r => r.json()).then(data => console.log('Invoice created:', data))
```

2. **Run overdue check:**

```javascript
fetch(`/api/overdue?companyId=YOUR_COMPANY_ID&action=check`)
  .then(r => r.json())
  .then(data => {
    console.log('🚨 Overdue Invoices:', data.overdueInvoices)
    console.log('📊 Total Overdue AR:', data.totalOverdueAR)
    console.log('🔔 Alerts Created:', data.alertsCreated)
  })
```

### Expected Results:

✅ Should show:
- Invoice INV-TEST-001 as overdue
- Number of days overdue (45+ days)
- Alert created (high/critical severity)

3. **Check aging report:**

```javascript
fetch(`/api/overdue?companyId=YOUR_COMPANY_ID&action=aging`)
  .then(r => r.json())
  .then(data => {
    console.log('📊 AR Aging:', data.ar)
    console.log('📊 AP Aging:', data.ap)
  })
```

---

## Test 4: Generate Financial Reports

### Steps:

1. **Generate Profit & Loss:**

```javascript
const startDate = '2024-01-01'
const endDate = '2024-12-31'

fetch(`/api/reports/financial?companyId=YOUR_COMPANY_ID&type=profit-loss&startDate=${startDate}&endDate=${endDate}`)
  .then(r => r.json())
  .then(data => {
    console.log('📊 P&L Report')
    console.log('Revenue:', data.revenue.total)
    console.log('Expenses:', data.expenses.total)
    console.log('Net Profit:', data.netProfit)
    console.log('Profit Margin:', data.profitMargin + '%')
  })
```

2. **Generate Balance Sheet:**

```javascript
fetch(`/api/reports/financial?companyId=YOUR_COMPANY_ID&type=balance-sheet&endDate=2024-12-31`)
  .then(r => r.json())
  .then(data => {
    console.log('🏦 Balance Sheet')
    console.log('Assets:', data.assets.total)
    console.log('  - Cash:', data.assets.current.cash)
    console.log('  - AR:', data.assets.current.accountsReceivable)
    console.log('Liabilities:', data.liabilities.total)
    console.log('  - AP:', data.liabilities.current.accountsPayable)
    console.log('Equity:', data.equity.total)
    
    // Verify it balances
    const check = data.assets.total - data.totalLiabilitiesAndEquity
    console.log('Balance Check:', Math.abs(check) < 1 ? '✅ BALANCED' : '❌ NOT BALANCED')
  })
```

3. **Generate Cash Flow Statement:**

```javascript
fetch(`/api/reports/financial?companyId=YOUR_COMPANY_ID&type=cash-flow&startDate=2024-01-01&endDate=2024-12-31`)
  .then(r => r.json())
  .then(data => {
    console.log('💸 Cash Flow Statement')
    console.log('Operating Cash Flow:', data.operating.netCashFromOperating)
    console.log('Opening Cash:', data.openingCash)
    console.log('Closing Cash:', data.closingCash)
    console.log('Net Change:', data.netCashChange)
  })
```

4. **Generate ALL Reports at Once:**

```javascript
fetch(`/api/reports/financial?companyId=YOUR_COMPANY_ID&type=all&startDate=2024-01-01&endDate=2024-12-31`)
  .then(r => r.json())
  .then(data => {
    console.log('📦 Complete Financial Package')
    console.log('P&L:', data.profitLoss)
    console.log('Balance Sheet:', data.balanceSheet)
    console.log('Cash Flow:', data.cashFlow)
    console.log('Generated at:', data.generatedAt)
  })
```

---

## Test 5: Test Razorpay Integration (Optional - Requires Razorpay Account)

### Setup:

1. Sign up at https://razorpay.com
2. Get test credentials
3. Add to `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```
4. Restart server

### Steps:

1. **Get an invoice ID:**

```javascript
fetch('/api/invoices?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => console.log('Invoices:', data.invoices))
// Copy an invoice ID from the response
```

2. **Create payment link:**

```javascript
fetch('/api/payments/razorpay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'create_payment_link',
    companyId: 'YOUR_COMPANY_ID',
    invoiceId: 'INVOICE_ID_FROM_ABOVE',
    customerInfo: {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '+919876543210'
    }
  })
}).then(r => r.json()).then(data => {
  console.log('✅ Payment Link Created!')
  console.log('Link:', data.paymentLink)
  // Open this link in browser to test payment
  window.open(data.paymentLink, '_blank')
})
```

3. **Test payment:**
- Open the payment link
- Use Razorpay test cards (https://razorpay.com/docs/payments/payments/test-card-details/)
- Complete payment
- Check if webhook received (check server logs)
- Verify invoice marked as paid

---

## Test 6: Test Partial Payments

### Steps:

1. **Create an invoice:**

```javascript
fetch('/api/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    companyId: 'YOUR_COMPANY_ID',
    invoiceNumber: 'INV-PARTIAL-001',
    customerName: 'Test Customer',
    amount: 100000,
    gstRate: 18,
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString()
  })
}).then(r => r.json()).then(data => {
  console.log('Invoice created:', data.invoice)
  window.invoiceId = data.invoice.id // Save for next step
})
```

2. **Record first partial payment (50%):**

```javascript
fetch('/api/invoices', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'record_payment',
    invoiceId: window.invoiceId,
    paymentAmount: 50000 // Pay ₹50,000 of ₹118,000 total
  })
}).then(r => r.json()).then(data => {
  console.log('First payment recorded:', data)
  console.log('Status:', data.invoice.status) // Should be 'partial'
  console.log('Balance:', data.invoice.balanceAmount) // Should be ~68,000
})
```

3. **Record second partial payment (remaining):**

```javascript
fetch('/api/invoices', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'record_payment',
    invoiceId: window.invoiceId,
    paymentAmount: 68000 // Pay remaining balance
  })
}).then(r => r.json()).then(data => {
  console.log('Final payment recorded:', data)
  console.log('Status:', data.invoice.status) // Should be 'paid'
  console.log('Balance:', data.invoice.balanceAmount) // Should be 0
})
```

---

## Test 7: Check Smart Classification

### Steps:

1. **Upload bank statement with various transactions**

2. **Check how they were classified:**

```javascript
fetch('/api/transactions?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => {
    const transactions = data.transactions
    
    // Group by category
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1
      return acc
    }, {})
    
    console.log('📊 Classification Results:')
    console.log(byCategory)
    
    // Show some examples
    console.log('\n📝 Sample Transactions:')
    transactions.slice(0, 10).forEach(t => {
      console.log(`${t.description} → ${t.category}`)
    })
  })
```

3. **Check recurring expenses:**

```javascript
fetch('/api/expenses/recurring?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => {
    console.log('🔁 Recurring Expenses:')
    data.recurringExpenses?.forEach(exp => {
      console.log(`${exp.description}: ₹${exp.amount} (${exp.frequency})`)
    })
  })
```

---

## Quick Verification Script (Run All Tests)

Copy this into your browser console:

```javascript
// ========================================
// COMPLETE TEST SUITE
// ========================================

const companyId = 'YOUR_COMPANY_ID' // UPDATE THIS!

async function runAllTests() {
  console.log('🚀 Starting Test Suite...\n')
  
  // Test 1: Get Dashboard Data
  console.log('📊 Test 1: Dashboard Data')
  const dashboard = await fetch(`/api/dashboard/unified?companyId=${companyId}`).then(r => r.json())
  console.log('Cash Balance:', dashboard.cashBalance)
  console.log('AR:', dashboard.accountsReceivable)
  console.log('AP:', dashboard.accountsPayable)
  console.log('Runway:', dashboard.runwayMonths, 'months\n')
  
  // Test 2: Check Transactions
  console.log('📊 Test 2: Transactions')
  const txns = await fetch(`/api/transactions?companyId=${companyId}`).then(r => r.json())
  console.log('Total Transactions:', txns.transactions?.length)
  
  // Test 3: Check Invoices (AR)
  console.log('\n📊 Test 3: Invoices (AR)')
  const invoices = await fetch(`/api/invoices?companyId=${companyId}`).then(r => r.json())
  console.log('Total Invoices:', invoices.invoices?.length)
  const totalAR = invoices.invoices?.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0) || 0
  console.log('Total AR:', totalAR)
  
  // Test 4: Check Bills (AP)
  console.log('\n📊 Test 4: Bills (AP)')
  const bills = await fetch(`/api/bills?companyId=${companyId}`).then(r => r.json())
  console.log('Total Bills:', bills.bills?.length)
  const totalAP = bills.bills?.reduce((sum, bill) => sum + bill.balanceAmount, 0) || 0
  console.log('Total AP:', totalAP)
  
  // Test 5: Financial Reports
  console.log('\n📊 Test 5: Financial Reports')
  const reports = await fetch(`/api/reports/financial?companyId=${companyId}&type=all&startDate=2024-01-01&endDate=2024-12-31`).then(r => r.json())
  console.log('P&L - Net Profit:', reports.profitLoss?.netProfit)
  console.log('Balance Sheet - Assets:', reports.balanceSheet?.assets.total)
  console.log('Balance Sheet - Liabilities:', reports.balanceSheet?.liabilities.total)
  console.log('Cash Flow - Net Change:', reports.cashFlow?.netCashChange)
  
  // Test 6: Overdue Check
  console.log('\n📊 Test 6: Overdue Tracking')
  const overdue = await fetch(`/api/overdue?companyId=${companyId}&action=check`).then(r => r.json())
  console.log('Overdue Invoices:', overdue.overdueInvoices?.length)
  console.log('Overdue Bills:', overdue.overdueBills?.length)
  
  console.log('\n✅ All Tests Complete!')
}

runAllTests()
```

---

## Troubleshooting

### Issue: "companyId is required"
**Solution:** Get your company ID:
```javascript
fetch('/api/auth/me')
  .then(r => r.json())
  .then(data => console.log('Your Company ID:', data.user.companyId))
```

### Issue: "Invoice not found"
**Solution:** Check if invoice exists:
```javascript
fetch('/api/invoices?companyId=YOUR_COMPANY_ID')
  .then(r => r.json())
  .then(data => console.log('Invoices:', data.invoices))
```

### Issue: Balance Sheet doesn't balance
**Reason:** This is normal if you have:
- Transactions but no invoices (revenue not recognized)
- Bills created manually (not from transactions)

**Solution:** Always create invoices for revenue and bills for expenses!

---

## Visual Tests (Using UI)

### 1. Check Cash Balance Updates
1. Note current cash balance on dashboard
2. Upload bank statement
3. Refresh page
4. Verify cash balance changed

### 2. Check AR Display
1. Go to Invoices page
2. Should see "Total AR: ₹X" at top
3. Create new invoice
4. Refresh - AR should increase
5. Record payment - AR should decrease

### 3. Check AP Display
1. Go to Bills page
2. Should see "Total AP: ₹X" at top
3. Create new bill
4. Refresh - AP should increase
5. Record payment - AP should decrease

---

## Success Criteria

✅ Bank statement uploads successfully
✅ Cash balance updates correctly
✅ Invoices auto-created for credits
✅ Bills auto-created for debits
✅ Subscriptions detected automatically
✅ Overdue tracking works and creates alerts
✅ Financial reports generate without errors
✅ Balance Sheet balances (Assets = Liabilities + Equity)
✅ Razorpay payment links work (if configured)
✅ Partial payments work correctly

---

## 🎉 When All Tests Pass

Congratulations! Your accounting system is fully functional and ready for production use! 🚀

Share the COMPLETE_FEATURE_IMPLEMENTATION.md with your CA and start using it for real! 💼


