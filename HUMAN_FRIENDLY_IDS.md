# Human-Friendly Company Identifiers

## Overview

The system now uses **human-friendly slugs** instead of complex MongoDB ObjectIDs for accessing companies. This makes it much easier to remember and share your company dashboard.

## How It Works

### Before (Complex)
```
Company ID: 507f1f77bcf86cd799439011
URL: /dashboard?companyId=507f1f77bcf86cd799439011
```

### After (Simple)
```
Company Name: my-startup
URL: /dashboard?companySlug=my-startup
```

## Creating a Company

### Method 1: From Dashboard

1. Go to `/dashboard`
2. Enter company name: `my-startup` (or `acme-corp`, `tech-solutions`, etc.)
3. Enter cash balance: `1000000`
4. Click "Load Dashboard"
5. Company is automatically created with that slug!

### Method 2: From Settings

1. Go to `/dashboard/settings`
2. Click "+ New Company"
3. Enter name: `My Startup`
4. System generates slug: `my-startup`
5. Use `my-startup` to access your dashboard

## Slug Rules

### Valid Slugs ✅
- `my-startup`
- `acme-corp`
- `tech-solutions-2024`
- `startup123`

### Invalid Slugs ❌
- `My Startup` (use hyphens, not spaces)
- `my_startup` (use hyphens, not underscores)
- `my startup!` (no special characters)
- `MY-STARTUP` (must be lowercase)

## Auto-Generation

When you create a company, the system automatically generates a slug:

| Company Name | Generated Slug |
|--------------|----------------|
| My Startup | my-startup |
| Acme Corp | acme-corp |
| Tech Solutions 2024 | tech-solutions-2024 |
| ABC Company! | abc-company |

## API Usage

### Fetch Company by Slug
```javascript
GET /api/companies?companySlug=my-startup
```

### Fetch Company by ObjectId (still supported)
```javascript
GET /api/companies?companyId=507f1f77bcf86cd799439011
```

### Create Company with Custom Slug
```javascript
POST /api/companies
{
  "name": "My Startup",
  "slug": "my-startup"  // Optional: leave empty to auto-generate
}
```

### Update Company
```javascript
PUT /api/companies
{
  "companySlug": "my-startup",
  "name": "My Awesome Startup",  // Update name
  "slug": "my-awesome-startup"   // Update slug
}
```

### Delete Company
```javascript
DELETE /api/companies?companySlug=my-startup
```

## Dashboard URLs

All dashboard pages now support slugs:

```
/dashboard?companySlug=my-startup&cashBalance=1000000
/dashboard/analytics?companySlug=my-startup&cashBalance=1000000
/dashboard/budgets?companySlug=my-startup
/dashboard/transactions?companySlug=my-startup
/dashboard/reports?companySlug=my-startup
/dashboard/settings?companySlug=my-startup
```

## Benefits

✅ **Easy to remember**: `my-startup` vs `507f1f77bcf86cd799439011`  
✅ **Easy to share**: Send colleagues a simple link  
✅ **Professional URLs**: Looks clean and branded  
✅ **SEO friendly**: If you make dashboards public later  
✅ **Human readable**: Know which company at a glance  

## Migration

Existing companies with ObjectIDs still work! The system supports both:

- **Old way**: `?companyId=507f1f77bcf86cd799439011` ✅ Still works
- **New way**: `?companySlug=my-startup` ✅ Recommended

## Examples

### Example 1: Quick Start
```
1. Go to /dashboard
2. Type: "my-startup"
3. Enter cash: 500000
4. Click Load
5. Done! Company created as "my-startup"
```

### Example 2: Professional Name
```
Company: "Acme Corporation India Pvt Ltd"
Auto-slug: "acme-corporation-india-pvt-ltd"
Access: /dashboard?companySlug=acme-corporation-india-pvt-ltd
```

### Example 3: Short and Sweet
```
Company: "Startup"
Slug: "startup"
Access: /dashboard?companySlug=startup
```

## Technical Details

### Database Schema
```prisma
model Company {
  id    String @id @default(auto()) @db.ObjectId  // Still exists internally
  name  String                                      // Display name
  slug  String @unique                              // Human-friendly identifier
  ...
}
```

### Slug Generation Logic
```typescript
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')     // Remove special chars
    .replace(/[\s_-]+/g, '-')     // Replace spaces with hyphens
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
}
```

## FAQ

**Q: Can I change my company slug later?**  
A: Yes! Go to Settings and update the slug field.

**Q: What if my desired slug is taken?**  
A: Add a number or variation: `my-startup-2`, `my-startup-india`, etc.

**Q: Are slugs case-sensitive?**  
A: No, they're automatically converted to lowercase.

**Q: Can I use my old ObjectID?**  
A: Yes, both methods work. But slugs are recommended for ease of use.

**Q: What happens to existing companies?**  
A: They'll get a slug generated from their name on first access.

## Best Practices

1. **Keep it short**: `acme` is better than `acme-corporation-india-private-limited`
2. **Use hyphens**: `my-startup` not `my_startup` or `mystartup`
3. **Be descriptive**: `tech-solutions` is better than `ts1`
4. **Avoid numbers**: Unless necessary for uniqueness
5. **Think long-term**: Choose a slug you'll want to keep

## Support

Need help? Check:
- `/dashboard/settings` - View all companies and their slugs
- `COMPANY_CRUD.md` - Full API documentation
- Console logs - Debug information for any issues




