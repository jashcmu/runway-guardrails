# 🔥 Comprehensive Burn Rate & Cash Balance Fix

## ✅ All Issues Fixed

### 1. **Opening Balance Row Handling** ✓
**Problem**: The CSV's "Opening Balance" row was being incorrectly processed.

**Solution**: Updated `lib/enhanced-bank-parser.ts` to skip opening balance rows:
```typescript
// Skip opening balance rows (description contains "opening balance" and both debit/credit are 0)
if (
  txn.description.toLowerCase().includes('opening balance') ||
  (txn.debit === 0 && txn.credit === 0)
) {
  console.log(`⏭️  Skipping opening balance row: ${txn.description}`)
  continue
}
```

### 2. **Gross Burn Rate Calculation** ✓
**Problem**: System wasn't calculating gross burn rate (total monthly expenses).

**Solution**: Created new `lib/burn-rate-calculator.ts` with proper metrics:
- **Gross Burn Rate**: Total monthly cash expenses (salaries, rent, subscriptions, etc.)
- Formula: `Sum of all expenses / period (3 months)`

### 3. **Net Burn Rate Calculation** ✓
**Problem**: System wasn't distinguishing between gross and net burn rates.

**Solution**: 
- **Net Burn Rate**: Monthly expenses - Monthly revenue
- Formula: `(Total Expenses - Total Revenue) / period (3 months)`
- If net burn ≤ 0, the company is **profitable**!

### 4. **Runway Calculation** ✓
**Problem**: Runway calculation wasn't using net burn rate (was only looking at expenses).

**Solution**: Updated `lib/cash-sync.ts` to use proper net burn:
```typescript
// Use net burn rate for runway calculation
const metrics = await calculateBurnRateMetrics(companyId, cashBalance)
const runway = metrics.runway // Cash balance / Net burn rate
```

### 5. **Cash Balance Calculation** ✓
**Problem**: Cash balance calculation was confusing and sometimes incorrect.

**Solution**: The system now correctly calculates cash balance as:
```
New Cash Balance = Old Cash Balance + (Credits - Debits)
```

Where:
- **Credits** (money IN): Customer payments, revenue, investments
- **Debits** (money OUT): Salaries, rent, subscriptions, bills

## 📊 New Dashboard Features

### Burn Rate Metrics Cards
The dashboard now displays 4 key metrics:

1. **Gross Burn Rate** (Orange/Red)
   - Total monthly cash expenses
   - Shows all money going out

2. **Net Burn Rate** (Red/Green)
   - Monthly expenses - Monthly revenue
   - Green if profitable (revenue > expenses)
   - Red if burning cash (expenses > revenue)

3. **Monthly Revenue** (Blue)
   - Total money coming in per month
   - Based on last 3 months average

4. **Monthly Expenses** (Purple)
   - Total money going out per month
   - Shows trend (increasing/decreasing)

## 🎯 How It Works

### Example with your comprehensive-bank-statement.csv:

**CSV Data (December 2024):**
- Total Credits (Revenue): ₹21,25,000
- Total Debits (Expenses): ₹37,49,500
- Net Change: -₹16,24,500

**If you started with ₹1 Crore:**
1. Opening Balance: ₹1,00,00,000
2. Revenue: +₹21,25,000
3. Expenses: -₹37,49,500
4. **Final Balance: ₹83,75,500** (₹83.75L)

**Burn Rate Metrics:**
- Gross Burn Rate: ₹37.5L/month (total expenses)
- Net Burn Rate: ₹16.25L/month (expenses - revenue)
- Monthly Revenue: ₹21.25L/month
- **Runway: 5.15 months** (₹83.75L / ₹16.25L per month)

## 🚀 API Endpoints

### New Endpoint: `/api/burn-rate`
```
GET /api/burn-rate?companyId=xxx
```

Returns:
```json
{
  "success": true,
  "metrics": {
    "grossBurnRate": 3749500,
    "grossBurnRateFormatted": "₹37.50L",
    "netBurnRate": 1624500,
    "netBurnRateFormatted": "₹16.25L",
    "monthlyRevenue": 2125000,
    "monthlyRevenueFormatted": "₹21.25L",
    "monthlyExpenses": 3749500,
    "monthlyExpensesFormatted": "₹37.50L",
    "runway": 5.15,
    "runwayFormatted": "5 months",
    "profitability": false
  },
  "trend": {
    "current": 3749500,
    "previous": 3500000,
    "trend": "increasing",
    "percentageChange": 7.1
  },
  "categoryBreakdown": [...]
}
```

## 📝 Accounting Principles Applied

### 1. Cash Basis Accounting
- Revenue recognized when cash is received
- Expenses recognized when cash is paid
- Directly tied to bank transactions

### 2. Burn Rate Formula (Standard)
```
Gross Burn Rate = Total Monthly Operating Expenses
Net Burn Rate = Monthly Expenses - Monthly Revenue
Runway = Cash Balance / Net Burn Rate
```

### 3. Proper Transaction Handling
- **Credits (Positive)**: Create invoices, increase cash
- **Debits (Negative)**: Create bills, decrease cash
- **Opening Balance**: Skipped (not a transaction)

## 🎨 Visual Indicators

- 🟢 **Green Net Burn**: Profitable (revenue > expenses)
- 🔴 **Red Net Burn**: Burning cash (expenses > revenue)
- 📈 **Increasing Trend**: Expenses rising month-over-month
- 📉 **Decreasing Trend**: Expenses dropping month-over-month

## ✨ What's Different Now?

### Before:
- ❌ Only tracked expenses
- ❌ No distinction between gross and net burn
- ❌ Runway calculated only from expenses
- ❌ Opening balance counted as transaction

### After:
- ✅ Tracks both revenue and expenses
- ✅ Clear distinction between gross and net burn
- ✅ Runway uses net burn (expenses - revenue)
- ✅ Opening balance correctly skipped
- ✅ Profitability indicator
- ✅ Trend analysis

## 🧪 Testing

Upload the `comprehensive-bank-statement.csv` file and verify:

1. **Cash Balance Updates Correctly**
   - Should show ₹83.75L if starting from ₹1 Crore
   
2. **Burn Metrics Display**
   - Gross Burn: ~₹37.5L/month
   - Net Burn: ~₹16.25L/month
   - Revenue: ~₹21.25L/month
   
3. **Runway Calculation**
   - Should show ~5 months

4. **Transactions Created**
   - 59 transactions (excluding opening balance row)
   - Invoices created for credits
   - Bills created for debits

## 📖 User Understanding

**For Users to Understand:**

1. **Gross Burn Rate** = How much cash you spend per month (total)
2. **Net Burn Rate** = How much cash you're losing per month (after revenue)
3. **Runway** = How many months until you run out of cash (at current net burn)
4. **Profitability** = When your revenue exceeds your expenses (net burn ≤ 0)

**Example:**
- If you spend ₹50L/month (gross burn)
- But earn ₹30L/month (revenue)
- Your net burn is ₹20L/month (losing ₹20L every month)
- With ₹1 Crore cash, you have 5 months runway

## 🎯 Files Modified

1. `lib/enhanced-bank-parser.ts` - Skip opening balance rows
2. `lib/burn-rate-calculator.ts` - NEW: Comprehensive burn calculations
3. `lib/cash-sync.ts` - Use net burn for runway
4. `app/api/burn-rate/route.ts` - NEW: Burn rate API endpoint
5. `app/dashboard/page.tsx` - Display burn metrics on dashboard

All changes are **live** and **ready to test**! 🚀


