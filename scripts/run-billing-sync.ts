#!/usr/bin/env tsx

/**
 * Billing Page Sync Runner
 * 
 * A convenient utility to run the billing page sync with predefined configurations
 * and provide easy access to common sync operations.
 * 
 * This script provides several pre-configured sync operations:
 * - Quick sync (last 7 days)
 * - Full sync (last 90 days) 
 * - Today's transactions
 * - Custom date range
 * - Status-specific syncs
 * 
 * Usage:
 * npm run tsx scripts/run-billing-sync.ts [command] [options]
 * 
 * Commands:
 * quick          Sync last 7 days of transactions (default)
 * full           Sync last 90 days of transactions
 * today          Sync today's transactions only
 * week           Sync last week's transactions
 * month          Sync last month's transactions
 * custom         Sync with custom parameters
 * failed         Sync failed transactions only
 * pending        Sync pending/processing transactions only
 * status-check   Check sync status without performing sync
 * 
 * Examples:
 * npm run tsx scripts/run-billing-sync.ts
 * npm run tsx scripts/run-billing-sync.ts quick
 * npm run tsx scripts/run-billing-sync.ts full --verbose
 * npm run tsx scripts/run-billing-sync.ts today --dry-run
 * npm run tsx scripts/run-billing-sync.ts custom --start-date 2024-01-01 --end-date 2024-01-31
 */

import { parseArgs } from "node:util"
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { BillingPageSync, SyncOptions, SyncStats } from "./billing-page-sync"
import { prisma } from "../lib/db"

interface CommandConfig {
  name: string
  description: string
  options: Partial<SyncOptions>
}

const COMMANDS: Record<string, CommandConfig> = {
  quick: {
    name: "Quick Sync",
    description: "Sync last 7 days of customer transfers",
    options: {
      startDate: subDays(new Date(), 7),
      endDate: new Date(),
      batchSize: 100,
      verbose: false,
      dryRun: false
    }
  },
  full: {
    name: "Full Sync",
    description: "Sync last 90 days of customer transfers",
    options: {
      startDate: subDays(new Date(), 90),
      endDate: new Date(),
      batchSize: 200,
      verbose: true,
      dryRun: false
    }
  },
  today: {
    name: "Today's Sync",
    description: "Sync today's transactions only",
    options: {
      startDate: startOfDay(new Date()),
      endDate: endOfDay(new Date()),
      batchSize: 50,
      verbose: true,
      dryRun: false
    }
  },
  week: {
    name: "Weekly Sync",
    description: "Sync this week's transactions",
    options: {
      startDate: startOfWeek(new Date()),
      endDate: endOfWeek(new Date()),
      batchSize: 100,
      verbose: false,
      dryRun: false
    }
  },
  month: {
    name: "Monthly Sync",
    description: "Sync this month's transactions",
    options: {
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
      batchSize: 200,
      verbose: true,
      dryRun: false
    }
  },
  failed: {
    name: "Failed Transactions Sync",
    description: "Re-sync failed transactions only",
    options: {
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
      statusFilter: ['failed', 'cancelled', 'returned'],
      batchSize: 50,
      verbose: true,
      forceRefresh: true,
      dryRun: false
    }
  },
  pending: {
    name: "Pending Transactions Sync",
    description: "Sync pending and processing transactions",
    options: {
      startDate: subDays(new Date(), 14),
      endDate: new Date(),
      statusFilter: ['pending', 'processing'],
      batchSize: 100,
      verbose: true,
      forceRefresh: true,
      dryRun: false
    }
  },
  custom: {
    name: "Custom Sync",
    description: "Sync with custom parameters",
    options: {
      batchSize: 200,
      verbose: true,
      dryRun: false
    }
  }
}

async function showSyncStatus() {
  console.log("📊 Current Billing Page Sync Status")
  console.log("=" .repeat(40))
  console.log()

  try {
    // Get current database statistics
    const totalTransactions = await prisma.aCHTransaction.count({
      where: { direction: "credit" }
    })

    const last24h = await prisma.aCHTransaction.count({
      where: {
        direction: "credit",
        created: { gte: subDays(new Date(), 1) }
      }
    })

    const last7d = await prisma.aCHTransaction.count({
      where: {
        direction: "credit", 
        created: { gte: subDays(new Date(), 7) }
      }
    })

    const totalAmount = await prisma.aCHTransaction.aggregate({
      where: { direction: "credit" },
      _sum: { amount: true }
    })

    const statusCounts = await prisma.aCHTransaction.groupBy({
      by: ['status'],
      where: { direction: "credit" },
      _count: { _all: true }
    })

    const latestTransaction = await prisma.aCHTransaction.findFirst({
      where: { direction: "credit" },
      orderBy: { created: 'desc' },
      select: { created: true, dwollaId: true, customerName: true, amount: true }
    })

    console.log("📈 DATABASE STATISTICS")
    console.log("-".repeat(25))
    console.log(`Total customer transfers: ${totalTransactions.toLocaleString()}`)
    console.log(`Last 24 hours: ${last24h.toLocaleString()}`)
    console.log(`Last 7 days: ${last7d.toLocaleString()}`)
    console.log(`Total amount: $${(Number(totalAmount._sum.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    console.log()

    console.log("📊 STATUS BREAKDOWN")
    console.log("-".repeat(20))
    statusCounts
      .sort((a, b) => b._count._all - a._count._all)
      .forEach(({ status, _count }) => {
        const percentage = (((_count._all / totalTransactions) * 100) || 0).toFixed(1)
        console.log(`${status.padEnd(12)}: ${_count._all.toLocaleString()} (${percentage}%)`)
      })
    console.log()

    if (latestTransaction) {
      console.log("⏰ LATEST TRANSACTION")
      console.log("-".repeat(20))
      console.log(`Date: ${format(latestTransaction.created, 'yyyy-MM-dd HH:mm:ss')}`)
      console.log(`Customer: ${latestTransaction.customerName || 'N/A'}`)
      console.log(`Amount: $${latestTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
      console.log(`Dwolla ID: ${latestTransaction.dwollaId}`)
      console.log()
    }

    console.log("🚀 AVAILABLE SYNC COMMANDS")
    console.log("-".repeat(28))
    Object.entries(COMMANDS).forEach(([cmd, config]) => {
      console.log(`${cmd.padEnd(12)}: ${config.description}`)
    })
    console.log()

  } catch (error) {
    console.error("❌ Error getting sync status:", error)
  }
}

async function runCommand(command: string, overrideOptions: Partial<SyncOptions> = {}) {
  const config = COMMANDS[command]
  if (!config) {
    console.error(`❌ Unknown command: ${command}`)
    console.log(`Available commands: ${Object.keys(COMMANDS).join(', ')}`)
    process.exit(1)
  }

  console.log(`🚀 Running ${config.name}`)
  console.log(`📝 ${config.description}`)
  console.log()

  // Merge command options with overrides
  const options: SyncOptions = {
    ...config.options,
    ...overrideOptions,
    dryRun: overrideOptions.dryRun ?? config.options.dryRun ?? false,
    forceRefresh: overrideOptions.forceRefresh ?? config.options.forceRefresh ?? false,
    batchSize: overrideOptions.batchSize ?? config.options.batchSize ?? 200,
    verbose: overrideOptions.verbose ?? config.options.verbose ?? false
  }

  // Show what we're about to do
  if (options.startDate || options.endDate) {
    console.log(`📅 Date range: ${options.startDate ? format(options.startDate, 'yyyy-MM-dd') : 'No start'} to ${options.endDate ? format(options.endDate, 'yyyy-MM-dd') : 'No end'}`)
  }
  
  if (options.statusFilter) {
    console.log(`📊 Status filter: ${options.statusFilter.join(', ')}`)
  }
  
  if (options.limit) {
    console.log(`🔢 Transaction limit: ${options.limit.toLocaleString()}`)
  }
  
  console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE SYNC'}`)
  console.log()

  // Run the sync
  const sync = new BillingPageSync()
  const stats = await sync.sync(options)
  
  return stats
}

async function main() {
  // Parse command line arguments
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'start-date': { type: 'string' },
      'end-date': { type: 'string' },
      'limit': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'force-refresh': { type: 'boolean', default: false },
      'batch-size': { type: 'string' },
      'verbose': { type: 'boolean', default: false },
      'status-filter': { type: 'string' },
      'help': { type: 'boolean', default: false }
    },
    allowPositionals: true
  })

  // Show help
  if (values.help) {
    console.log("🏦 Billing Page Sync Runner")
    console.log("=" .repeat(30))
    console.log()
    console.log("USAGE:")
    console.log("  npm run tsx scripts/run-billing-sync.ts [command] [options]")
    console.log()
    console.log("COMMANDS:")
    Object.entries(COMMANDS).forEach(([cmd, config]) => {
      console.log(`  ${cmd.padEnd(12)} ${config.description}`)
    })
    console.log(`  status-check  Show current sync status without running sync`)
    console.log()
    console.log("OPTIONS:")
    console.log("  --start-date YYYY-MM-DD   Start date for sync")
    console.log("  --end-date YYYY-MM-DD     End date for sync")  
    console.log("  --limit NUMBER            Max transactions to sync")
    console.log("  --dry-run                 Show what would be synced without saving")
    console.log("  --force-refresh           Re-sync existing transactions")
    console.log("  --batch-size NUMBER       Batch size for processing")
    console.log("  --verbose                 Show detailed progress information")
    console.log("  --status-filter STRING    Filter by status (comma-separated)")
    console.log("  --help                    Show this help message")
    console.log()
    console.log("EXAMPLES:")
    console.log("  npm run tsx scripts/run-billing-sync.ts")
    console.log("  npm run tsx scripts/run-billing-sync.ts quick --verbose")
    console.log("  npm run tsx scripts/run-billing-sync.ts full --dry-run")
    console.log("  npm run tsx scripts/run-billing-sync.ts custom --start-date 2024-01-01")
    console.log("  npm run tsx scripts/run-billing-sync.ts status-check")
    console.log()
    return
  }

  const command = positionals[0] || 'quick'

  // Handle status check
  if (command === 'status-check') {
    await showSyncStatus()
    return
  }

  // Parse override options
  const overrideOptions: Partial<SyncOptions> = {}
  
  if (values['start-date']) {
    overrideOptions.startDate = new Date(values['start-date'])
  }
  
  if (values['end-date']) {
    overrideOptions.endDate = new Date(values['end-date'])
  }
  
  if (values.limit) {
    overrideOptions.limit = parseInt(values.limit, 10)
  }
  
  if (values['dry-run']) {
    overrideOptions.dryRun = true
  }
  
  if (values['force-refresh']) {
    overrideOptions.forceRefresh = true
  }
  
  if (values['batch-size']) {
    overrideOptions.batchSize = parseInt(values['batch-size'], 10)
  }
  
  if (values.verbose) {
    overrideOptions.verbose = true
  }
  
  if (values['status-filter']) {
    overrideOptions.statusFilter = values['status-filter'].split(',').map(s => s.trim())
  }

  // Validate dates
  if (overrideOptions.startDate && overrideOptions.endDate && overrideOptions.startDate > overrideOptions.endDate) {
    console.error("❌ Error: Start date cannot be after end date")
    process.exit(1)
  }

  try {
    const stats = await runCommand(command, overrideOptions)
    
    console.log()
    console.log("🎯 QUICK STATS")
    console.log("-".repeat(15))
    console.log(`✅ New transactions: ${stats.newTransactions}`)
    console.log(`💰 Total amount: $${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    console.log(`⏱️  Processing time: ${Math.round(stats.processingTime / 1000)}s`)
    
    if (stats.failedTransactions > 0) {
      console.log(`❌ Failed transactions: ${stats.failedTransactions}`)
    }
    
    console.log()
    console.log("🎉 Sync completed successfully!")
    process.exit(0)
    
  } catch (error) {
    console.error("💥 Sync failed:", error)
    process.exit(1)
  }
}

// Export for programmatic use
export { runCommand, showSyncStatus, COMMANDS }

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
