# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth for the Unified Customer Dashboard application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create a Google Cloud Project](#create-a-google-cloud-project)
3. [Enable APIs](#enable-apis)
4. [Configure OAuth Consent Screen](#configure-oauth-consent-screen)
5. [Create OAuth 2.0 Credentials](#create-oauth-20-credentials)
6. [Configure Redirect URIs](#configure-redirect-uris)
7. [Set Environment Variables](#set-environment-variables)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Your application URLs for each environment (local, staging, production)

## Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "Unified Customer Dashboard")
5. Click "Create"
6. Wait for the project to be created and then select it

## Enable APIs

1. In your Google Cloud Project, go to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - **Google+ API** (required for OAuth)
   - **Google Identity Toolkit API** (optional, for enhanced features)

## Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose user type:
   - **Internal**: Only users within your Google Workspace can access (recommended for company apps)
   - **External**: Any Google account can access (requires verification for production)

3. Fill in the application information:
   - **App name**: Unified Customer Dashboard
   - **User support email**: Your support email
   - **App logo**: Upload your company logo (optional)

4. **Scopes**: Add the following scopes:
   - `openid` - Required for authentication
   - `email` - To get user's email address
   - `profile` - To get user's name and picture

5. **Test users** (for External apps only):
   - Add email addresses that can access the app during testing
   - Include all developer and tester emails

6. Save and continue through all steps

## Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. Choose application type: **Web application**
4. Configure the client:
   - **Name**: Choose a descriptive name (e.g., "UCD Local Development" or "UCD Production")

## Configure Redirect URIs

Add the appropriate redirect URIs for each environment once you have your domains configured:

### Local Development

```
Authorized redirect URIs:
- http://localhost:3000/api/auth/callback/google
```

### Staging Environment (when configured)

```
Authorized redirect URIs:
- https://[your-staging-domain]/api/auth/callback/google
```

### Production Environment (when configured)

```
Authorized redirect URIs:
- https://[your-production-domain]/api/auth/callback/google
- https://www.[your-production-domain]/api/auth/callback/google (if using www)
```

**Important**:

- You'll need to add these URIs once you have your domains set up
- Add ALL domains you'll use
- Include both www and non-www versions if applicable
- The path must be exactly `/api/auth/callback/google`
- For now, you can start with just the localhost URI for local development

## Set Environment Variables

1. After creating the OAuth client, you'll see:
   - **Client ID**: Looks like `1234567890-abcdefghijklmnop.apps.googleusercontent.com`
   - **Client secret**: Click "SHOW CLIENT SECRET" to reveal

2. Copy these values to your environment file:

```bash
# .env.local (for development)
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

**Security Notes**:

- Never commit these values to version control
- Use different OAuth clients for each environment
- Rotate credentials periodically
- Store production credentials in a secure secret manager

## Testing

### Local Testing

1. Ensure your `.env.local` file has the correct values:

```bash
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

2. Run the development server:

```bash
npm run dev
```

3. Navigate to http://localhost:3000/auth/signin
4. Click "Sign in with Google"
5. You should be redirected to Google's OAuth consent page
6. After authorization, you should be redirected back to your app

### Common Issues During Testing

1. **Redirect URI mismatch**:
   - Double-check the URI in Google Console matches exactly
   - Include the port number for localhost

2. **Invalid client**:
   - Ensure you're using the correct client ID and secret
   - Check for extra spaces or newlines in env values

3. **Access blocked**:
   - For external apps, ensure the testing email is in the test users list

## Production Deployment

### 1. Create Production OAuth Client

Create a separate OAuth client for production:

- Use your production domain(s)
- Never reuse development credentials

### 2. Domain Verification (External Apps)

For external apps, verify your domain:

1. Go to "OAuth consent screen" > "Domain verification"
2. Add and verify your production domain
3. Follow Google's verification process

### 3. App Verification (External Apps)

If you have sensitive scopes or 100+ users:

1. Submit your app for verification
2. Provide required documentation
3. Wait for Google's review (can take weeks)

### 4. Security Best Practices

- **Restrict by domain**: Use Google Workspace domain restrictions if possible
- **IP restrictions**: Add IP allowlists in production
- **Monitor usage**: Check OAuth analytics regularly
- **Implement rate limiting**: Prevent abuse of your OAuth endpoints

## Troubleshooting

### Error: "Access blocked: This app's request is invalid"

**Cause**: Redirect URI mismatch
**Solution**:

1. Check the exact error message for the expected URI
2. Add that exact URI to your OAuth client configuration
3. Wait 5-10 minutes for changes to propagate

### Error: "Invalid client_id"

**Cause**: Wrong or malformed client ID
**Solution**:

1. Verify you're using the correct environment's credentials
2. Check for typos or extra characters
3. Ensure the OAuth client is not deleted or disabled

### Error: "User is not authorized"

**Cause**: Email not in authorized list (using AUTHORIZED_EMAILS)
**Solution**:

1. Add the email to your `.env` file's AUTHORIZED_EMAILS
2. For Google Workspace, check domain restrictions
3. Verify the user's email is being returned correctly

### Error: "Redirect URI not allowed"

**Cause**: URI not configured in Google Console
**Solution**:

1. Go to your OAuth client settings
2. Add the exact URI shown in the error
3. Common mistakes:
   - Missing port for localhost
   - http vs https mismatch
   - Trailing slashes

### Debugging Tips

1. **Enable debug logging**:

```javascript
// In your [...nextauth]/route.ts
export const authOptions = {
  debug: process.env.NODE_ENV === "development",
  // ... rest of config
}
```

2. **Check browser network tab**:
   - Look for the OAuth flow redirects
   - Check for error parameters in URLs

3. **Test with curl**:

```bash
# Test if your callback URL is accessible
curl -I https://yourdomain.com/api/auth/callback/google
```

## Additional Resources

- [NextAuth.js Google Provider Docs](https://next-auth.js.org/providers/google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com)

## Support

If you encounter issues not covered here:

1. Check the application logs
2. Review NextAuth.js debug output
3. Consult the Google OAuth error reference
4. Contact your DevOps team for production issues
