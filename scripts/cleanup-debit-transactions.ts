#!/usr/bin/env tsx

/**
 * Script to clean up debit transactions from the database
 * These are Cakewalk-initiated transfers that should not be shown in the billing page
 */

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { prisma } from "@/lib/db"

async function cleanupDebitTransactions() {
  console.log("🧹 Starting cleanup of debit transactions...")
  console.log("This will remove all Cakewalk-initiated transfers (debits) from the database\n")

  try {
    // First, let's see what we have
    const totalBefore = await prisma.aCHTransaction.count()
    const creditCount = await prisma.aCHTransaction.count({
      where: { direction: "credit" }
    })
    const debitCount = await prisma.aCHTransaction.count({
      where: { direction: "debit" }
    })

    console.log("📊 Current database status:")
    console.log(`   Total transactions: ${totalBefore}`)
    console.log(`   Customer payments (credits): ${creditCount}`)
    console.log(`   Cakewalk payments (debits): ${debitCount}`)
    
    if (debitCount === 0) {
      console.log("\n✅ No debit transactions found. Database is clean!")
      return
    }

    console.log(`\n🗑️  Removing ${debitCount} debit transactions...`)
    
    // Delete all debit transactions
    const deleteResult = await prisma.aCHTransaction.deleteMany({
      where: { direction: "debit" }
    })

    console.log(`✅ Deleted ${deleteResult.count} debit transactions`)

    // Verify the cleanup
    const totalAfter = await prisma.aCHTransaction.count()
    const creditCountAfter = await prisma.aCHTransaction.count({
      where: { direction: "credit" }
    })

    console.log("\n📊 Final database status:")
    console.log(`   Total transactions: ${totalAfter}`)
    console.log(`   Customer payments (credits): ${creditCountAfter}`)
    console.log(`   Removed: ${totalBefore - totalAfter} transactions`)

  } catch (error) {
    console.error("❌ Error during cleanup:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupDebitTransactions()
  .then(() => {
    console.log("\n✨ Cleanup complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })