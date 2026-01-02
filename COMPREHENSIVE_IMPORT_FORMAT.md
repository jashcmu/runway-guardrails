# 🎯 Comprehensive Financial Import Format

## Overview

The system now supports **TWO CSV FORMATS**:

### 1. Traditional Bank Statement Format
- **Columns**: Date, Description, Debit, Credit, Balance
- **Use Case**: Import cash transactions from bank statements
- **What It Does**: Creates transactions, reconciles with existing invoices/bills

### 2. Comprehensive Financial Format ⭐ NEW
- **Columns**: record_type, date, description, amount, currency, counterparty, category, reference_id, invoice_id, bill_id, due_date, issue_date, status, payment_method, matched_transaction_ref, notes
- **Use Case**: Import complete financial dataset including invoices, bills, transactions, and payment linkages
- **What It Does**: Creates invoices, bills, transactions, and links payments

---

## Comprehensive Format Specification

### Supported Record Types

1. **INVOICE** - Creates Accounts Receivable records
2. **BILL** - Creates Accounts Payable records
3. **TRANSACTION** - Creates cash transaction records
4. **INVOICE_PAYMENT** - Links payments to invoices
5. **BILL_PAYMENT** - Links payments to bills

### Column Definitions

| Column | Required For | Description | Example |
|--------|-------------|-------------|---------|
| `record_type` | ALL | Type of record (INVOICE, BILL, TRANSACTION, etc.) | `INVOICE` |
| `date` | TRANSACTION, PAYMENT | Transaction date (YYYY-MM-DD) | `2025-12-12` |
| `description` | TRANSACTION | Description of transaction | `ACME CORP PAYMENT` |
| `amount` | ALL | Amount in currency | `250000` |
| `currency` | ALL | Currency code | `INR` |
| `counterparty` | INVOICE, BILL | Customer/Vendor name | `Acme Corp` |
| `category` | BILL, TRANSACTION | Category (CLOUD, SAAS, MARKETING, HIRING, GA) | `SAAS` |
| `reference_id` | TRANSACTION, PAYMENT | Unique reference ID | `TXN-ACME-1212` |
| `invoice_id` | INVOICE, INVOICE_PAYMENT | Invoice number/ID | `INV-ACME-0001` |
| `bill_id` | BILL, BILL_PAYMENT | Bill number/ID | `BILL-AWS-0102` |
| `due_date` | INVOICE, BILL | Payment due date (YYYY-MM-DD) | `2025-12-15` |
| `issue_date` | INVOICE, BILL | Invoice/Bill issue date (YYYY-MM-DD) | `2025-12-01` |
| `status` | INVOICE, BILL, PAYMENT | Status (SENT, RECEIVED, POSTED, etc.) | `SENT` |
| `payment_method` | PAYMENT | Payment method (BANK_TRANSFER, UPI, CARD, NEFT, etc.) | `UPI` |
| `matched_transaction_ref` | PAYMENT | Reference to matching transaction | `TXN-ACME-1212` |
| `notes` | ALL | Optional notes | `Terms: Net 14` |

---

## How It Works

### Import Process

The system automatically detects the CSV format:
- If `record_type` column exists → **Comprehensive Import**
- Otherwise → **Traditional Bank Statement Import**

### Processing Phases

#### Phase 1: Create Invoices
- All rows with `record_type = INVOICE`
- Creates invoice records with `status = 'sent'` by default
- Initial `balanceAmount = totalAmount` (unpaid)
- Shows on AR page

#### Phase 2: Create Bills
- All rows with `record_type = BILL`
- Creates bill records with `status = 'approved'` by default
- Initial `balanceAmount = totalAmount` (unpaid)
- Shows on AP page

#### Phase 3: Create Transactions
- All rows with `record_type = TRANSACTION`
- Positive amounts = Revenue (cash in)
- Negative amounts = Expense (cash out)
- Updates company cash balance
- Shows on transactions page

#### Phase 4: Link Invoice Payments
- All rows with `record_type = INVOICE_PAYMENT`
- Matches `invoice_id` to previously created invoice
- Updates invoice: `paidAmount`, `balanceAmount`, `status`
- If fully paid: `status = 'paid'`, removed from AR

#### Phase 5: Link Bill Payments
- All rows with `record_type = BILL_PAYMENT`
- Matches `bill_id` to previously created bill
- Updates bill: `paidAmount`, `balanceAmount`, `paymentStatus`
- If fully paid: `paymentStatus = 'paid'`, removed from AP

---

## Example CSV

```csv
record_type,date,description,amount,currency,counterparty,category,reference_id,invoice_id,bill_id,due_date,issue_date,status,payment_method,matched_transaction_ref,notes
INVOICE,,Invoice for Product subscription (Dec 2025),250000,INR,Acme Corp,,INV-ACME-0001,,,2025-12-15,2025-12-01,SENT,,,Terms: Net 14
INVOICE,,Invoice for Implementation services,400000,INR,Beta Retail Pvt Ltd,,INV-BETA-0002,,,2026-01-02,2025-12-03,SENT,,,Terms: Net 30
BILL,,AWS cloud invoice - Nov usage,120000,INR,AWS India Pvt Ltd,CLOUD,BILL-AWS-0102,,,2025-12-17,2025-12-02,RECEIVED,,,
BILL,,Office rent - Dec 2025,300000,INR,WeWork India,GA,BILL-WEWORK-1204,,,2025-12-19,2025-12-04,RECEIVED,,,
TRANSACTION,2025-12-12,ACME CORP PAYMENT - INV-ACME-0001,125000,INR,Acme Corp,REVENUE,TXN-ACME-1212,,,,,,,,Partial payment for INV-ACME-0001
TRANSACTION,2025-12-05,SALARY PAYOUT - DEC,-650000,INR,Payroll,HIRING,TXN-SAL-1205,,,,,,,,
TRANSACTION,2025-12-10,AWS INDIA PVT LTD - BILL-AWS-0102,-120000,INR,AWS India Pvt Ltd,CLOUD,TXN-AWS-1210,,,,,,,,
INVOICE_PAYMENT,2025-12-12,,125000,INR,Acme Corp,,PAY-ACME-1212,INV-ACME-0001,,,,POSTED,BANK_TRANSFER,TXN-ACME-1212,
BILL_PAYMENT,2025-12-10,,120000,INR,AWS India Pvt Ltd,,PAY-AWS-1210,,BILL-AWS-0102,,,POSTED,NEFT,TXN-AWS-1210,
```

---

## What Gets Created

### From Your CSV (`test_full_finance_dataset_india.csv`)

**Invoices (AR):**
- INV-ACME-0001: ₹2,50,000 (Acme Corp) - Due 2025-12-15
  - Partial payment: ₹1,25,000 on 2025-12-12 ✅
  - Final payment: ₹1,25,000 on 2025-12-26 ✅
  - **Status**: PAID (fully reconciled)
- INV-BETA-0002: ₹4,00,000 (Beta Retail) - Due 2026-01-02
  - **Status**: SENT (unpaid)
  - **Shows on AR page**: ₹4,00,000
- INV-GAMMA-0003: ₹1,80,000 (Gamma Logistics) - Due 2025-12-25
  - Full payment: ₹1,80,000 on 2025-12-28 ✅
  - **Status**: PAID (fully reconciled)

**Bills (AP):**
- BILL-AWS-0102: ₹1,20,000 (AWS India) - Due 2025-12-17
  - Payment: ₹1,20,000 on 2025-12-10 ✅
  - **Status**: PAID (fully reconciled)
- BILL-WEWORK-1204: ₹3,00,000 (WeWork) - Due 2025-12-19
  - Payment: ₹3,00,000 on 2025-12-15 ✅
  - **Status**: PAID (fully reconciled)
- BILL-NOTION-1205: ₹18,000 (Notion) - Due 2026-01-05
  - Payment: ₹18,000 on 2025-12-16 ✅
  - **Status**: PAID (fully reconciled)
- BILL-GADS-1206: ₹75,000 (Google Ads) - Due 2025-12-20
  - Payment: ₹75,000 on 2025-12-18 ✅
  - **Status**: PAID (fully reconciled)
- BILL-META-1207: ₹1,10,000 (Meta Ads) - Due 2025-12-22
  - Payment: ₹1,10,000 on 2025-12-19 ✅
  - **Status**: PAID (fully reconciled)
- BILL-RAZOR-1208: ₹45,000 (Razorpay) - Due 2025-12-23
  - Payment: ₹45,000 on 2025-12-20 ✅
  - **Status**: PAID (fully reconciled)

**Transactions (Cash):**
- Revenue (Cash In): ₹4,30,000
  - ₹1,25,000 (ACME partial)
  - ₹1,25,000 (ACME final)
  - ₹1,80,000 (GAMMA full)
- Expenses (Cash Out): ₹16,83,000
  - ₹6,50,000 (Salaries)
  - ₹1,20,000 (AWS)
  - ₹3,00,000 (Rent)
  - ₹18,000 (Notion)
  - ₹75,000 (Google Ads)
  - ₹1,10,000 (Meta Ads)
  - ₹45,000 (Razorpay)
  - ₹2,00,000 (Bonus)
  - ₹95,000 (GCP)
  - ₹45,000 (Stripe)
  - ₹25,000 (Utilities)

**Net Cash Flow**: ₹4,30,000 - ₹16,83,000 = **-₹12,53,000**

---

## Financial Impact

### After Import:

**AR (Accounts Receivable):**
- Only unpaid invoice: INV-BETA-0002
- **Total AR**: ₹4,00,000 💰

**AP (Accounts Payable):**
- All bills paid!
- **Total AP**: ₹0 ✅

**Cash Balance:**
- Previous Balance: (your current balance)
- Net Change: -₹12,53,000 (more cash out than in)
- **New Balance**: Previous - ₹12,53,000

**Burn Rate:**
- Monthly Expenses: ₹16,83,000
- Monthly Revenue: ₹4,30,000
- **Net Burn**: ₹12,53,000/month

---

## Advantages of Comprehensive Format

### 1. Complete Financial Picture
- ✅ Creates full AR/AP records (not just cash)
- ✅ Tracks invoices independently from payments
- ✅ Links payments to invoices/bills correctly
- ✅ Proper accrual accounting

### 2. Better Forecasting
- ✅ Cash flow forecast knows about unpaid invoices
- ✅ Future AR collections included in predictions
- ✅ Future AP payments included in projections
- ✅ More accurate runway calculations

### 3. One-Time Setup
- ✅ Import historical data all at once
- ✅ Set up proper AR/AP baseline
- ✅ No need to manually create each invoice/bill
- ✅ Relationships automatically linked

---

## How to Use

### Step 1: Prepare Your CSV
1. Use the column headers exactly as specified
2. Include all record types (INVOICE, BILL, TRANSACTION, INVOICE_PAYMENT, BILL_PAYMENT)
3. Make sure `invoice_id` and `bill_id` match between records
4. Use YYYY-MM-DD format for dates
5. Amounts should be numbers (no currency symbols)

### Step 2: Upload
1. Go to Dashboard
2. Click "Upload Bank Statement"
3. Select your comprehensive CSV file
4. Click "Upload & Process"

### Step 3: System Auto-Detection
- System detects `record_type` column
- Uses comprehensive import parser
- Processes in 5 phases (as described above)

### Step 4: Review Results
- Check AR page for unpaid invoices
- Check AP page for unpaid bills
- Check transactions for cash movements
- Verify cash balance updated correctly

---

## Troubleshooting

### Common Issues

**Error: "Cannot read properties of undefined"**
- **Cause**: Missing required columns
- **Fix**: Ensure all columns are present in CSV header

**Error: "Invoice not found"**
- **Cause**: INVOICE_PAYMENT refers to non-existent invoice_id
- **Fix**: Make sure INVOICE record is in the CSV before INVOICE_PAYMENT

**Error: "Bill not found"**
- **Cause**: BILL_PAYMENT refers to non-existent bill_id
- **Fix**: Make sure BILL record is in the CSV before BILL_PAYMENT

**Wrong Cash Balance**
- **Cause**: Positive/negative amounts incorrect
- **Fix**: 
  - Revenue transactions: Positive amounts
  - Expense transactions: Negative amounts

**Invoices Not Showing on AR**
- **Cause**: Status set to 'paid' or fully paid via INVOICE_PAYMENT
- **Fix**: Only unpaid invoices show on AR page (by design)

---

## Summary

✅ **NEW**: Comprehensive import format supports complete financial data
✅ **AUTO-DETECT**: System automatically uses correct parser
✅ **COMPLETE**: Creates invoices, bills, transactions, and links payments
✅ **AR/AP**: Properly tracks Accounts Receivable and Accounts Payable
✅ **CASH FLOW**: Accurate cash tracking and forecasting
✅ **ONE-TIME**: Import all your historical data at once

**Your CSV is ready to upload!** 🚀

The system will:
1. Create 3 invoices (1 unpaid showing on AR)
2. Create 6 bills (all paid, none showing on AP)
3. Create 13 transactions (cash movements)
4. Link 9 payments to invoices/bills
5. Update cash balance: -₹12,53,000

**Total AR after import**: ₹4,00,000  
**Total AP after import**: ₹0  
**Cash burned**: ₹12,53,000



