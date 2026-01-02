# Recurring vs One-Time Expense Tracking

## 🎯 What We Built

We've implemented a complete system to differentiate between **recurring** and **one-time** expenses, which makes burn rate calculations much more accurate for startups.

## 🔑 Key Features

### 1. **Expense Type Classification**
- **Recurring Expenses**: Regular, predictable costs (salaries, subscriptions, rent)
- **One-Time Expenses**: Single purchases (equipment, one-off marketing campaigns)

### 2. **Frequency Tracking**
For recurring expenses, you can specify:
- **Monthly**: Most common (salaries, SaaS subscriptions)
- **Weekly**: Less common (weekly contractors)
- **Quarterly**: Insurance, tax payments
- **Yearly**: Annual licenses, domain renewals

### 3. **Smart Burn Rate Calculation**

#### How It Works:
1. **Recurring Expenses** → Normalized to monthly rate
   - Monthly expense: Count as-is
   - Quarterly: Divide by 3
   - Yearly: Divide by 12
   - Weekly: Multiply by 4.33 (average weeks/month)

2. **One-Time Expenses** → Amortized over time
   - Spread over 12 months (or company age, whichever is less)
   - Prevents one-time purchases from inflating burn rate
   - Example: ₹1,20,000 equipment purchase = ₹10,000/month amortized

#### Example Calculation:
```
Expenses:
- Salaries (Recurring, Monthly): ₹5,00,000
- AWS (Recurring, Monthly): ₹50,000
- Insurance (Recurring, Quarterly): ₹30,000
- Laptop (One-Time): ₹1,20,000

Monthly Burn = ₹5,00,000 + ₹50,000 + (₹30,000/3) + (₹1,20,000/12)
            = ₹5,00,000 + ₹50,000 + ₹10,000 + ₹10,000
            = ₹5,70,000/month
```

## 🎨 UI Updates

### Add Expense Form
The expense form now includes:
1. **Type Selector**: Choose between "🔄 Recurring" or "⚡ One-Time"
2. **Frequency Buttons** (only shown for recurring):
   - Monthly, Weekly, Quarterly, Yearly
   - Color-coded for easy identification
3. **Auto-calculated next due date** for recurring expenses

### Expense Table
- New **Type** column showing:
  - Green badge: "🔄 Monthly" (or other frequency)
  - Yellow badge: "⚡ One-Time"
- Clear visual distinction between expense types

## 🔧 Technical Implementation

### Database Schema (`prisma/schema.prisma`)
```prisma
model Transaction {
  // ... existing fields
  expenseType    String    @default("recurring")
  frequency      String?   // "monthly", "quarterly", "yearly", "weekly"
  nextDueDate    DateTime? // Auto-calculated for recurring
  isAutoDetected Boolean   @default(false)
}
```

### Core Logic (`lib/calculations.ts`)
- `calculateMonthlyBurn()` - Updated to handle recurring vs one-time
- Separate processing for each expense type
- Amortization logic for one-time expenses

### API Updates (`app/api/transactions/route.ts`)
- Accepts `expenseType` and `frequency` parameters
- Validates frequency for recurring expenses
- Auto-calculates `nextDueDate` for recurring

### UI Components
- **Dashboard** (`app/dashboard/page.tsx`): Enhanced add expense form
- **ExpenseTable** (`app/components/ExpenseTable.tsx`): Shows type badges

## 📊 Impact on Metrics

### Before:
- All expenses treated as monthly recurring
- ₹1,20,000 laptop = ₹1,20,000/month burn (wrong!)
- Runway calculation would be severely underestimated

### After:
- Recurring expenses normalized by frequency
- One-time expenses amortized over 12 months
- ₹1,20,000 laptop = ₹10,000/month amortized (correct!)
- Accurate runway projections

## 🤖 Future: Bank Statement Automation

### How It Will Work:

1. **Upload Bank Statement** (CSV/PDF)
2. **AI Detection** analyzes patterns:
   - Same amount every month → "Recurring Monthly"
   - Same vendor, different amounts → "Recurring"
   - Single transaction → "One-Time"
3. **Auto-categorization** using OpenAI
4. **User Review** and correction
5. **Accurate Burn Calculation** automatically

### Example Auto-Detection:
```
Transaction Pattern:
- "AWS India" ₹48,500 (Jan), ₹52,300 (Feb), ₹49,800 (Mar)
  → Detected as: Recurring Monthly, Category: Cloud Services

- "Dell Laptops" ₹2,40,000 (one time)
  → Detected as: One-Time, Category: Equipment

- "Google Workspace" ₹1,200 (every month, same amount)
  → Detected as: Recurring Monthly, Category: SaaS
```

### AI Detection Logic (`lib/bank-sync.ts` - future):
```typescript
function detectRecurring(transactions) {
  // Group by vendor
  // Check for regular intervals (7, 30, 90, 365 days)
  // If pattern found → Mark as recurring with frequency
  // If single instance → Mark as one-time
  // AI suggests category
}
```

## 💡 User Benefits

### For Founders:
- **Accurate runway** → Know when you'll actually run out of money
- **Smart planning** → Differentiate fixed vs variable costs
- **Investor confidence** → Show you understand your burn

### For VCs:
- **Clear burn breakdown** → See recurring vs one-time costs
- **Efficiency metrics** → Understand true monthly operations cost
- **Trend analysis** → Track if burn is increasing due to scaling (recurring) or investments (one-time)

## 📝 Usage Tips

1. **Mark salaries as recurring monthly** - Most predictable expense
2. **SaaS tools as recurring** - Specify monthly/yearly
3. **Equipment purchases as one-time** - Gets amortized automatically
4. **Marketing campaigns** - If one-off → one-time, if ongoing → recurring
5. **Review recurring expenses** - Update frequency if payment terms change

## 🚀 Testing

To test the new feature:
1. Go to Dashboard → Add Expense
2. Add a **recurring monthly** expense (e.g., Salary ₹50,000)
3. Add a **one-time** expense (e.g., Laptop ₹1,00,000)
4. Notice how burn rate is calculated more accurately
5. Check the expense table - see type badges
6. Add expenses with different dates - see burn rate adjust

## 📚 Next Steps

1. ✅ **Schema updated** - expenseType, frequency, nextDueDate
2. ✅ **Calculation logic** - Recurring vs one-time handling
3. ✅ **API updated** - Accepts new fields
4. ✅ **UI enhanced** - Type selector and frequency buttons
5. ✅ **Table updated** - Shows type badges

### Future Enhancements:
- [ ] AI-powered bank statement parsing
- [ ] Automatic recurring expense detection
- [ ] Alerts for missed recurring payments
- [ ] Forecast next 12 months with recurring schedule
- [ ] Bulk import from accounting software (Zoho, QuickBooks)

---

## 🎉 Result

You now have a **professional-grade expense tracking system** that gives you accurate burn rate calculations by understanding the difference between ongoing operational costs and one-time investments. This is exactly what VCs and CFOs look for in financial management tools!



