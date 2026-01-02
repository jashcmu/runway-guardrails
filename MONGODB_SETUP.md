# MongoDB Setup Guide for Runway Guardrails

## 🎉 Your Prisma schema has been updated to use MongoDB!

## Step 1: Set Up MongoDB

Choose one of these options:

### Option A: MongoDB Atlas (Cloud - Recommended for Production)

1. **Create Account**: Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Free Cluster**:
   - Click "Build a Database"
   - Choose FREE M0 tier
   - Select a cloud provider & region (choose closest to you)
   - Name your cluster (e.g., "runway-cluster")
3. **Create Database User**:
   - Click "Database Access" in left sidebar
   - Add new database user
   - Choose password authentication
   - Remember username and password!
4. **Configure Network Access**:
   - Click "Network Access" in left sidebar
   - Add IP Address
   - For development: click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: whitelist specific IPs
5. **Get Connection String**:
   - Click "Database" in left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - It looks like: `mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority`

### Option B: Local MongoDB (Development Only)

1. **Download MongoDB**:
   - Windows: Download from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
   - Install MongoDB Community Edition
   - During installation, install as a service
2. **Verify Installation**:
   ```bash
   mongod --version
   ```
3. **Start MongoDB** (if not running as service):
   ```bash
   mongod
   ```
4. **Connection String**:
   ```
   mongodb://localhost:27017/runway-guardrails
   ```

## Step 2: Configure Environment Variables

1. **Create/Update `.env` file** in your project root:

```env
# MongoDB Atlas
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/runway-guardrails?retryWrites=true&w=majority"

# OR Local MongoDB
# DATABASE_URL="mongodb://localhost:27017/runway-guardrails"
```

2. **Replace placeholders**:
   - `username` - your MongoDB username
   - `password` - your MongoDB password (URL encode special characters!)
   - `cluster` - your cluster name
   - `runway-guardrails` - your database name

**Important**: If your password has special characters, URL encode them:
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `#` → `%23`
- `[` → `%5B`
- `]` → `%5D`

## Step 3: Generate Prisma Client & Push Schema

Run these commands in your terminal:

```bash
# Generate Prisma Client for MongoDB
npx prisma generate

# Push your schema to MongoDB (creates collections)
npx prisma db push
```

## Step 4: Verify Connection

Open Prisma Studio to verify:

```bash
npx prisma studio
```

This will open a web interface where you can view your MongoDB collections.

## Step 5: Start Your Development Server

```bash
npm run dev
```

## Key Changes Made to Your Schema

✅ **Provider changed**: `sqlite` → `mongodb`
✅ **IDs updated**: All IDs now use `@id @default(auto()) @map("_id") @db.ObjectId`
✅ **Foreign keys**: All foreign key fields now have `@db.ObjectId`
✅ **Data types**: Changed `Decimal` → `Float` (MongoDB compatible)
✅ **Database URL**: Now uses environment variable

## Common Issues & Solutions

### Issue 1: "EPERM: operation not permitted" on Windows

**Solution**: 
1. Stop your dev server (Ctrl+C)
2. Close VS Code/Cursor
3. Reopen and try again
4. If still fails, restart your computer

### Issue 2: Connection timeout

**Solution**:
- Check your MongoDB Atlas whitelist (Network Access)
- Verify your connection string is correct
- Check if username/password are URL encoded properly

### Issue 3: Authentication failed

**Solution**:
- Double-check username and password
- URL encode special characters in password
- Verify the database user has read/write permissions

### Issue 4: "database doesn't exist"

**Solution**: 
- MongoDB creates databases automatically
- Just run `npx prisma db push` and it will create the database

## Migrating Existing Data (Optional)

If you have data in your SQLite database that you want to migrate:

1. **Export from SQLite**:
   - Open Prisma Studio: `npx prisma studio`
   - Manually copy data (for small datasets)
   
2. **Or create a migration script**:
   - Read from SQLite using old schema
   - Write to MongoDB using new schema

## Next Steps

1. Set up your MongoDB (Atlas or local)
2. Update your `.env` file with the connection string
3. Run `npx prisma generate`
4. Run `npx prisma db push`
5. Test your application!

## Need Help?

- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/
- Prisma MongoDB Docs: https://www.prisma.io/docs/concepts/database-connectors/mongodb
- MongoDB Connection Strings: https://docs.mongodb.com/manual/reference/connection-string/

---

**Your schema is ready for MongoDB! 🚀**

