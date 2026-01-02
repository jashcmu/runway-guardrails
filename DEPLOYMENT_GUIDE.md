# 🚀 Deployment Guide - Vercel & Google OAuth

## ✅ What's Been Completed

1. ✅ NextAuth.js installed
2. ✅ Database schema updated with OAuth models
3. ✅ Google Sign-In button added to login page
4. ✅ NextAuth API routes created
5. ✅ Prisma migrations pushed to MongoDB Atlas

## 📋 What You Need To Do Now

### Phase 1: Set Up Google OAuth (15 minutes)

Follow the instructions in **`GOOGLE_OAUTH_SETUP.md`** to:
1. Create a Google Cloud project
2. Enable Google+ API
3. Configure OAuth consent screen
4. Create OAuth 2.0 Client ID
5. Get your Client ID and Client Secret

### Phase 2: Configure Environment Variables (5 minutes)

#### Local Development

Add these to your `.env` file:

```bash
# MongoDB Atlas (YOU ALREADY HAVE THIS)
DATABASE_URL="mongodb+srv://jashvng_db_user:password@cluster0.ier73ze.mongodb.net/runway-guardrails"

# NextAuth (NEW - ADD THESE)
NEXTAUTH_SECRET="generate-with-command-below"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (NEW - FROM GOOGLE CONSOLE)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Razorpay (YOU ALREADY HAVE THIS)
RAZORPAY_KEY_ID="rzp_test_xxx"
RAZORPAY_KEY_SECRET="xxx"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# JWT (KEEP FOR BACKWARD COMPATIBILITY)
JWT_SECRET="your-existing-jwt-secret"
```

#### Generate NEXTAUTH_SECRET

Run this command:
```bash
openssl rand -base64 32
```

Or if you don't have OpenSSL:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Phase 3: Test Locally (5 minutes)

1. **Restart your server:**
```bash
npm run dev
```

2. **Test Google Sign-In:**
   - Go to http://localhost:3000/login
   - Click "Sign in with Google"
   - Sign in with your Google account
   - You should be redirected to dashboard

3. **If you see errors:**
   - Check that all environment variables are set
   - Make sure Google OAuth redirect URI is correct
   - Check server logs for errors

### Phase 4: Deploy to Vercel (20 minutes)

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

#### Step 3: Deploy

```bash
cd "C:\Users\Jash Gandhi\Downloads\runway-guardrails"
vercel
```

Answer the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Your personal account
- **Link to existing project?** No
- **Project name?** runway-guardrails (or your choice)
- **Directory?** ./ (default)
- **Want to override settings?** No

Vercel will deploy and give you a URL like: `https://runway-guardrails-abc123.vercel.app`

#### Step 4: Configure Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Your MongoDB Atlas connection string | Same as local |
| `NEXTAUTH_SECRET` | Generate a new one with `openssl rand -base64 32` | Different from local |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your Vercel URL |
| `GOOGLE_CLIENT_ID` | From Google Console | Same as local |
| `GOOGLE_CLIENT_SECRET` | From Google Console | Same as local |
| `RAZORPAY_KEY_ID` | `rzp_live_xxx` | Use LIVE mode for production |
| `RAZORPAY_KEY_SECRET` | Your live secret | Use LIVE mode for production |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel URL |
| `JWT_SECRET` | Your existing JWT secret | For backward compatibility |

5. Click "Save" for each variable

#### Step 5: Update Google OAuth Redirect URI

1. Go back to Google Cloud Console
2. Go to "Credentials" → Your OAuth Client ID
3. Add to "Authorized redirect URIs":
   ```
   https://your-app-name.vercel.app/api/auth/callback/google
   ```
4. Click "Save"

#### Step 6: Deploy to Production

```bash
vercel --prod
```

This deploys your app to production with all environment variables.

#### Step 7: Test Production

1. Go to your Vercel URL: `https://your-app.vercel.app`
2. Click "Sign in with Google"
3. Sign in and verify it works
4. Check that all features work:
   - Dashboard loads
   - Transactions display
   - Invoices page works
   - Razorpay payment links work

### Phase 5: Verify MongoDB Atlas Access

1. Go to MongoDB Atlas dashboard
2. Go to "Network Access"
3. Make sure `0.0.0.0/0` is allowed (required for Vercel)
4. If not, click "Add IP Address" → "Allow Access from Anywhere"

### Phase 6: Set Up Razorpay Webhook (Optional but Recommended)

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/payments/razorpay/webhook`
3. Select events:
   - payment.captured
   - payment.failed
   - payment.authorized
   - refund.created
   - order.paid
4. Save webhook

---

## 🎯 Testing Checklist

### Local Testing
- [ ] Google Sign-In works
- [ ] Redirects to dashboard after sign-in
- [ ] User data is saved to MongoDB
- [ ] Existing features still work

### Production Testing
- [ ] Vercel deployment successful
- [ ] Google Sign-In works on production
- [ ] Dashboard loads correctly
- [ ] Transactions display
- [ ] Invoices page works
- [ ] Bills page works
- [ ] Razorpay payment links work
- [ ] Mobile responsive
- [ ] No console errors

---

## 🔧 Troubleshooting

### Issue: "redirect_uri_mismatch"
**Solution**: Make sure the redirect URI in Google Console matches exactly:
- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://your-app.vercel.app/api/auth/callback/google`

### Issue: "NEXTAUTH_URL is not set"
**Solution**: 
1. Check `.env` file has `NEXTAUTH_URL`
2. Restart your server
3. For Vercel, check environment variables in dashboard

### Issue: "Database connection failed"
**Solution**:
1. Check `DATABASE_URL` is correct
2. Verify MongoDB Atlas allows connections from `0.0.0.0/0`
3. Check username/password are correct

### Issue: "Prisma Client not found"
**Solution**:
```bash
npx prisma generate
```

### Issue: Build fails on Vercel
**Solution**:
1. Check all environment variables are set in Vercel
2. Make sure `DATABASE_URL` is accessible
3. Check build logs for specific errors

---

## 📊 What Happens After Deployment

### For New Users:
1. Click "Sign in with Google"
2. Authorize with Google
3. Account created automatically
4. Redirected to onboarding (if no companies)
5. Create company and start using the app

### For Existing Users (with email/password):
- Can still log in with email/password (backward compatible)
- Can link Google account by signing in with Google using same email
- Eventually, encourage migration to Google OAuth

---

## 🎉 Success!

Once deployed, your app will be live at:
**https://your-app-name.vercel.app**

Features:
- ✅ Professional Google OAuth authentication
- ✅ Automatic user management
- ✅ Secure session handling
- ✅ Production-ready MongoDB Atlas database
- ✅ Razorpay payment integration
- ✅ Real-time financial analytics
- ✅ Mobile responsive
- ✅ HTTPS secure

---

## 📈 Next Steps

1. **Custom Domain** (Optional):
   - Buy a domain (e.g., runwayguardrails.com)
   - Add to Vercel project
   - Update `NEXTAUTH_URL` and Google OAuth redirect URIs

2. **Monitoring**:
   - Set up Vercel Analytics
   - Monitor error logs
   - Track user sign-ins

3. **Features**:
   - Add profile page
   - Add team member invites
   - Add email notifications
   - Add more OAuth providers (GitHub, Microsoft)

4. **Razorpay Live Mode**:
   - Complete KYC verification
   - Switch to live mode keys
   - Test real payments

---

## 🆘 Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **NextAuth Docs**: https://next-auth.js.org/
- **Google OAuth**: https://console.cloud.google.com/
- **MongoDB Atlas**: https://cloud.mongodb.com/

---

**Total Time**: ~45 minutes
- Google OAuth setup: 15 min
- Environment variables: 5 min
- Local testing: 5 min
- Vercel deployment: 20 min

Good luck! 🚀


