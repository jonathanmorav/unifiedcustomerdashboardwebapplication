#!/usr/bin/env tsx

/**
 * Force sync ALL transfers from Dwolla without any date restrictions
 */

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { DwollaClient } from "@/lib/api/dwolla/client"
import { ACHTransactionSync } from "@/lib/api/dwolla/ach-sync"
import { prisma } from "@/lib/db"

async function forceSyncAllTransfers() {
  console.log("🚀 Force syncing ALL transfers from Dwolla...")
  console.log("This will fetch EVERY customer-initiated transfer without date restrictions\n")

  try {
    const client = new DwollaClient()
    const syncService = new ACHTransactionSync(client)
    const ourAccountId = process.env.DWOLLA_MASTER_ACCOUNT_ID

    // First, let's count what we should have
    console.log("📊 Counting all transfers in Dwolla...")
    let totalTransfers = 0
    let customerTransfers = 0
    let offset = 0
    const limit = 200

    while (true) {
      const response = await client.getTransfers({ limit, offset })
      const transfers = response._embedded?.transfers || []
      
      if (transfers.length === 0) break
      
      totalTransfers += transfers.length
      
      // Count customer-initiated transfers
      for (const transfer of transfers) {
        const sourceUrl = transfer._links.source.href
        const destUrl = transfer._links.destination.href
        
        if (destUrl.includes(ourAccountId) && sourceUrl.includes("/customers/")) {
          customerTransfers++
        }
      }
      
      console.log(`   Page ${Math.floor(offset / limit) + 1}: ${transfers.length} transfers`)
      
      if (!response._links?.next) break
      offset += limit
    }

    console.log(`\n📊 Found in Dwolla:`)
    console.log(`   Total transfers: ${totalTransfers}`)
    console.log(`   Customer → Cakewalk: ${customerTransfers}`)

    // Now sync with NO date restrictions
    console.log("\n📥 Syncing ALL customer transfers...")
    const results = await syncService.syncTransactions({
      // No date restrictions - fetch everything
      limit: undefined, // This will fetch ALL transfers
      offset: 0
    })

    console.log("\n✅ Sync results:")
    console.log(`   Synced: ${results.synced}`)
    console.log(`   Failed: ${results.failed}`)
    if (results.errors.length > 0) {
      console.log(`   Errors:`, results.errors)
    }

    // Verify final count
    const dbCount = await prisma.aCHTransaction.count()
    console.log("\n📊 Final verification:")
    console.log(`   Expected (from Dwolla): ${customerTransfers}`)
    console.log(`   Actual (in database): ${dbCount}`)
    console.log(`   ${dbCount === customerTransfers ? '✅ All transfers synced!' : `⚠️  Still missing ${customerTransfers - dbCount} transfers`}`)

  } catch (error) {
    console.error("❌ Force sync failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the force sync
forceSyncAllTransfers()
  .then(() => console.log("\n✨ Force sync complete!"))
  .catch(error => console.error("Fatal error:", error))