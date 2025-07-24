# Dwolla API Setup for Real Data

This guide will help you configure the Unified Customer Dashboard to fetch real ACH transaction data from Dwolla.

## Prerequisites

1. A Dwolla account (Sandbox or Production)
2. API credentials (Key and Secret)
3. Your Master Account ID

## Configuration Steps

### 1. Environment Variables

Update your `.env.local` file with your Dwolla credentials:

```env
# Dwolla API Configuration
DWOLLA_KEY=your-dwolla-key
DWOLLA_SECRET=your-dwolla-secret
DWOLLA_ENVIRONMENT=sandbox  # Use 'production' for live data
DWOLLA_BASE_URL=https://api-sandbox.dwolla.com  # Use https://api.dwolla.com for production
DWOLLA_MASTER_ACCOUNT_ID=your-master-account-id  # Your main account ID

# Disable demo mode to use real data
DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false
```

### 2. Finding Your Master Account ID

Your Master Account ID is needed to determine transaction direction (credit/debit). To find it:

1. Log into your Dwolla Dashboard
2. Navigate to your account settings
3. Copy your Account ID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 3. Test the Connection

Run the test script to verify your connection:

```bash
npm run tsx scripts/test-dwolla-connection.ts
```

You should see output like:

```
Testing Dwolla API connection...

1. Testing transfer fetch...
✓ Successfully fetched transfers. Found 5 transfers
   First transfer ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

2. Testing ACH sync service...
✓ Sync completed. Synced: 5, Failed: 0

Dwolla connection test completed!
```

### 4. Initial Data Sync

Once the connection is verified, you can sync data through the UI:

1. Navigate to the Billing page (`/billing`)
2. Click the "Sync from Dwolla" button (only visible when not in demo mode)
3. The sync will fetch the last 100 transactions by default

### 5. Automatic Updates

The billing page automatically refreshes data every 30 seconds. For real-time updates, you can:

1. Use the manual "Refresh" button
2. Implement webhooks (see below)

## Webhook Setup (Optional)

For real-time transaction updates, configure Dwolla webhooks:

### 1. Create Webhook Subscription

Use Dwolla's API or Dashboard to create a webhook subscription pointing to:

```
https://your-domain.com/api/webhooks/dwolla
```

### 2. Subscribe to Events

Subscribe to these event topics:

- `transfer_created`
- `transfer_completed`
- `transfer_failed`
- `transfer_cancelled`
- `transfer_reclaimed`

### 3. Implement Webhook Handler

The webhook endpoint is already stubbed at `/app/api/webhooks/dwolla/route.ts`. You'll need to:

1. Verify webhook signatures
2. Parse the event data
3. Update the corresponding transaction in the database

## API Rate Limits

Dwolla API has the following rate limits:

- Sandbox: 60 requests per minute
- Production: 60 requests per minute

The client automatically handles rate limiting with exponential backoff.

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Verify your API credentials are correct
   - Check that credentials match the environment (sandbox vs production)

2. **No transactions found**
   - Ensure your account has transaction history
   - Check date filters aren't excluding all transactions
   - Verify the Master Account ID is correct

3. **Rate limit errors**
   - The sync button has a 5 sync/minute limit
   - Dwolla API has 60 requests/minute limit
   - Wait a moment and try again

### Debug Mode

Enable debug logging by setting:

```env
LOG_LEVEL=debug
```

This will show detailed API requests and responses in the console.

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use read-only scopes** - The app only needs read access to transfers
3. **Rotate keys regularly** - Update API keys every 90 days
4. **Monitor usage** - Check Dwolla Dashboard for unusual activity

## Support

For Dwolla API issues:

- Documentation: https://docs.dwolla.com
- API Reference: https://docs.dwolla.com/#api-reference
- Support: https://www.dwolla.com/support

For dashboard issues:

- Check the application logs
- Review error messages in the browser console
- Contact your system administrator
