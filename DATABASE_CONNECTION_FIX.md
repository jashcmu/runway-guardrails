# 🔧 MongoDB Connection Issue - FIXED

## ❌ Problem
```
Error: Kind: I/O error: received fatal alert: InternalError
Server selection timeout: No available servers
```

## ✅ Solutions (Choose One)

### **Option 1: Fix MongoDB Atlas Connection (Recommended)**

#### **Step 1: Check Your .env File**

Make sure you have a `.env` file in your project root with:

```env
DATABASE_URL="mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE?retryWrites=true&w=majority"
NEXTAUTH_SECRET="your-secret-key-here"
```

#### **Step 2: Fix MongoDB Atlas Settings**

1. **Go to MongoDB Atlas Dashboard:**
   ```
   https://cloud.mongodb.com/
   ```

2. **Whitelist Your IP:**
   - Click "Network Access" in left sidebar
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Or add your specific IP address
   - Click "Confirm"

3. **Get New Connection String:**
   - Click "Database" in left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Update your `.env` file

4. **Test Connection:**
   ```bash
   npx prisma db push
   ```

---

### **Option 2: Use Local MongoDB (Quick Fix)**

If you want to develop without internet connection:

#### **Step 1: Install MongoDB Locally**

**Windows:**
```bash
# Download from: https://www.mongodb.com/try/download/community
# Or use chocolatey:
choco install mongodb

# Start MongoDB:
mongod
```

#### **Step 2: Update .env**

```env
DATABASE_URL="mongodb://localhost:27017/runway-guardrails"
NEXTAUTH_SECRET="your-secret-key-here"
```

#### **Step 3: Push Schema**

```bash
npx prisma db push
```

---

### **Option 3: Create Fresh MongoDB Atlas Cluster**

If your current cluster has issues:

#### **Step 1: Create New Cluster**

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up or log in
3. Create a FREE cluster (M0)
4. Choose a region close to you
5. Create cluster (takes 3-5 minutes)

#### **Step 2: Create Database User**

1. Go to "Database Access"
2. Click "Add New Database User"
3. Username: `admin`
4. Password: Create a strong password (save it!)
5. Database User Privileges: "Atlas Admin"
6. Click "Add User"

#### **Step 3: Whitelist IP**

1. Go to "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere"
4. Click "Confirm"

#### **Step 4: Get Connection String**

1. Go to "Database"
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Choose "Node.js" and version "4.1 or later"
5. Copy the connection string
6. It looks like:
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

#### **Step 5: Update .env**

Create or update `.env` file in your project root:

```env
DATABASE_URL="mongodb+srv://admin:YOUR_PASSWORD_HERE@cluster0.xxxxx.mongodb.net/runway-guardrails?retryWrites=true&w=majority"
NEXTAUTH_SECRET="put-any-random-string-here-min-32-chars"
```

**Replace:**
- `YOUR_PASSWORD_HERE` with your actual password (from Step 2)
- `cluster0.xxxxx` with your actual cluster URL
- Add `/runway-guardrails` before the `?` to specify database name

#### **Step 6: Initialize Database**

```bash
npx prisma db push
```

---

## 🚀 After Fixing Connection

### **Step 1: Stop Current Server**

Press `Ctrl+C` in the terminal where dev server is running

### **Step 2: Restart Server**

```bash
npm run dev
```

### **Step 3: Test Connection**

Open: http://localhost:3000

You should see the login page without database errors!

---

## ✅ Quick Checklist

Before starting server, ensure:

- [ ] `.env` file exists in project root
- [ ] `DATABASE_URL` is set correctly
- [ ] MongoDB Atlas IP whitelist includes your IP (or 0.0.0.0/0)
- [ ] Password in connection string has no special characters (or is URL-encoded)
- [ ] Database user has proper permissions
- [ ] `npx prisma generate` ran successfully
- [ ] `npx prisma db push` ran successfully

---

## 🔍 Common Issues & Fixes

### **Issue 1: "Authentication failed"**
**Fix:** Password is wrong in connection string. Use the password from MongoDB Atlas, not your Atlas login password.

### **Issue 2: "IP not whitelisted"**
**Fix:** Go to Network Access → Add IP Address → Allow from Anywhere

### **Issue 3: "Connection timeout"**
**Fix:** 
- Check your internet connection
- Try different network (mobile hotspot)
- VPN might be blocking connection

### **Issue 4: Special characters in password**
**Fix:** URL-encode special characters:
- `@` becomes `%40`
- `#` becomes `%23`
- `$` becomes `%24`
- `%` becomes `%25`

### **Issue 5: "Invalid connection string"**
**Fix:** Make sure format is correct:
```
mongodb+srv://username:password@cluster.xxxxx.mongodb.net/database?retryWrites=true&w=majority
```

---

## 📝 Sample .env File

```env
# MongoDB Atlas Connection
DATABASE_URL="mongodb+srv://admin:MyPassword123@cluster0.abc123.mongodb.net/runway-guardrails?retryWrites=true&w=majority"

# Auth Secret (any random string)
NEXTAUTH_SECRET="this-is-a-very-long-random-secret-key-for-authentication"

# Optional: OpenAI API Key (for AI features)
OPENAI_API_KEY="sk-your-openai-key-here"
```

---

## 🎯 Fastest Fix (If You're in a Hurry)

1. **Use this .env:**
   ```env
   DATABASE_URL="mongodb://localhost:27017/runway-guardrails"
   NEXTAUTH_SECRET="quick-dev-secret-key-123456789"
   ```

2. **Install & Start MongoDB locally:**
   ```bash
   # Windows (with Chocolatey):
   choco install mongodb
   mongod

   # Or download from: https://www.mongodb.com/try/download/community
   ```

3. **Push schema:**
   ```bash
   npx prisma db push
   ```

4. **Start dev server:**
   ```bash
   npm run dev
   ```

Done! Server will work with local MongoDB.

---

## ✅ Success Indicators

When connection works, you'll see:

```bash
▲ Next.js 16.1.1 (Turbopack)
- Local:   http://localhost:3000
✓ Ready in 4.2s
```

**No Prisma errors!**

Navigate to http://localhost:3000/register to create your account!

---

**Which option do you want to use?**
1. Fix MongoDB Atlas (best for production)
2. Use local MongoDB (fastest for development)
3. Create new Atlas cluster (fresh start)



