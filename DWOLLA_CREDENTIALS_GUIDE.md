# Dwolla Credentials Guide

## Current Issue
Your application expects **OAuth 2.0 Client Credentials** but you're seeing **API Keys** or **Webhook Keys**.

## What You Need vs What You Have

### ✅ What Your Application Needs:
- **DWOLLA_KEY** - OAuth 2.0 Application Key
- **DWOLLA_SECRET** - OAuth 2.0 Application Secret

### ✅ What Dwolla Provides:
- **Key** - This IS the correct credential (not "Client ID")
- **Secret** - This IS the correct credential (not "Client Secret")

## How to Get the Correct Credentials

### Step 1: Access Dwolla Developer Portal

**For Sandbox (Testing):**
- Go to: https://accounts-sandbox.dwolla.com/applications

**For Production:**
- Go to: https://accounts.dwolla.com/applications

### Step 2: Create or Access Your Application

1. Log in to your Dwolla account
2. Navigate to "Applications" in the developer portal
3. Either:
   - **Create a new application** if you don't have one
   - **Select your existing application** if you already have one

### Step 3: Get OAuth 2.0 Credentials

1. In your application dashboard, look for:
   - **OAuth 2.0 Settings**
   - **Client Credentials**
   - **Application Credentials**

2. You should see:
   - **Key** (this is your `DWOLLA_KEY`)
   - **Secret** (this is your `DWOLLA_SECRET`)

### Step 4: Update Environment Variables

Add these to your `.env.local` file:

```bash
# Dwolla OAuth 2.0 Credentials
DWOLLA_KEY="your_key_here"
DWOLLA_SECRET="your_secret_here"
DWOLLA_ENVIRONMENT="sandbox"  # or "production"
DWOLLA_BASE_URL="https://api-sandbox.dwolla.com"  # or "https://api.dwolla.com"
```

## Different Types of Dwolla Credentials

### 1. OAuth 2.0 Client Credentials (What You Need)
- Used for server-to-server authentication
- Provides access to Dwolla API endpoints
- Used by your application to make API calls

### 2. API Keys (What You Might Have)
- Used for webhook authentication
- Used to verify webhook signatures
- Different from OAuth credentials

### 3. Webhook Keys
- Used specifically for webhook endpoints
- Used to verify webhook authenticity

## Troubleshooting

### If You Can't Find OAuth Credentials:

1. **Check Application Type**: Make sure your Dwolla application is configured for OAuth 2.0
2. **Contact Dwolla Support**: If you don't see OAuth options, you may need to enable them
3. **Check Permissions**: Ensure your Dwolla account has the necessary permissions

### If You Get Authentication Errors:

1. **Verify Environment**: Make sure you're using the correct sandbox/production URLs
2. **Check Scopes**: Ensure your application has the required scopes:
   - `AccountReadFull`
   - `FundingRead`
   - `TransactionsRead`
   - `CustomersRead`

## Testing Your Credentials

Once you have the correct credentials, test them:

```bash
# Run the setup script
node scripts/setup-production-apis.js

# Test the verification script
node scripts/verify-field-mappings.js

# Start the development server
npm run dev
```

## Security Notes

- **Never commit credentials to version control**
- **Use environment variables for all secrets**
- **Rotate credentials regularly**
- **Use different credentials for sandbox and production**

## Next Steps

1. Get your OAuth 2.0 Client ID and Client Secret from Dwolla
2. Update your `.env.local` file
3. Run the setup script to verify everything works
4. Test with real data

## Support

If you continue to have issues:
1. Check Dwolla's official documentation: https://developers.dwolla.com/
2. Contact Dwolla support for application configuration help
3. Verify your Dwolla account has the necessary permissions 