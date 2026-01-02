# 🚀 Quick Setup Guide

## Step 1: Update Database Schema

```bash
npx prisma generate
npx prisma db push
```

This will:
- Generate Prisma client with all new models
- Push schema changes to MongoDB
- Create all new collections

## Step 2: Install Dependencies (if needed)

```bash
npm install openai
# or
yarn add openai
```

## Step 3: Environment Variables

Add to your `.env` file:

```env
# Existing
DATABASE_URL="mongodb://..."
NEXTAUTH_SECRET="..."
OPENAI_API_KEY="sk-..."

# New (Optional - for production)
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
SENDGRID_API_KEY="SG..."  # For email reports
```

## Step 4: Test New APIs

### Test Predictive Cash Flow:
```bash
GET http://localhost:3000/api/cashflow/predict?companyId=YOUR_COMPANY_ID&months=6
```

### Test Fundraising Calculator:
```bash
POST http://localhost:3000/api/fundraising/calculator
{
  "companyId": "YOUR_COMPANY_ID",
  "amountRaising": 5000000,
  "preMoneyValuation": 20000000,
  "currentBurnRate": 150000
}
```

### Test Natural Language Query:
```bash
POST http://localhost:3000/api/query/natural
{
  "companyId": "YOUR_COMPANY_ID",
  "question": "How long will my money last?"
}
```

### Test Benchmarking:
```bash
GET http://localhost:3000/api/benchmarks?companyId=YOUR_COMPANY_ID
```

### Test Vendor Contracts:
```bash
POST http://localhost:3000/api/vendors/contracts
{
  "companyId": "YOUR_COMPANY_ID",
  "vendorName": "AWS",
  "service": "Cloud Hosting",
  "category": "Cloud",
  "monthlyAmount": 50000,
  "startDate": "2025-01-01",
  "renewalDate": "2026-01-01"
}
```

### Test GST Reports:
```bash
POST http://localhost:3000/api/gst/reports
{
  "companyId": "YOUR_COMPANY_ID",
  "month": "2025-01"
}
```

### Test TDS Calculator:
```bash
POST http://localhost:3000/api/tds/calculate
{
  "amount": 50000,
  "section": "194J",
  "panAvailable": true
}
```

## Step 5: Enable Features in Dashboard

Update your dashboard to show:

1. **Predictive Cash Flow Chart**
2. **Fundraising Calculator Button**
3. **Benchmarking Widget**
4. **Vendor Contracts Table**
5. **Natural Language Chat Interface**

## Step 6: Set Up Integrations (Optional)

### Slack:
1. Create Slack incoming webhook: https://api.slack.com/messaging/webhooks
2. POST to `/api/integrations/slack` with webhook URL

### Stripe:
1. Get API key from Stripe dashboard
2. POST to `/api/integrations/payments` with provider="stripe"

### Razorpay:
1. Get key_id and key_secret from Razorpay
2. POST to `/api/integrations/payments` with provider="razorpay"

## Step 7: Enable Public Dashboard (Optional)

```bash
POST http://localhost:3000/api/public/dashboard
{
  "companyId": "YOUR_COMPANY_ID",
  "isPublic": true,
  "publicSlug": "yourcompany"
}
```

Access at: `http://localhost:3000/public/yourcompany`

## Step 8: Set Up Email Reports (Optional)

```bash
POST http://localhost:3000/api/reports/email
{
  "companyId": "YOUR_COMPANY_ID",
  "recipientEmail": "founder@startup.com",
  "frequency": "weekly",
  "reportTypes": ["runway", "burn", "alerts"]
}
```

## Step 9: Create Referral Links

```bash
POST http://localhost:3000/api/referrals
{
  "referrerEmail": "founder@startup.com",
  "referredEmail": "friend@company.com"
}
```

## Step 10: Grant Investor Access

```bash
POST http://localhost:3000/api/investor/access
{
  "companyId": "YOUR_COMPANY_ID",
  "investorEmail": "vc@fund.com",
  "investorName": "John Investor",
  "accessLevel": "investor_readonly"
}
```

## Testing Checklist

- [ ] Predictive cash flow generates predictions
- [ ] Fundraising calculator shows dilution
- [ ] Benchmarks compare with peers
- [ ] Vendor contracts track renewals
- [ ] GST reports generate correctly
- [ ] TDS calculator computes amounts
- [ ] Natural language understands questions
- [ ] Slack notifications send
- [ ] Stripe/Razorpay sync revenue
- [ ] Email reports send (need cron)
- [ ] Comments work on transactions
- [ ] Investor dashboard accessible
- [ ] Public dashboard viewable
- [ ] Referrals tracked
- [ ] PWA installs on mobile

## Common Issues

### Issue: Prisma client not updated
**Fix**: Run `npx prisma generate`

### Issue: MongoDB connection error
**Fix**: Check DATABASE_URL in .env

### Issue: OpenAI API error
**Fix**: Add OPENAI_API_KEY to .env

### Issue: TypeScript errors
**Fix**: Run `npm run build` to check, fix type issues

## Production Deployment

1. **Encrypt sensitive data** (API keys, tokens)
2. **Set up cron jobs** for:
   - Email reports: `0 9 * * *` (9 AM daily)
   - Stripe sync: `0 */6 * * *` (every 6 hours)
   - Contract alerts: `0 9 * * 1` (Monday 9 AM)
3. **Add rate limiting** (10 requests/minute per user)
4. **Enable CORS** for allowed domains only
5. **Set up monitoring** (Sentry, LogRocket)
6. **Configure CDN** for static assets

## Need Help?

All APIs are documented in the code with:
- Input validation
- Error handling
- Example responses

Check the implementation files for detailed comments!

## What's Next?

1. Build beautiful UI components
2. Add charts/visualizations
3. Mobile app polish
4. Marketing & launch! 🚀




