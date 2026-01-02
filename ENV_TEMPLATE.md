# Environment Variables Template

Copy these to your `.env` file:

```bash
# ========================================
# DATABASE - MongoDB Atlas
# ========================================
DATABASE_URL="mongodb+srv://username:password@cluster0.ier73ze.mongodb.net/runway-guardrails"

# ========================================
# NEXTAUTH - OAuth Authentication
# ========================================
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-random-32-char-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# ========================================
# GOOGLE OAUTH
# ========================================
# Get from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# ========================================
# RAZORPAY PAYMENT GATEWAY
# ========================================
RAZORPAY_KEY_ID="rzp_test_XXXXXXXXXXXXX"
RAZORPAY_KEY_SECRET="YYYYYYYYYYYYYYYY"

# ========================================
# APPLICATION URL
# ========================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ========================================
# JWT (Legacy - for backward compatibility)
# ========================================
JWT_SECRET="your-existing-jwt-secret"
```

## For Production (Vercel):

Use the same variables but with production values:
- `NEXTAUTH_URL` → `https://your-app.vercel.app`
- `NEXT_PUBLIC_APP_URL` → `https://your-app.vercel.app`
- `RAZORPAY_KEY_ID/SECRET` → Live mode keys (after KYC)


