# 🚀 Create New MongoDB Atlas Cluster - Step by Step

Follow these steps exactly:

---

## Step 1: Create MongoDB Atlas Account

1. **Go to:** https://www.mongodb.com/cloud/atlas/register
2. **Sign up with:**
   - Email, Google, or GitHub
   - Choose a strong password
3. **Click "Create your Atlas account"**

---

## Step 2: Create a FREE Cluster (M0)

1. After signing up, you'll see "Create a deployment"
2. **Choose:** `M0 FREE` (the free tier)
3. **Provider:** Choose `AWS`, `Google Cloud`, or `Azure` (any is fine)
4. **Region:** Choose the closest region to you (e.g., `Mumbai (ap-south-1)` for India)
5. **Cluster Name:** Leave as `Cluster0` or name it `runway-guardrails`
6. **Click "Create Deployment"** (takes 3-5 minutes)

---

## Step 3: Create Database User

While the cluster is being created:

1. A popup will appear: "How would you like to authenticate your connection?"
2. **Choose "Username and Password"**
3. **Username:** `admin` (or any name you like)
4. **Password:** Click "Autogenerate Secure Password" 
   - ⚠️ **IMPORTANT:** Copy this password and save it somewhere!
   - Or create your own simple password like `Admin123456` (no special characters!)
5. **Click "Create Database User"**

---

## Step 4: Add Your IP Address (Network Access)

1. The next popup asks "Where would you like to connect from?"
2. **Choose "My Local Environment"**
3. **Click "Add My Current IP Address"**
   - OR click "Allow Access from Anywhere" (0.0.0.0/0) for easier access
4. **Click "Finish and Close"**

---

## Step 5: Get Connection String

1. **Go to "Database" in the left sidebar**
2. You'll see your cluster (probably called "Cluster0")
3. **Click "Connect" button**
4. Choose **"Drivers"**
5. Select:
   - **Driver:** Node.js
   - **Version:** 5.5 or later
6. **Copy the connection string** - it looks like:
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

---

## Step 6: Provide Me the Connection String

**IMPORTANT:** Replace `<password>` with your actual password from Step 3!

The final connection string should look like:
```
mongodb+srv://admin:YourActualPassword@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**Paste the complete connection string here and I'll configure everything!**

---

## Common Issues & Solutions

### ❌ "Can't find the Connect button"
- Make sure your cluster finished creating (look for green "Connected" status)
- Refresh the page

### ❌ "I lost my password"
- Go to **Database Access** in left sidebar
- Click **Edit** on your user
- Click **Edit Password**
- Generate a new one

### ❌ "Connection timeout"
- Go to **Network Access** in left sidebar
- Make sure your IP is whitelisted
- Or add `0.0.0.0/0` to allow all IPs

---

## Quick Summary

1. ✅ Create account at mongodb.com/cloud/atlas/register
2. ✅ Create FREE M0 cluster
3. ✅ Create database user (username + password)
4. ✅ Whitelist your IP (or allow 0.0.0.0/0)
5. ✅ Get connection string from "Connect" → "Drivers"
6. ✅ Replace `<password>` with actual password
7. ✅ Give me the connection string!

---

## Example of What I Need:

```
mongodb+srv://admin:MyPassword123@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
```

**Once you paste the connection string, I'll:**
1. ✅ Update your .env file
2. ✅ Test the connection
3. ✅ Initialize the database
4. ✅ Restart the server
5. ✅ Get you logged in!

**Go ahead and create the cluster, then paste the connection string here!** 🚀



