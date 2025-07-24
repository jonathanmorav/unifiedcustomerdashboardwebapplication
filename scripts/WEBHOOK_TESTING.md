# Dwolla Webhook Testing Guide

This guide explains how to test the Dwolla webhook integration for ACH return code capture.

## Prerequisites

1. Ensure your local development server is running:
   ```bash
   npm run dev
   ```

2. Set your webhook secret in `.env.local`:
   ```
   DWOLLA_WEBHOOK_SECRET=your-test-secret
   ```

## Basic Usage

Test different webhook events using the provided script:

### Test Failed Transaction with Return Code
```bash
npm run test:webhook -- --event transfer_failed --code R01
```

### Test Returned Transaction
```bash
npm run test:webhook -- --event transfer_returned --code R02
```

### Test Successful Transaction
```bash
npm run test:webhook -- --event transfer_completed
```

### Test with Random Return Code
```bash
npm run test:webhook -- --event transfer_failed --random-code
```

### Dry Run (Preview Without Sending)
```bash
npm run test:webhook -- --event transfer_failed --code R01 --dry-run
```

## Common Return Codes for Testing

- **R01** - Insufficient Funds
- **R02** - Account Closed
- **R03** - No Account/Unable to Locate
- **R04** - Invalid Account Number
- **R07** - Authorization Revoked
- **R08** - Payment Stopped
- **R10** - Customer Advises Not Authorized
- **R16** - Account Frozen
- **R20** - Non-Transaction Account
- **R29** - Corporate Customer Not Authorized

## Testing Workflow

1. **Create Test Transactions**: First sync some transactions from Dwolla or use demo mode
2. **Send Webhook Events**: Use the test script to simulate various failure scenarios
3. **Verify Updates**: Check the billing page to see updated transaction statuses and return codes
4. **View Details**: Click on failed transactions to see comprehensive return code information

## Advanced Options

- `--url <url>`: Custom webhook URL (default: http://localhost:3000/api/webhooks/dwolla)
- `--secret <secret>`: Custom webhook secret
- `--transfer-id <id>`: Test with specific transfer ID from your database

## Monitoring Webhook Processing

1. Watch server logs for webhook processing messages
2. Check the transaction table for updated statuses
3. Verify return codes appear in the UI with tooltips
4. Test the failure analytics tab for aggregated data

## Troubleshooting

- **401 Unauthorized**: Check your webhook secret matches between script and .env
- **404 Not Found**: Ensure the webhook route exists at `/api/webhooks/dwolla`
- **No Updates**: Check if the transfer ID exists in your database
- **Missing Return Codes**: Verify the webhook payload includes return code fields