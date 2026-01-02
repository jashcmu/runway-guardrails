# 🔥 INSTANT FIX - Set Cash Balance to ₹100L

## The Problem
Your onboarding didn't save the cash balance to the database. That's why it shows ₹0.

## The Solution
Run this script in your browser console RIGHT NOW to set it to ₹100L (₹10,000,000).

## Steps:

1. **Open** http://localhost:3000/dashboard
2. **Press F12** (Developer Tools → Console)
3. **Paste this code** and press Enter:

```javascript
(async () => {
  console.log('💰 Setting Cash Balance to ₹100L...\n');
  
  // Get your company ID
  const me = await (await fetch('/api/auth/me')).json();
  const companyId = me.user.companies[0].id;
  const oldBalance = me.user.companies[0].cashBalance;
  
  console.log('Company:', me.user.companies[0].name);
  console.log('Current Balance:', oldBalance);
  console.log('Setting to: ₹10,000,000\n');
  
  // Set cash balance
  const res = await fetch('/api/companies/set-cash-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: companyId,
      cashBalance: 10000000
    })
  });
  
  const data = await res.json();
  
  if (res.ok) {
    console.log('✅ SUCCESS!');
    console.log('New Balance:', data.company.cashBalance);
    alert('SUCCESS!\n\n' + data.message + '\n\nRefresh the page (F5) to see ₹100.0L on dashboard!');
    
    // Auto-refresh after 2 seconds
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } else {
    console.error('❌ FAILED:', data);
    alert('ERROR: ' + data.error);
  }
})();
```

4. **Wait 2 seconds** - Page will auto-refresh
5. **See ₹100.0L** on your dashboard! 🎉

---

## Alternative: Set Custom Amount

Want a different amount? Use this:

```javascript
(async () => {
  const me = await (await fetch('/api/auth/me')).json();
  const companyId = me.user.companies[0].id;
  
  // CHANGE THIS NUMBER to whatever you want
  const desiredBalance = 5000000; // ₹50L
  
  const res = await fetch('/api/companies/set-cash-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: companyId,
      cashBalance: desiredBalance
    })
  });
  
  if (res.ok) {
    alert('Balance set to ₹' + desiredBalance.toLocaleString() + '!\n\nRefreshing...');
    setTimeout(() => window.location.reload(), 1000);
  }
})();
```

---

## What This Does

1. Gets your company ID from the session
2. Calls a special API to update cash balance in database
3. Sets it to ₹10,000,000 (₹100L)
4. Refreshes the page
5. Dashboard now shows **₹100.0L** instead of ₹0.00L!

---

## After Setting Cash Balance

Once you have ₹100L set, you can:

1. **Upload bank statements** - Net change will add/subtract from ₹100L
2. **Add transactions** - Each expense reduces it, each revenue increases it
3. **See runway** - Will calculate: ₹100L / Monthly Burn = X months

Example:
- Start: ₹100L
- Upload comprehensive-bank-statement.csv (net: -₹3.5L)
- New balance: ₹96.5L
- Monthly burn: ₹3.5L
- Runway: 96.5 / 3.5 = **27.5 months**

---

## Files Created

1. ✅ `app/api/companies/set-cash-balance/route.ts` - API to set cash balance
2. ✅ Fixed `app/onboarding/page.tsx` - Will save cash balance for new users
3. ✅ Financial Overview Widget
4. ✅ AR/AP tracking on invoices/bills pages

---

**RUN THE SCRIPT NOW! Takes 5 seconds!** 🚀



