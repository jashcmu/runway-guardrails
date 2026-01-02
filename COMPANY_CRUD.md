# Company CRUD Operations

This document explains how to manage companies in the dashboard.

## Overview

The system now has complete CRUD (Create, Read, Update, Delete) operations for companies through the `/api/companies` endpoint.

## API Endpoints

### 1. GET - Fetch Companies

**Fetch all companies:**
```
GET /api/companies
```

**Fetch specific company:**
```
GET /api/companies?companyId=YOUR_COMPANY_ID
```

**Response:**
```json
{
  "company": {
    "id": "company-id",
    "name": "Company Name",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "transactions": [...],
    "budgets": [...],
    "alerts": [...]
  }
}
```

### 2. POST - Create Company

```
POST /api/companies
Content-Type: application/json

{
  "name": "My Company",
  "id": "optional-custom-id"  // Optional: if not provided, auto-generated
}
```

**Response:**
```json
{
  "company": {...},
  "message": "Company created successfully"
}
```

### 3. PUT - Update Company

```
PUT /api/companies
Content-Type: application/json

{
  "companyId": "company-id",
  "name": "Updated Company Name"
}
```

### 4. DELETE - Delete Company

```
DELETE /api/companies?companyId=company-id
```

**Note:** This will cascade delete all related data (transactions, budgets, alerts, invoices).

## Dashboard Usage

### Automatic Company Creation

When you enter a `companyId` and `cashBalance` in the dashboard:

1. Click "Load Dashboard"
2. If the company doesn't exist, you'll be prompted to enter a company name
3. The company is automatically created
4. Dashboard loads with the company data

### Manual Company Management

Visit `/dashboard/settings?companyId=YOUR_ID` to:

- **View** current company details
- **Update** company name
- **Delete** company (with all data)
- **Create** new companies
- **List** all companies

## Usage Examples

### Example 1: Create a Dashboard for New Company

1. Go to `/dashboard`
2. Enter Company ID: `my-startup-123`
3. Enter Cash Balance: `500000`
4. Click "Load Dashboard"
5. When prompted, enter company name: `My Startup`
6. Dashboard loads with empty data (no transactions yet)

### Example 2: View Existing Company

1. Go to `/dashboard`
2. Enter existing Company ID
3. Enter Cash Balance
4. Click "Load Dashboard"
5. System recognizes existing company and loads data

### Example 3: Manage Companies

1. Go to `/dashboard/settings`
2. Click "+ New Company"
3. Enter name and create
4. Copy the generated ID
5. Use that ID to load dashboard

## Features

✅ **Auto-create**: Companies are created automatically when loading dashboard with new ID
✅ **Validation**: All endpoints validate input data
✅ **Error handling**: Clear error messages for debugging
✅ **Cascade delete**: Deleting a company removes all related data
✅ **Custom IDs**: You can specify your own company IDs or let the system generate them

## Database Schema

```prisma
model Company {
  id           String        @id @default(auto()) @map("_id") @db.ObjectId
  name         String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  transactions Transaction[]
  budgets      Budget[]
  alerts       Alert[]
  invoices     Invoice[]
  users        CompanyUser[]
}
```

## Security Notes

- In production, add authentication to protect company data
- Validate user permissions before allowing CRUD operations
- Consider adding soft delete instead of hard delete
- Add rate limiting to prevent abuse

## Next Steps

- Add user authentication
- Implement role-based access control
- Add company invitation system
- Store cash balance in database
- Add company settings (currency, timezone, etc.)

