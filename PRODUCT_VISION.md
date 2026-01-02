# Runway Guardrails - Product Vision

## Core Purpose
**Track where money is going and how it affects runway** - for startups and VCs to monitor cash burn and survival.

## Key Concept
- **NOT a budgeting tool** (budgets are optional)
- **Transaction-based tracking** - Import actual spending to calculate burn rate
- Show **real-time impact** on runway as money is spent

## How It Works

### 1. Initial Setup
- User enters their company name
- Inputs current cash balance (e.g., ₹10,00,000)
- Optionally sets target runway (e.g., 18 months)

### 2. Track Spending
- **Import transactions** from bank statements (CSV)
- OR manually add expenses
- System categorizes spending (Hiring, Marketing, SaaS, Cloud, etc.)

### 3. Calculate & Visualize
- **Monthly Burn Rate** = Average spending per month
- **Runway** = Cash Balance ÷ Monthly Burn Rate
- **Burn Trends** = Is spending increasing/decreasing?
- **Category Breakdown** = Where is money going?

### 4. Scenario Planning
- "What if I hire 2 people at ₹50k/month?"
- "What if I increase marketing spend by ₹1L?"
- See impact on runway BEFORE making decisions

### 5. AI Insights
- Chatbot answers: "What happens if I spend this money?"
- Automatic alerts when burn rate increases
- Smart recommendations

## Current State

### ✅ Working
- User authentication (register/login)
- Company setup with cash balance
- Dashboard structure
- Scenario simulator exists
- Budget management (optional feature)

### 🔧 Needs Fixing
1. **Transaction Import** - CSV upload button visible but needs to work
2. **Burn Calculation** - Currently shows ₹0 because no transactions
3. **Chatbot** - Exists but not visible on main dashboard
4. **Budget Feature** - Optional, but currently broken

## Next Steps

1. **Make transaction import prominent**
   - Big "Import Transactions" button
   - Support CSV from Indian banks
   - Manual transaction entry

2. **Calculate burn from transactions**
   - Group by month
   - Calculate average
   - Show trend

3. **Show chatbot**
   - Floating button
   - Answer financial questions
   - Use transaction data

4. **Fix budget management**
   - Make it optional
   - Link to /dashboard/budgets page

## Like Midday AI
- Clean, simple interface
- Transaction-first approach
- Real-time insights
- AI-powered recommendations
- Focus on runway survival
