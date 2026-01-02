# Indian Market Features - Capital Discipline Platform

## Overview
This platform is being adapted for the Indian market, similar to Midday AI but focused on capital discipline and cash survival for Indian startups and businesses.

## Implemented Features

### 1. Indian Currency Support ✅
- INR formatting with Indian number system (lakhs, crores)
- Proper currency display for Indian market
- Location: `lib/currency.ts`

### 2. GST (Goods and Services Tax) Tracking ✅
- GST calculation (0%, 5%, 12%, 18%, 28%)
- CGST (Central GST) and SGST (State GST) for intra-state
- IGST (Integrated GST) for inter-state transactions
- Location: `lib/gst.ts`
- Database: Added GST fields to Transaction model

## Planned Features

### 3. TDS (Tax Deducted at Source) Tracking
- TDS calculation and tracking
- TDS certificates management
- TDS compliance reporting

### 4. Indian Bank Integration
- UPI transaction tracking
- NEFT/RTGS/IMPS support
- Indian bank statement parsing
- Payment gateway integration (Razorpay, PayU, etc.)

### 5. Invoice Generation (Indian Format)
- GST-compliant invoices
- HSN/SAC code support
- Place of supply tracking
- E-way bill integration

### 6. Indian Accounting Standards
- Ind AS compliance
- Financial year (April-March) support
- TDS certificates
- GST returns preparation

### 7. Multi-currency Support
- INR as primary currency
- Foreign currency transactions
- Exchange rate tracking
- FEMA compliance

### 8. Indian Business Categories
- MSME classification
- Startup India benefits tracking
- Export-import transactions
- Service tax (if applicable)

## Next Steps

1. Update dashboard to use INR formatting
2. Add GST fields to transaction upload
3. Create GST reporting dashboard
4. Add TDS tracking and compliance
5. Integrate Indian payment gateways
6. Build invoice generation system

