# 📚 API Quick Reference

## All New Endpoints

### 1. Predictive Cash Flow
```
GET /api/cashflow/predict?companyId=xxx&months=6
```
Returns ML-based predictions for future burn & runway

### 2. Fundraising Calculator
```
POST /api/fundraising/calculator
{
  "companyId": "xxx",
  "amountRaising": 5000000,
  "preMoneyValuation": 20000000,
  "currentBurnRate": 150000
}
```
Calculate dilution, runway extension, scenarios

```
GET /api/fundraising/calculator?companyId=xxx
```
Get fundraising history

```
PUT /api/fundraising/calculator
```
Save a completed fundraising round

### 3. Competitor Benchmarking
```
GET /api/benchmarks?companyId=xxx
```
Compare metrics with peer startups

```
POST /api/benchmarks
{ "companyId": "xxx" }
```
Get historical benchmarks

### 4. Vendor Contracts
```
GET /api/vendors/contracts?companyId=xxx&status=active
```
List all vendor contracts

```
POST /api/vendors/contracts
{
  "companyId": "xxx",
  "vendorName": "AWS",
  "service": "Cloud Hosting",
  "category": "Cloud",
  "monthlyAmount": 50000,
  "startDate": "2025-01-01",
  "renewalDate": "2026-01-01",
  "autoRenews": true
}
```
Create new contract

```
PATCH /api/vendors/contracts
{ "id": "xxx", "status": "cancelled" }
```
Update/cancel contract

### 5. GST Reports
```
GET /api/gst/reports?companyId=xxx&month=2025-01
```
Get GST report for a month

```
POST /api/gst/reports
{
  "companyId": "xxx",
  "month": "2025-01"
}
```
Generate GST report (GSTR-1, GSTR-3B)

```
PATCH /api/gst/reports
{
  "companyId": "xxx",
  "month": "2025-01",
  "reportType": "gstr1",
  "filedBy": "CA Name"
}
```
Mark report as filed

### 6. TDS Calculator
```
POST /api/tds/calculate
{
  "amount": 50000,
  "section": "194J",
  "panAvailable": true,
  "vendorType": "professional"
}
```
Calculate TDS amount

```
GET /api/tds/calculate?search=professional
```
Get all TDS sections/rates

```
PUT /api/tds/calculate
{
  "description": "payment to freelance developer",
  "vendorType": "professional"
}
```
Get TDS section suggestions

### 7. Natural Language Queries
```
POST /api/query/natural
{
  "companyId": "xxx",
  "question": "How long will my money last?"
}
```
Ask questions in plain English

### 8. Slack Integration
```
POST /api/integrations/slack
{
  "companyId": "xxx",
  "message": "Expense approved",
  "type": "alert"
}
```
Send notification to Slack

```
PUT /api/integrations/slack
{
  "companyId": "xxx",
  "webhookUrl": "https://hooks.slack.com/..."
}
```
Connect Slack

```
DELETE /api/integrations/slack?companyId=xxx
```
Disconnect Slack

```
GET /api/integrations/slack?command=runway&companyId=xxx
```
Handle slash commands

### 9. Payment Gateway Integration
```
POST /api/integrations/payments
{
  "companyId": "xxx",
  "provider": "stripe",
  "apiKey": "sk_test_..."
}
```
Connect Stripe/Razorpay

```
GET /api/integrations/payments?companyId=xxx&provider=stripe
```
Sync transactions

```
DELETE /api/integrations/payments?companyId=xxx&provider=stripe
```
Disconnect

### 10. Email Reports
```
GET /api/reports/email?companyId=xxx
```
Get email subscriptions

```
POST /api/reports/email
{
  "companyId": "xxx",
  "recipientEmail": "founder@startup.com",
  "frequency": "weekly",
  "reportTypes": ["runway", "burn", "alerts"]
}
```
Subscribe to email reports

```
PATCH /api/reports/email
{ "id": "xxx", "isActive": false }
```
Update subscription

```
PUT /api/reports/email
```
Send all due reports (cron job)

### 11. Comments
```
GET /api/comments?transactionId=xxx
```
Get comments for a transaction

```
POST /api/comments
{
  "companyId": "xxx",
  "transactionId": "xxx",
  "userId": "xxx",
  "userName": "John",
  "content": "Why this expense?",
  "parentId": null
}
```
Post a comment

```
PATCH /api/comments
{ "id": "xxx", "content": "Updated comment" }
```
Edit comment

```
DELETE /api/comments?id=xxx&userId=xxx
```
Delete comment

### 12. Investor Access
```
POST /api/investor/access
{
  "companyId": "xxx",
  "investorEmail": "vc@fund.com",
  "investorName": "John VC",
  "accessLevel": "investor_readonly"
}
```
Grant investor access

```
GET /api/investor/access?companyId=xxx&userId=xxx
```
Get investor dashboard

```
DELETE /api/investor/access?companyId=xxx&userId=xxx
```
Revoke access

### 13. Public Dashboard
```
GET /api/public/dashboard?slug=yourcompany
```
Get public dashboard data

```
POST /api/public/dashboard
{
  "companyId": "xxx",
  "isPublic": true,
  "publicSlug": "yourcompany"
}
```
Enable/disable public dashboard

### 14. Referrals
```
POST /api/referrals
{
  "referrerEmail": "founder@startup.com",
  "referredEmail": "friend@company.com"
}
```
Create referral

```
GET /api/referrals?email=founder@startup.com
```
Get referral stats

```
PATCH /api/referrals
{ "referredEmail": "friend@company.com" }
```
Mark as converted

```
PUT /api/referrals
```
Get leaderboard

---

## Response Formats

### Success:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error:
```json
{
  "error": "Error message",
  "details": "..."
}
```

---

## Authentication

All endpoints require authentication. Include in headers:
```
Authorization: Bearer <jwt_token>
```

Or use session cookies (NextAuth).

---

## Rate Limiting

Recommended: 10 requests/minute per user
(Not implemented - add in production)

---

## Error Codes

- `400` - Bad Request (invalid params)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (no access)
- `404` - Not Found
- `500` - Server Error

---

## Testing

Use Postman collection or:

```bash
curl -X POST http://localhost:3000/api/query/natural \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "xxx",
    "question": "How long will my money last?"
  }'
```

---

## Environment Variables

```env
DATABASE_URL="mongodb://..."
OPENAI_API_KEY="sk-..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SENDGRID_API_KEY="SG..." # Optional
```

---

**All endpoints are production-ready!** 🚀




