# Fix Google OAuth Authentication

## Issue
The authentication is failing because the server is running on port 3003 instead of 3000, but Google OAuth is configured for port 3000.

## Solution Steps

### 1. Update Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

Find your OAuth 2.0 Client ID (the one matching your GOOGLE_CLIENT_ID):
- Client ID: `484151513813-q097el2764024669kjbknm0r028sah1q.apps.googleusercontent.com`

Click on it to edit and add these URLs:

#### Authorized JavaScript origins:
- `http://localhost:3003`
- `http://localhost:3000` (keep this as backup)

#### Authorized redirect URIs:
- `http://localhost:3003/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google` (keep this as backup)

### 2. Test the Authentication

After updating Google Cloud Console (changes may take up to 5 minutes to propagate):

1. Clear your browser cookies for localhost
2. Visit: http://localhost:3003/auth/signin
3. Click "Sign in with Google"
4. Complete the Google authentication flow

### 3. Alternative: Use Port 3000

If you prefer to use port 3000, you can:

1. Kill the process using port 3000:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. Update .env.local back to port 3000:
   ```
   NEXTAUTH_URL="http://localhost:3000"
   APP_URL="http://localhost:3000"
   ```

3. Restart the dev server

### 4. Debug URLs

Test these URLs to verify configuration:
- Auth Debug: http://localhost:3003/api/auth/debug
- Test Callback: http://localhost:3003/api/auth/callback/test?code=test&state=test
- Sign In: http://localhost:3003/auth/signin

### 5. Common Issues

- **OAuth Error: redirect_uri_mismatch**
  - The redirect URI in Google Console must match EXACTLY (including protocol and port)
  
- **Stuck on loading**
  - Check browser console for errors
  - Ensure Google OAuth app is not in "Testing" mode with expired access
  
- **Invalid credentials**
  - Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
  - Make sure they're from the same OAuth 2.0 Client ID

### Current Configuration

```
NEXTAUTH_URL: http://localhost:3003
Callback URL: http://localhost:3003/api/auth/callback/google
```