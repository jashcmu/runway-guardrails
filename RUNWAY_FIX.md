# 🔧 FIXED: Runway Calculation Issue

## Problem
Dashboard wasn't calculating runway or burn rate even with transactions present.

## Root Cause
The dashboard API was expecting `companyId` but the frontend was sending `companySlug`.

## Solution
Updated `/api/dashboard/route.ts` to accept **both** `companyId` and `companySlug` parameters.

---

## ✅ What's Fixed

Now the API will:
1. Accept `companyId` parameter (direct lookup)
2. Accept `companySlug` parameter (slug lookup)
3. Calculate monthly burn rate from all transactions
4. Calculate runway based on cash balance ÷ burn rate
5. Show proper status (green/blue/yellow/red)

---

## 🧪 To Test

1. **Refresh your dashboard**:
   ```
   Ctrl + Shift + R (hard refresh)
   ```

2. **You should now see**:
   - Runway calculated (e.g., "8.5 months")
   - Monthly burn shown (e.g., "₹1.2L")
   - Color-coded status badge
   - Progress bar if target is set

---

## 📊 How It Calculates

### Monthly Burn:
- **Recurring expenses** (marked as recurring): counted at their frequency
  - Monthly: Full amount
  - Quarterly: Amount ÷ 3
  - Yearly: Amount ÷ 12
  - Weekly: Amount × 4.33

- **One-time expenses**: Amortized over 12 months

### Runway:
```
Runway = Cash Balance ÷ Monthly Burn Rate
```

Example:
- Cash: ₹50L
- Burn: ₹5L/month
- Runway: 10 months

---

## 🎨 Status Colors

- 🟢 **Green (Excellent)**: 18+ months
- 🔵 **Blue (Good)**: 12-18 months  
- 🟡 **Yellow (Warning)**: 6-12 months
- 🔴 **Red (Critical)**: <6 months
- ⚪ **Gray (Unknown)**: No data or ₹0 burn

---

## 🔍 Troubleshooting

### Still shows "-- months"?

1. **Check cash balance**:
   - Go to Settings
   - Make sure cash balance is > 0

2. **Check transactions**:
   - Look at the transactions table
   - Make sure amounts are correct

3. **Check console**:
   - Press F12
   - Look for errors in Console tab

### Shows "Unknown" status?

This happens when:
- Cash balance is ₹0
- No transactions exist
- All transactions are $0

**Fix**: Add your cash balance in Settings

---

## ✨ Now Your Dashboard Shows

✅ Accurate runway calculation
✅ Monthly burn rate from real data
✅ Color-coded status warnings
✅ Progress toward target runway
✅ Smart expense categorization

---

**Just refresh your browser and it should work!** 🎉

If you still see issues, check:
1. Browser console (F12) for errors
2. Network tab to see API responses
3. Make sure dev server is running

Let me know if you need any help! 😊




