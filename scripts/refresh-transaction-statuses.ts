#!/usr/bin/env tsx

/**
 * Refresh Transaction Statuses Script
 * 
 * This script checks all transactions with pending/processing status and updates them
 * by querying the latest status from Dwolla. This is useful for ensuring your local 
 * database reflects the current state of transactions in Dwolla.
 * 
 * Usage:
 *   - Refresh all pending/processing transactions:
 *     npx tsx scripts/refresh-transaction-statuses.ts
 * 
 *   - Refresh specific statuses with custom concurrency:
 *     npx tsx scripts/refresh-transaction-statuses.ts --statuses pending,processing --concurrency 3
 * 
 *   - Refresh only transactions older than 2 days:
 *     npx tsx scripts/refresh-transaction-statuses.ts --olderThanDays 2
 * 
 *   - Refresh specific transaction IDs:
 *     npx tsx scripts/refresh-transaction-statuses.ts --transactionIds dwolla_id1,dwolla_id2
 * 
 * Options:
 *   --statuses: Comma-separated list of statuses to refresh (default: pending,processing)
 *   --olderThanDays: Only refresh transactions older than X days (default: 0 = all)
 *   --transactionIds: Comma-separated list of specific Dwolla transaction IDs
 *   --concurrency: Number of concurrent API calls (default: 5, max: 10)
 *   --limit: Maximum number of transactions to process (default: 1000)
 *   --dryRun: Show what would be updated without making changes
 */

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { prisma } from "@/lib/db"
import { DwollaClient, DwollaAPIError } from "@/lib/api/dwolla/client"

interface RefreshOptions {
  statuses: string[]
  olderThanDays: number
  transactionIds: string[]
  concurrency: number
  limit: number
  dryRun: boolean
}

function parseArgs(argv: string[]): RefreshOptions {
  const args: Partial<RefreshOptions> = {}
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    const nextArg = argv[i + 1]
    
    if (arg.startsWith("--")) {
      const [key, value] = arg.includes("=") ? arg.split("=") : [arg, nextArg]
      const keyName = key.replace("--", "")
      
      switch (keyName) {
        case "statuses":
          args.statuses = value ? value.split(",").map(s => s.trim()) : ["pending", "processing"]
          if (!arg.includes("=")) i++ // Skip next arg if not using = syntax
          break
        case "olderThanDays":
          args.olderThanDays = value ? parseInt(value, 10) : 0
          if (!arg.includes("=")) i++
          break
        case "transactionIds":
          args.transactionIds = value ? value.split(",").map(s => s.trim()) : []
          if (!arg.includes("=")) i++
          break
        case "concurrency":
          args.concurrency = value ? Math.min(Math.max(parseInt(value, 10), 1), 10) : 5
          if (!arg.includes("=")) i++
          break
        case "limit":
          args.limit = value ? parseInt(value, 10) : 1000
          if (!arg.includes("=")) i++
          break
        case "dryRun":
          args.dryRun = true
          break
      }
    }
  }
  
  return {
    statuses: args.statuses || ["pending", "processing"],
    olderThanDays: args.olderThanDays || 0,
    transactionIds: args.transactionIds || [],
    concurrency: args.concurrency || 5,
    limit: args.limit || 1000,
    dryRun: args.dryRun || false,
  }
}

function normalizeStatus(dwollaStatus: string): string {
  // Map any Dwolla/legacy statuses to our canonical set
  if (dwollaStatus === "completed") return "processed"
  return dwollaStatus
}

function printUsage() {
  console.log(`
Refresh Transaction Statuses Script

Usage:
  npx tsx scripts/refresh-transaction-statuses.ts [options]

Options:
  --statuses <statuses>         Comma-separated statuses to refresh (default: pending,processing)
  --olderThanDays <days>        Only refresh transactions older than X days (default: 0 = all)
  --transactionIds <ids>        Comma-separated Dwolla transaction IDs to refresh
  --concurrency <number>        Number of concurrent API calls (default: 5, max: 10)
  --limit <number>              Maximum transactions to process (default: 1000)
  --dryRun                      Show what would be updated without making changes

Examples:
  npx tsx scripts/refresh-transaction-statuses.ts
  npx tsx scripts/refresh-transaction-statuses.ts --statuses pending,processing --concurrency 3
  npx tsx scripts/refresh-transaction-statuses.ts --olderThanDays 2
  npx tsx scripts/refresh-transaction-statuses.ts --dryRun
`)
}

async function main() {
  const options = parseArgs(process.argv)
  
  // Check if help was requested
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage()
    process.exit(0)
  }
  
  console.log("🔄 Starting transaction status refresh...")
  console.log("Options:", JSON.stringify(options, null, 2))
  
  // Check if we should use demo mode
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    !process.env.DWOLLA_KEY ||
    !process.env.DWOLLA_SECRET ||
    !process.env.DWOLLA_MASTER_ACCOUNT_ID

  if (isDemoMode) {
    console.log("🎭 Demo mode detected - simulating status refresh")
    
    // In demo mode, just show what would be updated
    const whereClause: any = {
      status: { in: options.statuses },
    }
    
    if (options.transactionIds.length > 0) {
      whereClause.dwollaId = { in: options.transactionIds }
    }
    
    if (options.olderThanDays > 0) {
      whereClause.created = {
        lt: new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000),
      }
    }
    
    const demoTransactions = await prisma.aCHTransaction.findMany({
      where: whereClause,
      select: { id: true, dwollaId: true, status: true, created: true },
      orderBy: { created: "desc" },
      take: Math.min(options.limit, 10), // Limit demo results
    })
    
    console.log(`📊 Found ${demoTransactions.length} transactions for demo refresh`)
    
    if (options.dryRun) {
      console.log("🔍 DRY RUN - Would refresh the following transactions:")
      demoTransactions.forEach(t => {
        console.log(`  - ${t.dwollaId} (${t.status}) created ${t.created.toISOString()}`)
      })
    } else {
      // Simulate some updates
      let updated = 0
      for (const transaction of demoTransactions) {
        if (Math.random() < 0.3) { // 30% chance to update
          const newStatus = ["processed", "failed", "returned"][Math.floor(Math.random() * 3)]
          await prisma.aCHTransaction.update({
            where: { id: transaction.id },
            data: {
              status: newStatus,
              lastUpdated: new Date(),
              ...(newStatus === "processed" ? { processedAt: new Date() } : {}),
            },
          })
          console.log(`✅ Updated ${transaction.dwollaId}: ${transaction.status} → ${newStatus}`)
          updated++
        }
      }
      console.log(`🎭 Demo refresh completed: ${updated} transactions updated`)
    }
    
    return
  }
  
  const client = new DwollaClient()
  
  // Build filter for transactions to refresh
  const whereClause: any = {
    status: { in: options.statuses },
  }
  
  if (options.transactionIds.length > 0) {
    whereClause.dwollaId = { in: options.transactionIds }
  }
  
  if (options.olderThanDays > 0) {
    whereClause.created = {
      lt: new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000),
    }
  }
  
  // Fetch transactions to refresh
  console.log("📊 Fetching transactions to refresh...")
  const toRefresh = await prisma.aCHTransaction.findMany({
    where: whereClause,
    select: { id: true, dwollaId: true, status: true, created: true },
    orderBy: { created: "desc" }, // Process newer transactions first
    take: options.limit,
  })
  
  console.log(`📋 Found ${toRefresh.length} transactions to check`)
  
  if (toRefresh.length === 0) {
    console.log("✨ No transactions found matching criteria")
    return
  }
  
  if (options.dryRun) {
    console.log("🔍 DRY RUN - Would refresh the following transactions:")
    toRefresh.slice(0, 10).forEach(t => { // Show first 10
      console.log(`  - ${t.dwollaId} (${t.status}) created ${t.created.toISOString()}`)
    })
    if (toRefresh.length > 10) {
      console.log(`  ... and ${toRefresh.length - 10} more`)
    }
    console.log("Run without --dryRun to actually update these transactions")
    return
  }
  
  let checked = 0
  let updated = 0
  const errors: string[] = []
  const updatedByStatus: Record<string, number> = {}
  
  // Process transactions with concurrency control
  const queue = [...toRefresh]
  
  async function worker(workerId: number): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) break
      
      try {
        console.log(`🔄 Worker ${workerId} checking ${item.dwollaId}`)
        
        // Fetch latest status from Dwolla
        const transfer = await client.getTransfer(item.dwollaId)
        const newStatus = normalizeStatus(transfer.status)
        
        // Only update if status actually changed
        if (newStatus !== item.status) {
          await prisma.aCHTransaction.update({
            where: { dwollaId: item.dwollaId },
            data: {
              status: newStatus,
              lastUpdated: new Date(),
              processedAt: newStatus === "processed" ? new Date(transfer.created) : null,
            },
          })
          updated++
          updatedByStatus[newStatus] = (updatedByStatus[newStatus] || 0) + 1
          
          console.log(`✅ Updated ${item.dwollaId}: ${item.status} → ${newStatus}`)
        } else {
          console.log(`⏸️  No change for ${item.dwollaId} (still ${item.status})`)
        }
      } catch (error) {
        if (error instanceof DwollaAPIError && error.status === 404) {
          console.warn(`⚠️  Dwolla transfer not found (dwollaId=${item.dwollaId}). Skipping.`)
        } else {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          errors.push(`Error refreshing ${item.dwollaId}: ${errorMessage}`)
          console.error(`❌ Error refreshing ${item.dwollaId}:`, errorMessage)
        }
      } finally {
        checked++
        if (checked % 50 === 0) {
          console.log(`📊 Progress: ${checked}/${toRefresh.length} checked, ${updated} updated`)
        }
      }
    }
  }
  
  // Run workers in parallel
  const startTime = Date.now()
  console.log(`🚀 Starting ${options.concurrency} workers...`)
  
  await Promise.all(Array.from({ length: options.concurrency }, (_, i) => worker(i + 1)))
  
  const duration = (Date.now() - startTime) / 1000
  
  console.log("\n✅ Transaction status refresh completed!")
  console.log(`📊 Results:`)
  console.log(`   Checked: ${checked}`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Errors: ${errors.length}`)
  console.log(`   Duration: ${duration.toFixed(1)}s`)
  
  if (Object.keys(updatedByStatus).length > 0) {
    console.log(`📈 Status updates:`)
    Object.entries(updatedByStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`)
    })
  }
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`)
    errors.slice(0, 5).forEach(error => console.log(`   ${error}`))
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`)
    }
  }
}

main()
  .catch((err) => {
    console.error("💥 Fatal error in refresh script:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
