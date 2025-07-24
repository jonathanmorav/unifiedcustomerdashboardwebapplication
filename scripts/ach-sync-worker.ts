#!/usr/bin/env tsx

/**
 * ACH Transaction Sync Worker
 * Continuously syncs new customer ACH transactions from Dwolla
 * Run this as a background process to keep transactions up-to-date
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

const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
const BATCH_SIZE = 200

async function syncNewTransactions() {
  try {
    // Get the most recent transaction to know where to start
    const latestTransaction = await prisma.aCHTransaction.findFirst({
      orderBy: { created: "desc" },
      select: { created: true, dwollaId: true }
    })

    const startDate = latestTransaction 
      ? new Date(latestTransaction.created.getTime() - 60000) // 1 minute overlap to catch any missed
      : new Date(Date.now() - 24 * 60 * 60 * 1000) // Default to last 24 hours

    console.log(`📥 Syncing new transactions since ${format(startDate, "yyyy-MM-dd HH:mm:ss")}`)

    const dwollaClient = new DwollaClient()
    const syncService = new ACHTransactionSync(dwollaClient)

    const results = await syncService.syncTransactions({
      startDate,
      limit: BATCH_SIZE
    })

    if (results.synced > 0) {
      console.log(`✅ Synced ${results.synced} new transactions`)
    } else {
      console.log("📊 No new transactions found")
    }

    if (results.failed > 0) {
      console.log(`⚠️  Failed to sync ${results.failed} transactions:`, results.errors)
    }

    return results
  } catch (error) {
    console.error("❌ Error during sync:", error)
    throw error
  }
}

async function startWorker() {
  console.log("🚀 Starting ACH Transaction Sync Worker")
  console.log(`📅 Sync interval: ${SYNC_INTERVAL / 1000} seconds`)
  console.log("")

  // Initial sync
  console.log("Running initial sync...")
  await syncNewTransactions()

  // Set up recurring sync
  const syncInterval = setInterval(async () => {
    console.log(`\n⏰ ${new Date().toISOString()} - Running scheduled sync...`)
    try {
      await syncNewTransactions()
    } catch (error) {
      console.error("Sync failed, will retry at next interval")
    }
  }, SYNC_INTERVAL)

  // Handle shutdown gracefully
  process.on("SIGTERM", async () => {
    console.log("\n🛑 Received SIGTERM, shutting down gracefully...")
    clearInterval(syncInterval)
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on("SIGINT", async () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...")
    clearInterval(syncInterval)
    await prisma.$disconnect()
    process.exit(0)
  })

  // Log worker status periodically
  setInterval(async () => {
    const totalCount = await prisma.aCHTransaction.count()
    const last24h = await prisma.aCHTransaction.count({
      where: {
        created: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    console.log(`📊 Status: Total transactions: ${totalCount}, Last 24h: ${last24h}`)
  }, 60000) // Every minute
}

// Start the worker
startWorker().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})