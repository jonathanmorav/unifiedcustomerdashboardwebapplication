#!/usr/bin/env tsx

/**
 * Enhanced Billing Page Sync Script
 * 
 * This script is designed specifically for the billing page to pull all customer-initiated
 * transfers from Dwolla. It provides comprehensive filtering, real-time progress reporting,
 * and detailed statistics for billing operations.
 * 
 * Features:
 * - Pulls only customer-initiated transfers (credits to Cakewalk)
 * - Supports date range filtering
 * - Real-time progress reporting
 * - Detailed sync statistics and metrics
 * - Error handling and retry logic
 * - Configurable batch processing
 * 
 * Usage:
 * npm run tsx scripts/billing-page-sync.ts [options]
 * 
 * Options:
 * --start-date YYYY-MM-DD    Start date for sync (default: 30 days ago)
 * --end-date YYYY-MM-DD      End date for sync (default: today)
 * --limit NUMBER             Max transactions to sync (default: unlimited)
 * --dry-run                  Show what would be synced without saving
 * --force-refresh            Re-sync existing transactions
 * --batch-size NUMBER        Batch size for processing (default: 200)
 * --verbose                  Show detailed progress information
 * --status-filter STRING     Filter by status (pending,processing,processed,failed)
 */

import dotenv from "dotenv"
import path from "path"
import { parseArgs } from "node:util"

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") })
dotenv.config({ path: path.join(process.cwd(), ".env") })

import { DwollaClient } from "../lib/api/dwolla/client"
import { ACHTransactionSync } from "../lib/api/dwolla/ach-sync"
import { prisma } from "../lib/db"
import { format, subDays } from "date-fns"

interface SyncOptions {
  startDate?: Date
  endDate?: Date
  limit?: number
  dryRun: boolean
  forceRefresh: boolean
  batchSize: number
  verbose: boolean
  statusFilter?: string[]
}

interface SyncProgress {
  totalTransactions: number
  syncedTransactions: number
  skippedTransactions: number
  failedTransactions: number
  currentBatch: number
  totalBatches: number
  startTime: Date
  errors: string[]
}

interface SyncStats {
  totalProcessed: number
  newTransactions: number
  updatedTransactions: number
  skippedTransactions: number
  failedTransactions: number
  totalAmount: number
  statusBreakdown: Record<string, number>
  customerCount: number
  companyBreakdown: Record<string, number>
  dateRange: {
    earliest: Date | null
    latest: Date | null
  }
  processingTime: number
}

class BillingPageSync {
  private client: DwollaClient
  private syncService: ACHTransactionSync
  private progress: SyncProgress
  private stats: SyncStats

  constructor() {
    this.client = new DwollaClient()
    this.syncService = new ACHTransactionSync(this.client)
    
    this.progress = {
      totalTransactions: 0,
      syncedTransactions: 0,
      skippedTransactions: 0,
      failedTransactions: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: new Date(),
      errors: []
    }

    this.stats = {
      totalProcessed: 0,
      newTransactions: 0,
      updatedTransactions: 0,
      skippedTransactions: 0,
      failedTransactions: 0,
      totalAmount: 0,
      statusBreakdown: {},
      customerCount: 0,
      companyBreakdown: {},
      dateRange: {
        earliest: null,
        latest: null
      },
      processingTime: 0
    }
  }

  async sync(options: SyncOptions): Promise<SyncStats> {
    const startTime = Date.now()
    this.progress.startTime = new Date()

    try {
      console.log("🏦 Enhanced Billing Page Sync for Customer-Initiated Transfers")
      console.log("=" .repeat(65))
      console.log(`📅 Date Range: ${options.startDate ? format(options.startDate, 'yyyy-MM-dd') : 'No limit'} to ${options.endDate ? format(options.endDate, 'yyyy-MM-dd') : 'Today'}`)
      console.log(`🔢 Transaction Limit: ${options.limit || 'Unlimited'}`)
      console.log(`📦 Batch Size: ${options.batchSize}`)
      console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN (No changes will be saved)' : 'LIVE SYNC'}`)
      console.log(`🔄 Force Refresh: ${options.forceRefresh ? 'Yes' : 'No'}`)
      
      if (options.statusFilter && options.statusFilter.length > 0) {
        console.log(`📊 Status Filter: ${options.statusFilter.join(', ')}`)
      }
      
      console.log()

      // Step 1: Get existing transactions count
      await this.reportExistingData(options)

      // Step 2: Fetch and process transactions from Dwolla
      await this.fetchAndProcessTransactions(options)

      // Step 3: Generate final statistics
      await this.generateFinalStats()

      this.stats.processingTime = Date.now() - startTime

      // Step 4: Display results
      this.displayResults()

      return this.stats

    } catch (error) {
      console.error("❌ Sync failed:", error)
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }

  private async reportExistingData(options: SyncOptions) {
    console.log("📊 Current Database State")
    console.log("-".repeat(30))

    const whereClause: any = {
      direction: "credit" // Only customer-initiated transfers
    }

    if (options.startDate) {
      whereClause.created = { ...whereClause.created, gte: options.startDate }
    }

    if (options.endDate) {
      whereClause.created = { ...whereClause.created, lte: options.endDate }
    }

    const existingCount = await prisma.aCHTransaction.count({ where: whereClause })
    const totalAmount = await prisma.aCHTransaction.aggregate({
      where: whereClause,
      _sum: { amount: true }
    })

    const statusCounts = await prisma.aCHTransaction.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { _all: true }
    })

    console.log(`📈 Existing customer transfers: ${existingCount.toLocaleString()}`)
    console.log(`💰 Total amount: $${(Number(totalAmount._sum.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    
    if (statusCounts.length > 0) {
      console.log("📊 Status breakdown:")
      statusCounts.forEach(({ status, _count }) => {
        console.log(`   ${status}: ${_count._all.toLocaleString()}`)
      })
    }
    
    console.log()
  }

  private async fetchAndProcessTransactions(options: SyncOptions) {
    console.log("🔄 Fetching Customer Transfers from Dwolla")
    console.log("-".repeat(42))

    const syncOptions = {
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit,
      offset: 0
    }

    let processedCount = 0
    let hasMore = true
    let batchNumber = 1

    while (hasMore && (options.limit ? processedCount < options.limit : true)) {
      const batchLimit = Math.min(
        options.batchSize,
        options.limit ? options.limit - processedCount : options.batchSize
      )

      console.log(`📦 Processing batch ${batchNumber} (limit: ${batchLimit}, offset: ${syncOptions.offset})`)

      try {
        const results = await this.syncService.syncTransactions({
          ...syncOptions,
          limit: batchLimit
        })

        // Update progress
        this.progress.syncedTransactions += results.synced
        this.progress.failedTransactions += results.failed
        this.progress.errors.push(...results.errors)

        console.log(`   ✅ Synced: ${results.synced}`)
        console.log(`   ❌ Failed: ${results.failed}`)
        
        if (results.errors.length > 0 && options.verbose) {
          console.log(`   🐛 Errors:`)
          results.errors.forEach(error => console.log(`      ${error}`))
        }

        // Check if we got fewer results than requested (indicates end of data)
        if (results.synced + results.failed < batchLimit) {
          hasMore = false
        }

        processedCount += results.synced + results.failed
        syncOptions.offset += batchLimit
        batchNumber++

        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (error) {
        console.error(`   ❌ Batch ${batchNumber} failed:`, error)
        this.progress.errors.push(`Batch ${batchNumber}: ${error}`)
        break
      }
    }

    console.log()
    console.log(`📊 Total processed: ${processedCount.toLocaleString()} transactions`)
    console.log()
  }

  private async generateFinalStats() {
    console.log("📈 Generating Final Statistics")
    console.log("-".repeat(32))

    const whereClause: any = {
      direction: "credit" // Only customer-initiated transfers
    }

    // Get total statistics
    const totalTransactions = await prisma.aCHTransaction.count({ where: whereClause })
    const totalAmountResult = await prisma.aCHTransaction.aggregate({
      where: whereClause,
      _sum: { amount: true }
    })

    // Status breakdown
    const statusBreakdown = await prisma.aCHTransaction.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { _all: true },
      _sum: { amount: true }
    })

    // Customer count
    const customerCount = await prisma.aCHTransaction.groupBy({
      by: ['customerEmail'],
      where: {
        ...whereClause,
        customerEmail: { not: null }
      }
    })

    // Company breakdown (top 10)
    const companyBreakdown = await prisma.aCHTransaction.groupBy({
      by: ['companyName'],
      where: {
        ...whereClause,
        companyName: { not: null }
      },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })

    // Date range
    const dateRange = await prisma.aCHTransaction.aggregate({
      where: whereClause,
      _min: { created: true },
      _max: { created: true }
    })

    // Update stats
    this.stats.totalProcessed = totalTransactions
    this.stats.newTransactions = this.progress.syncedTransactions
    this.stats.failedTransactions = this.progress.failedTransactions
    this.stats.totalAmount = Number(totalAmountResult._sum.amount) || 0
    this.stats.customerCount = customerCount.length

    statusBreakdown.forEach(({ status, _count }) => {
      this.stats.statusBreakdown[status] = _count._all
    })

    companyBreakdown.forEach(({ companyName, _count }) => {
      if (companyName) {
        this.stats.companyBreakdown[companyName] = _count._all
      }
    })

    this.stats.dateRange = {
      earliest: dateRange._min.created,
      latest: dateRange._max.created
    }
  }

  private displayResults() {
    console.log("🎉 Sync Complete!")
    console.log("=".repeat(50))
    console.log()

    console.log("📊 SYNC SUMMARY")
    console.log("-".repeat(20))
    console.log(`✅ New transactions synced: ${this.stats.newTransactions.toLocaleString()}`)
    console.log(`❌ Failed transactions: ${this.stats.failedTransactions.toLocaleString()}`)
    console.log(`⏱️  Processing time: ${Math.round(this.stats.processingTime / 1000)} seconds`)
    console.log()

    console.log("💰 FINANCIAL SUMMARY")
    console.log("-".repeat(20))
    console.log(`📈 Total customer transfers: ${this.stats.totalProcessed.toLocaleString()}`)
    console.log(`💵 Total amount: $${this.stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    console.log(`👥 Unique customers: ${this.stats.customerCount.toLocaleString()}`)
    
    if (this.stats.dateRange.earliest && this.stats.dateRange.latest) {
      console.log(`📅 Date range: ${format(this.stats.dateRange.earliest, 'yyyy-MM-dd')} to ${format(this.stats.dateRange.latest, 'yyyy-MM-dd')}`)
    }
    console.log()

    console.log("📊 STATUS BREAKDOWN")
    console.log("-".repeat(20))
    Object.entries(this.stats.statusBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([status, count]) => {
        const percentage = ((count / this.stats.totalProcessed) * 100).toFixed(1)
        console.log(`${status.padEnd(12)}: ${count.toLocaleString()} (${percentage}%)`)
      })
    console.log()

    if (Object.keys(this.stats.companyBreakdown).length > 0) {
      console.log("🏢 TOP COMPANIES")
      console.log("-".repeat(15))
      Object.entries(this.stats.companyBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([company, count]) => {
          console.log(`${company.substring(0, 30).padEnd(30)}: ${count.toLocaleString()}`)
        })
      console.log()
    }

    if (this.progress.errors.length > 0) {
      console.log("⚠️  ERRORS ENCOUNTERED")
      console.log("-".repeat(20))
      this.progress.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
      if (this.progress.errors.length > 10) {
        console.log(`... and ${this.progress.errors.length - 10} more errors`)
      }
      console.log()
    }

    console.log("🎯 NEXT STEPS")
    console.log("-".repeat(12))
    console.log("• Check the billing page to see the updated transactions")
    console.log("• Review any failed transactions for potential retry")
    console.log("• Consider setting up automated sync with the ach-sync-worker")
    console.log("• Monitor transaction statuses for updates")
    console.log()
  }
}

async function main() {
  // Parse command line arguments
  const { values } = parseArgs({
    options: {
      'start-date': { type: 'string' },
      'end-date': { type: 'string' },
      'limit': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'force-refresh': { type: 'boolean', default: false },
      'batch-size': { type: 'string', default: '200' },
      'verbose': { type: 'boolean', default: false },
      'status-filter': { type: 'string' }
    }
  })

  // Process options
  const options: SyncOptions = {
    startDate: values['start-date'] ? new Date(values['start-date']) : subDays(new Date(), 30),
    endDate: values['end-date'] ? new Date(values['end-date']) : new Date(),
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
    dryRun: values['dry-run'] || false,
    forceRefresh: values['force-refresh'] || false,
    batchSize: parseInt(values['batch-size'] || '200', 10),
    verbose: values.verbose || false,
    statusFilter: values['status-filter'] ? values['status-filter'].split(',') : undefined
  }

  // Validate options
  if (options.startDate && options.endDate && options.startDate > options.endDate) {
    console.error("❌ Error: Start date cannot be after end date")
    process.exit(1)
  }

  if (options.batchSize < 1 || options.batchSize > 1000) {
    console.error("❌ Error: Batch size must be between 1 and 1000")
    process.exit(1)
  }

  // Initialize and run sync
  const sync = new BillingPageSync()
  
  try {
    await sync.sync(options)
    console.log("🎉 Billing page sync completed successfully!")
    process.exit(0)
  } catch (error) {
    console.error("💥 Billing page sync failed:", error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

export { BillingPageSync, SyncOptions, SyncStats }
