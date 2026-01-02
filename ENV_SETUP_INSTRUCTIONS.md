# 🔧 Environment Variables Setup

## Quick Setup (2 minutes)

### Step 1: Create .env File

In your project root directory (`C:\Users\Jash Gandhi\Downloads\runway-guardrails`), create a file named `.env` (note the dot at the beginning).

### Step 2: Add These Variables

Copy and paste this into your `.env` file:

```bash
# Database (you should already have this)
DATABASE_URL="your_existing_mongodb_connection_string"

# JWT Secret (you should already have this)
JWT_SECRET="your_existing_jwt_secret"

# Razorpay Payment Gateway - ADD THESE NEW LINES
# Get your keys from: https://dashboard.razorpay.com/app/keys

# Test Mode (for development - use these first!)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YYYYYYYYYYYYYYYY

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 3: Get Your Razorpay Keys

1. Go to https://razorpay.com/ and sign up (or log in)
2. Go to Settings → API Keys
3. Click "Generate Test Keys"
4. Copy the **Key ID** (starts with `rzp_test_`)
5. Copy the **Key Secret** (long random string)
6. Replace `rzp_test_XXXXXXXXXXXXX` and `YYYYYYYYYYYYYYYY` in your `.env` file

### Step 4: Restart Server

```bash
# Stop your current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## ✅ Verification

To verify Razorpay is configured:

1. Go to http://localhost:3000/dashboard/invoices
2. Create a test invoice
3. Click "💳 Send Payment Link" button
4. If you see a payment link → ✅ Working!
5. If you see "Razorpay not configured" → Check your `.env` file

---

## 🔐 Security Notes

- ✅ `.env` is already in `.gitignore` (won't be committed to git)
- ❌ NEVER share your `.env` file or commit it to git
- ❌ NEVER share your Razorpay Key Secret publicly
- ✅ Use Test Mode keys for development
- ✅ Use Live Mode keys only for production (after KYC)

---

## 📝 Example .env File

Here's what your complete `.env` file should look like:

```bash
# Database
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/runway-guardrails"

# JWT Secret
JWT_SECRET="some_random_secure_string_here"

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_abc123xyz789
RAZORPAY_KEY_SECRET=YourActualSecretKeyHere123456789

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🚀 Next Steps

After setup:
1. See **RAZORPAY_SETUP_GUIDE.md** for complete Razorpay setup
2. Test payment link generation
3. Set up webhook for automatic payment processing
4. Start collecting payments! 💰



