#!/usr/bin/env tsx

/**
 * Script to sync ALL historical ACH transactions from Dwolla
 * This will fetch all customer-initiated transfers and store them in the database
 */

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { DwollaClient } from "@/lib/api/dwolla/client"
import { ACHTransactionSync } from "@/lib/api/dwolla/ach-sync"
import { prisma } from "@/lib/db"
import { format } from "date-fns"

async function syncAllHistoricalTransactions() {
  console.log("🚀 Starting comprehensive ACH transaction sync...")
  console.log("This will fetch ALL historical customer-initiated transfers from Dwolla\n")

  try {
    // Initialize Dwolla client and sync service
    const dwollaClient = new DwollaClient()
    const syncService = new ACHTransactionSync(dwollaClient)

    // Get the oldest transaction in our database to determine where to start
    const oldestTransaction = await prisma.aCHTransaction.findFirst({
      orderBy: { created: "asc" },
      select: { created: true }
    })

    // Get the newest transaction to check for gaps
    const newestTransaction = await prisma.aCHTransaction.findFirst({
      orderBy: { created: "desc" },
      select: { created: true }
    })

    console.log("📊 Current database status:")
    const totalCount = await prisma.aCHTransaction.count()
    console.log(`   Total transactions: ${totalCount}`)
    if (oldestTransaction) {
      console.log(`   Oldest transaction: ${format(oldestTransaction.created, "yyyy-MM-dd HH:mm:ss")}`)
    }
    if (newestTransaction) {
      console.log(`   Newest transaction: ${format(newestTransaction.created, "yyyy-MM-dd HH:mm:ss")}`)
    }
    console.log("")

    // Strategy: Sync in batches to avoid overwhelming the API
    const BATCH_SIZE = 200 // Dwolla's max limit
    let totalSynced = 0
    let totalFailed = 0
    let hasMore = true
    let offset = 0

    // If we have existing transactions, we'll do two passes:
    // 1. Sync all new transactions (after our newest)
    // 2. Sync all historical transactions (before our oldest)

    // Pass 1: Sync new transactions
    if (newestTransaction) {
      console.log("📥 Pass 1: Syncing new transactions...")
      const newResults = await syncService.syncTransactions({
        startDate: newestTransaction.created,
        limit: 1000, // Fetch up to 1000 new transactions
      })
      totalSynced += newResults.synced
      totalFailed += newResults.failed
      console.log(`   ✅ Synced ${newResults.synced} new transactions`)
      if (newResults.errors.length > 0) {
        console.log(`   ⚠️  ${newResults.failed} failed:`, newResults.errors)
      }
      console.log("")
    }

    // Pass 2: Sync all historical transactions in batches
    console.log("📥 Pass 2: Syncing ALL historical transactions...")
    console.log("   This may take a while depending on the volume of transactions...\n")

    // Set a reasonable start date (e.g., 2 years ago or when Cakewalk started using Dwolla)
    const historicalStartDate = new Date("2022-01-01") // Adjust this based on when you started using Dwolla
    const endDate = oldestTransaction ? oldestTransaction.created : new Date()

    let currentBatch = 1
    while (hasMore) {
      console.log(`   📦 Batch ${currentBatch} (offset: ${offset})...`)
      
      try {
        const batchResults = await syncService.syncTransactions({
          startDate: historicalStartDate,
          endDate: endDate,
          limit: BATCH_SIZE,
          offset: offset,
        })

        totalSynced += batchResults.synced
        totalFailed += batchResults.failed

        console.log(`      ✅ Synced ${batchResults.synced} transactions`)
        if (batchResults.failed > 0) {
          console.log(`      ⚠️  Failed ${batchResults.failed} transactions`)
        }

        // Check if we got less than the batch size, indicating we're done
        if (batchResults.synced < BATCH_SIZE) {
          hasMore = false
          console.log(`      📌 Reached end of historical transactions`)
        } else {
          offset += BATCH_SIZE
          currentBatch++
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`      ❌ Batch ${currentBatch} failed:`, error)
        // Continue with next batch
        offset += BATCH_SIZE
        currentBatch++
      }
    }

    // Final summary
    console.log("\n✅ Sync completed!")
    console.log("📊 Final results:")
    console.log(`   Total synced: ${totalSynced}`)
    console.log(`   Total failed: ${totalFailed}`)
    
    const newTotalCount = await prisma.aCHTransaction.count()
    console.log(`   Total in database: ${newTotalCount}`)
    console.log(`   Net new transactions: ${newTotalCount - totalCount}`)

    // Verify data integrity
    console.log("\n🔍 Verifying data integrity...")
    const creditCount = await prisma.aCHTransaction.count({
      where: { direction: "credit" }
    })
    const debitCount = await prisma.aCHTransaction.count({
      where: { direction: "debit" }
    })
    console.log(`   Customer payments (credits): ${creditCount}`)
    console.log(`   Cakewalk payments (debits): ${debitCount}`)
    
    if (debitCount > 0) {
      console.log("   ⚠️  Warning: Found debit transactions. These should be filtered out!")
    }

  } catch (error) {
    console.error("❌ Fatal error during sync:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncAllHistoricalTransactions()
  .then(() => {
    console.log("\n✨ All done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })