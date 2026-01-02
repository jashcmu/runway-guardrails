# 🔧 MongoDB Authentication Fix

The MongoDB is connecting but authentication is failing:
```
SCRAM failure: bad auth : Authentication failed
```

## Quick Fix Options:

### Option 1: Get New MongoDB Atlas Connection String

1. **Go to MongoDB Atlas:** https://cloud.mongodb.com/
2. **Login to your account**
3. **Click "Database" → "Connect" on your cluster**
4. **Choose "Drivers"**
5. **Copy the connection string**
6. **IMPORTANT:** Make sure to:
   - Replace `<password>` with your actual MongoDB Atlas password
   - If password has special characters like @, #, $, % - they need to be URL encoded:
     - `@` → `%40`
     - `#` → `%23`
     - `$` → `%24`
     - `%` → `%25`
     - `:` → `%3A`

### Option 2: Reset MongoDB Password

If you don't remember the password:

1. Go to MongoDB Atlas → Database Access
2. Click "Edit" on your user
3. Click "Edit Password"
4. Choose "Autogenerate Secure Password" OR set a simple one like `Password123` (no special chars)
5. Copy the new password
6. Update your connection string

### Option 3: Use Local MongoDB (Fastest)

Skip MongoDB Atlas entirely and use local database:

```env
DATABASE_URL="mongodb://localhost:27017/runway-guardrails"
NEXTAUTH_SECRET="runway-guardrails-secret-key-2024"
```

Then install and run MongoDB locally:
```bash
# Download MongoDB Community: https://www.mongodb.com/try/download/community
# Or use chocolatey:
choco install mongodb
mongod
```

## Current Connection String Issue

Your current connection uses:
- Username: `jashgandhi`
- Password: `Qk2RQQRmqDbBBjUU`
- Cluster: `cluster0.ier73ze.mongodb.net`

The password might be:
1. Incorrect
2. Changed
3. The user doesn't have permissions
4. IP not whitelisted

## What To Do Now:

**Tell me which option you want:**
1. Get the correct MongoDB Atlas connection string (I'll wait for you to provide it)
2. Use local MongoDB instead (I'll set it up)
3. Create a new free MongoDB Atlas cluster from scratch (I'll guide you)



