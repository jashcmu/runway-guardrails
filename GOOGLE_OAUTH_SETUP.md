# Google OAuth Setup Instructions

## Step 1: Go to Google Cloud Console

Visit: https://console.cloud.google.com/

## Step 2: Create a New Project

1. Click on the project dropdown at the top
2. Click "New Project"
3. Project name: **Runway Guardrails**
4. Click "Create"

## Step 3: Enable Google+ API (or People API)

1. Go to "APIs & Services" → "Library"
2. Search for "Google+ API" or "People API"
3. Click on it and click "Enable"

## Step 4: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Runway Guardrails
   - **User support email**: your email address
   - **Developer contact information**: your email address
5. Click "Save and Continue"
6. Skip "Scopes" (click "Save and Continue")
7. Add test users if needed (your email)
8. Click "Save and Continue"

## Step 5: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: **Runway Guardrails Web Client**
5. **Authorized redirect URIs** - Add these:
   - `http://localhost:3000/api/auth/callback/google` (for local development)
   - `https://your-app-name.vercel.app/api/auth/callback/google` (for production - add after deploying)
6. Click "Create"

## Step 6: Copy Your Credentials

You'll see a popup with:
- **Client ID**: Something like `123456789-abc.apps.googleusercontent.com`
- **Client Secret**: A long random string

**IMPORTANT**: Copy both of these! You'll need them for your `.env` file.

## Step 7: Add to Your .env File

Add these lines to your `.env` file in the project root:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"

# NextAuth
NEXTAUTH_SECRET="run-this-command: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

## Step 8: Generate NEXTAUTH_SECRET

Run this command in your terminal:

```bash
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET`.

If you don't have OpenSSL, you can use this Node.js command:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Step 9: Test Locally

1. Restart your development server: `npm run dev`
2. Go to http://localhost:3000/login
3. Click "Sign in with Google"
4. You should see the Google sign-in page
5. Sign in with your Google account
6. You should be redirected to the dashboard

## Step 10: For Production (After Deploying to Vercel)

1. Go back to Google Cloud Console → Credentials
2. Click on your OAuth client ID
3. Add your Vercel URL to "Authorized redirect URIs":
   - `https://your-app-name.vercel.app/api/auth/callback/google`
4. Click "Save"

5. In Vercel dashboard, add environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your Vercel app URL)

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure the redirect URI in Google Console exactly matches your app URL
- Don't forget the `/api/auth/callback/google` path
- Check for typos

### Error: "Access blocked: This app's request is invalid"
- Make sure you've configured the OAuth consent screen
- Add your email as a test user if the app is not published

### Error: "NEXTAUTH_URL is not set"
- Make sure `NEXTAUTH_URL` is in your `.env` file
- Restart your development server after adding it

## Security Notes

- Never commit your `.env` file to git
- Keep your Client Secret secure
- Use different credentials for development and production
- Regularly rotate your secrets

## Next Steps

After Google OAuth is working:
1. Test sign-in locally
2. Deploy to Vercel
3. Update redirect URIs with production URL
4. Test production sign-in
5. Celebrate! 🎉



