# Dwolla Webhook Setup Guide

This guide will help you set up Dwolla webhooks for real-time event processing in the Unified Customer Dashboard.

## Prerequisites

1. Active Dwolla account (Sandbox or Production)
2. Application deployed with a publicly accessible URL
3. SSL/TLS certificate (HTTPS required for production)

## Configuration Steps

### 1. Set Environment Variables

Add the following to your `.env` file:

```bash
# Dwolla Webhook Configuration
DWOLLA_WEBHOOK_SECRET=your-webhook-secret-here
NEXTAUTH_URL=https://your-domain.com  # Your application's public URL
```

### 2. Get Your Webhook URL

Your webhook endpoint URL will be:
```
https://your-domain.com/api/webhooks/dwolla/v2
```

### 3. Create Webhook Subscription in Dwolla

#### Option A: Using Dwolla Dashboard

1. Log in to your Dwolla account
2. Navigate to **Applications** → **Webhooks**
3. Click **Create Webhook Subscription**
4. Enter your webhook URL
5. Set a webhook secret (save this for `DWOLLA_WEBHOOK_SECRET`)
6. Select the events you want to receive
7. Save the subscription

#### Option B: Using the API

Run this script to create a webhook subscription programmatically:

```typescript
import { DwollaClient } from '@/lib/api/dwolla/client'

const client = new DwollaClient()
const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2`
const secret = process.env.DWOLLA_WEBHOOK_SECRET

await client.createWebhookSubscription(webhookUrl, secret)
```

### 4. Test Webhook Connection

1. Navigate to **Analytics** → **Webhook Settings** in the dashboard
2. Click **Sync Webhook Events** to import historical events
3. Check the webhook status and recent activity

### 5. Verify Webhook Signature

The application automatically verifies webhook signatures using HMAC-SHA256. Ensure your `DWOLLA_WEBHOOK_SECRET` matches the secret configured in Dwolla.

## Available Webhook Events

The system captures and processes all Dwolla webhook events, including:

- **Customer Events**: created, verified, suspended, deactivated
- **Transfer Events**: created, pending, processed, failed, cancelled
- **Funding Source Events**: added, verified, removed
- **Micro-deposit Events**: initiated, completed, failed
- **Bank Transfer Events**: created, completed, failed

## Monitoring Webhooks

### Real-time Monitoring
- Navigate to **Analytics** → **Webhooks** → **Real-time** tab
- View live webhook events as they arrive
- Monitor processing status and latency

### Event Analytics
- **Overview**: Summary statistics and trends
- **Events**: Detailed event log with filtering
- **Journeys**: Track user journeys through events
- **Reconciliation**: Verify data consistency
- **Anomalies**: Detect unusual patterns

## Troubleshooting

### Webhook Not Receiving Events

1. Verify webhook URL is publicly accessible:
   ```bash
   curl -X GET https://your-domain.com/api/webhooks/dwolla/v2
   ```
   Should return: `{"status":"healthy",...}`

2. Check webhook subscription status in Dwolla dashboard
3. Ensure subscription is not paused
4. Verify SSL certificate is valid

### Signature Verification Failures

1. Ensure `DWOLLA_WEBHOOK_SECRET` matches exactly
2. Check for trailing spaces or newlines in the secret
3. Verify the webhook payload hasn't been modified by a proxy

### Missing Events

1. Use the **Sync Historical Webhooks** feature to backfill events
2. Check the event timestamp range in your sync request
3. Verify the events exist in Dwolla's system

## Security Best Practices

1. **Always verify signatures** - The system automatically does this
2. **Use HTTPS** - Required for production webhooks
3. **Rotate secrets regularly** - Update both in Dwolla and your environment
4. **Monitor for anomalies** - Use the anomaly detection features
5. **Implement idempotency** - The system handles duplicate events automatically

## Testing in Development

For local development, use a tunneling service like ngrok:

```bash
# Install ngrok
brew install ngrok

# Start your dev server
npm run dev

# In another terminal, create tunnel
ngrok http 3000

# Use the HTTPS URL from ngrok as your webhook URL
```

## API Rate Limits

- Dwolla API: 60 requests per minute
- Webhook processing: Unlimited (events are queued)
- Historical sync: Limited to 500 events per request

## Next Steps

1. Set up alerts for webhook failures
2. Configure journey definitions for your use cases
3. Set up data retention policies
4. Implement custom event processors for business logic