# Billing Page Sync Scripts

This document describes the enhanced billing page sync scripts that pull customer-initiated transfers from Dwolla into your unified customer dashboard.

## Overview

The billing sync system consists of two main scripts:

1. **`billing-page-sync.ts`** - The core sync engine with comprehensive features
2. **`run-billing-sync.ts`** - A convenient runner with predefined configurations

These scripts are specifically designed to:
- Pull **only customer-initiated transfers** (credits to Cakewalk)
- Provide detailed progress reporting and statistics
- Support flexible filtering and date ranges
- Handle large datasets efficiently with batch processing
- Offer both dry-run and live sync modes

## Quick Start

### Check Current Status
```bash
npm run billing:sync:status
```

### Run a Quick Sync (Last 7 Days)
```bash
npm run billing:sync:quick
```

### Run a Full Sync (Last 90 Days)
```bash
npm run billing:sync:full
```

### Sync Today's Transactions Only
```bash
npm run billing:sync:today
```

### Test What Would Be Synced (Dry Run)
```bash
npm run billing:sync:dry
```

## Available Commands

### Pre-configured NPM Scripts

| Command | Description | Date Range | Batch Size |
|---------|-------------|------------|------------|
| `npm run billing:sync` | Default quick sync | Last 7 days | 100 |
| `npm run billing:sync:quick` | Quick sync for recent data | Last 7 days | 100 |
| `npm run billing:sync:full` | Comprehensive sync | Last 90 days | 200 |
| `npm run billing:sync:today` | Today's transactions only | Today | 50 |
| `npm run billing:sync:status` | Show current database status | N/A | N/A |
| `npm run billing:sync:dry` | Dry run (no changes) | Last 7 days | 100 |

### Direct Script Usage

You can also run the scripts directly with more control:

```bash
# Run with custom date range
npm run tsx scripts/run-billing-sync.ts custom --start-date 2024-01-01 --end-date 2024-01-31

# Sync failed transactions only
npm run tsx scripts/run-billing-sync.ts failed --verbose

# Sync pending transactions
npm run tsx scripts/run-billing-sync.ts pending

# Run with custom parameters
npm run tsx scripts/billing-page-sync.ts --start-date 2024-01-01 --limit 500 --verbose
```

## Command Reference

### Available Sync Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `quick` | Last 7 days of transfers | Daily maintenance |
| `full` | Last 90 days of transfers | Initial setup or major sync |
| `today` | Today's transactions only | Real-time updates |
| `week` | This week's transactions | Weekly reporting |
| `month` | This month's transactions | Monthly reconciliation |
| `failed` | Re-sync failed transactions | Error recovery |
| `pending` | Sync pending/processing transactions | Status updates |
| `custom` | Sync with custom parameters | Specific requirements |
| `status-check` | Show database status | Monitoring |

### Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--start-date` | Start date (YYYY-MM-DD) | `--start-date 2024-01-01` |
| `--end-date` | End date (YYYY-MM-DD) | `--end-date 2024-01-31` |
| `--limit` | Max transactions to sync | `--limit 1000` |
| `--dry-run` | Show what would be synced | `--dry-run` |
| `--force-refresh` | Re-sync existing transactions | `--force-refresh` |
| `--batch-size` | Batch processing size | `--batch-size 100` |
| `--verbose` | Show detailed progress | `--verbose` |
| `--status-filter` | Filter by status | `--status-filter pending,failed` |
| `--help` | Show help information | `--help` |

## Examples

### Basic Usage Examples

```bash
# Quick daily sync
npm run billing:sync:quick

# Full sync with detailed output
npm run billing:sync:full --verbose

# Sync specific date range
npm run tsx scripts/run-billing-sync.ts custom \
  --start-date 2024-12-01 \
  --end-date 2024-12-31 \
  --verbose

# Test sync without making changes
npm run tsx scripts/run-billing-sync.ts full --dry-run

# Sync only failed transactions
npm run tsx scripts/run-billing-sync.ts failed --force-refresh
```

### Advanced Usage Examples

```bash
# Large dataset sync with custom batch size
npm run tsx scripts/billing-page-sync.ts \
  --start-date 2024-01-01 \
  --limit 5000 \
  --batch-size 50 \
  --verbose

# Status-specific sync
npm run tsx scripts/run-billing-sync.ts custom \
  --status-filter "pending,processing" \
  --force-refresh \
  --verbose

# Weekend batch processing
npm run tsx scripts/run-billing-sync.ts week \
  --batch-size 500 \
  --verbose
```

## Output and Reporting

### Progress Reporting

During sync, you'll see real-time progress:

```
🏦 Enhanced Billing Page Sync for Customer-Initiated Transfers
=================================================================
📅 Date Range: 2024-12-01 to 2024-12-31
🔢 Transaction Limit: Unlimited
📦 Batch Size: 200
🏃 Mode: LIVE SYNC
🔄 Force Refresh: No

📊 Current Database State
------------------------------
📈 Existing customer transfers: 1,247
💰 Total amount: $2,845,392.50
📊 Status breakdown:
   processed: 1,156
   pending: 67
   failed: 24

🔄 Fetching Customer Transfers from Dwolla
------------------------------------------
📦 Processing batch 1 (limit: 200, offset: 0)
   ✅ Synced: 198
   ❌ Failed: 2
```

### Final Statistics

After completion, you'll get comprehensive statistics:

```
🎉 Sync Complete!
==================================================

📊 SYNC SUMMARY
--------------------
✅ New transactions synced: 198
❌ Failed transactions: 2
⏱️  Processing time: 45 seconds

💰 FINANCIAL SUMMARY
--------------------
📈 Total customer transfers: 1,445
💵 Total amount: $3,127,834.75
👥 Unique customers: 89
📅 Date range: 2024-01-01 to 2024-12-31

📊 STATUS BREAKDOWN
--------------------
processed    : 1,298 (89.8%)
pending      : 89 (6.2%)
failed       : 42 (2.9%)
processing   : 16 (1.1%)

🏢 TOP COMPANIES
---------------
Acme Corporation          : 234
TechStart Inc            : 187
Global Solutions LLC     : 156
Prime Services          : 134
Digital Dynamics        : 98
```

## Integration with Billing Page

The sync scripts are already integrated with your billing page through the existing "Sync from Dwolla" button. However, you can also:

1. **Run manual syncs** using the command line scripts
2. **Set up automated syncs** using cron jobs or task schedulers
3. **Monitor sync health** using the status-check command
4. **Troubleshoot issues** using verbose and dry-run modes

### Automated Sync Setup

For production environments, consider setting up automated syncing:

```bash
# Add to your crontab for hourly quick syncs
0 * * * * cd /path/to/your/project && npm run billing:sync:quick

# Daily full sync at 2 AM
0 2 * * * cd /path/to/your/project && npm run billing:sync:full

# Weekly cleanup of failed transactions
0 3 * * 0 cd /path/to/your/project && npm run tsx scripts/run-billing-sync.ts failed --force-refresh
```

## Troubleshooting

### Common Issues and Solutions

#### 1. No Transactions Found
```bash
# Check your current status first
npm run billing:sync:status

# Verify date range
npm run tsx scripts/run-billing-sync.ts custom --start-date 2024-01-01 --dry-run --verbose
```

#### 2. Rate Limiting Issues
```bash
# Use smaller batch sizes
npm run tsx scripts/billing-page-sync.ts --batch-size 50 --verbose

# Add delays between batches (automatically handled)
```

#### 3. Failed Transactions
```bash
# Re-sync failed transactions with force refresh
npm run tsx scripts/run-billing-sync.ts failed --force-refresh --verbose

# Check specific error messages
npm run tsx scripts/billing-page-sync.ts --verbose
```

#### 4. Large Dataset Timeouts
```bash
# Use smaller date ranges
npm run tsx scripts/run-billing-sync.ts custom --start-date 2024-12-01 --end-date 2024-12-07

# Increase batch size for efficiency
npm run tsx scripts/billing-page-sync.ts --batch-size 500
```

### Debug Mode

For detailed debugging information:

```bash
# Enable verbose logging
npm run tsx scripts/run-billing-sync.ts quick --verbose

# Use dry-run to see what would happen
npm run tsx scripts/run-billing-sync.ts full --dry-run --verbose

# Check specific date ranges
npm run tsx scripts/run-billing-sync.ts custom --start-date 2024-12-01 --end-date 2024-12-01 --verbose
```

### Environment Issues

Make sure your environment is properly configured:

```bash
# Check environment variables
npm run check:env

# Test Dwolla connection
npm run tsx scripts/test-dwolla-connection.ts

# Verify database connection
npx prisma db pull
```

## Performance Tips

### For Large Datasets

1. **Use appropriate batch sizes**: Start with 200, adjust based on performance
2. **Filter by date ranges**: Avoid syncing all historical data at once
3. **Use status filters**: Focus on specific transaction statuses when needed
4. **Monitor progress**: Use verbose mode to track performance

### For Regular Maintenance

1. **Schedule quick syncs**: Use `quick` command for daily updates
2. **Weekly full syncs**: Use `full` command for comprehensive updates
3. **Monitor failed transactions**: Regularly check and retry failed syncs
4. **Status monitoring**: Use `status-check` to monitor database health

## Best Practices

### Development Environment
- Always use `--dry-run` when testing new configurations
- Use `--verbose` to understand what the script is doing
- Start with small date ranges when testing

### Production Environment
- Set up automated syncing for regular updates
- Monitor logs for errors and performance issues
- Use appropriate batch sizes for your server capacity
- Have a backup strategy for your transaction data

### Data Integrity
- Use `status-check` regularly to monitor data consistency
- Review failed transactions and investigate causes
- Use `force-refresh` sparingly and with understanding
- Keep track of sync frequency to avoid data gaps

## Support

If you encounter issues with the billing sync scripts:

1. **Check the logs**: Use `--verbose` for detailed output
2. **Verify configuration**: Ensure Dwolla credentials are correct
3. **Test connectivity**: Use the test scripts to verify API access
4. **Review documentation**: Check the Dwolla setup guide
5. **Contact support**: Refer to your system administrator or development team

## Related Documentation

- [Dwolla Setup Guide](./DWOLLA_SETUP.md)
- [API Documentation](../lib/api/dwolla/)
- [Database Schema](../prisma/schema.prisma)
- [Environment Configuration](../.env.example)
