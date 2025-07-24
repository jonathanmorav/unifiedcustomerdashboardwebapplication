#!/usr/bin/env tsx

/**
 * Script to clean up test transactions from the database
 * Removes all transactions with test email patterns and non-Dwolla IDs
 */

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { prisma } from "@/lib/db"

async function cleanupTestTransactions() {
  console.log("🧹 Starting cleanup of test transactions...")
  console.log("This will remove all test/demo transactions from the database\n")

  try {
    // First, let's see what we have
    const totalBefore = await prisma.aCHTransaction.count()
    
    // Count test transactions
    const testTransactionCount = await prisma.aCHTransaction.count({
      where: {
        OR: [
          // Email patterns that indicate test data
          { customerEmail: { contains: "example.com", mode: "insensitive" } },
          { customerEmail: { contains: "test.com", mode: "insensitive" } },
          { customerEmail: { contains: "demo.com", mode: "insensitive" } },
          { customerEmail: { contains: "test", mode: "insensitive" } },
          
          // Name patterns
          { customerName: { in: ["John Smith", "Jane Doe", "Test User", "Demo User"] } },
          
          // ID patterns - real Dwolla IDs are UUIDs
          { dwollaId: { startsWith: "test-" } },
          { dwollaId: { startsWith: "mock-" } },
          { dwollaId: { startsWith: "demo-" } },
          { dwollaId: { startsWith: "dwolla_" } }, // This is our mock format
          
          // Company patterns
          { companyName: { contains: "Test", mode: "insensitive" } },
          { companyName: { contains: "Demo", mode: "insensitive" } },
          { companyName: { contains: "Example", mode: "insensitive" } }
        ]
      }
    })

    console.log("📊 Current database status:")
    console.log(`   Total transactions: ${totalBefore}`)
    console.log(`   Test transactions to remove: ${testTransactionCount}`)
    console.log(`   Expected real transactions: ${totalBefore - testTransactionCount}`)
    
    if (testTransactionCount === 0) {
      console.log("\n✅ No test transactions found. Database is clean!")
      return
    }

    console.log(`\n🗑️  Removing ${testTransactionCount} test transactions...`)
    
    // Delete all test transactions
    const deleteResult = await prisma.aCHTransaction.deleteMany({
      where: {
        OR: [
          // Email patterns that indicate test data
          { customerEmail: { contains: "example.com", mode: "insensitive" } },
          { customerEmail: { contains: "test.com", mode: "insensitive" } },
          { customerEmail: { contains: "demo.com", mode: "insensitive" } },
          { customerEmail: { contains: "test", mode: "insensitive" } },
          
          // Name patterns
          { customerName: { in: ["John Smith", "Jane Doe", "Test User", "Demo User"] } },
          
          // ID patterns
          { dwollaId: { startsWith: "test-" } },
          { dwollaId: { startsWith: "mock-" } },
          { dwollaId: { startsWith: "demo-" } },
          { dwollaId: { startsWith: "dwolla_" } },
          
          // Company patterns
          { companyName: { contains: "Test", mode: "insensitive" } },
          { companyName: { contains: "Demo", mode: "insensitive" } },
          { companyName: { contains: "Example", mode: "insensitive" } }
        ]
      }
    })

    console.log(`✅ Deleted ${deleteResult.count} test transactions`)

    // Verify the cleanup
    const totalAfter = await prisma.aCHTransaction.count()
    
    console.log("\n📊 Final database status:")
    console.log(`   Total transactions: ${totalAfter}`)
    console.log(`   Removed: ${totalBefore - totalAfter} transactions`)
    
    // Show sample of remaining transactions
    if (totalAfter > 0) {
      const samples = await prisma.aCHTransaction.findMany({
        select: {
          customerName: true,
          customerEmail: true,
          dwollaId: true,
          amount: true
        },
        take: 5,
        orderBy: { created: 'desc' }
      })
      
      console.log("\n📋 Sample of remaining transactions:")
      samples.forEach(t => {
        console.log(`   - ${t.customerName} (${t.customerEmail}) - $${t.amount} - ${t.dwollaId}`)
      })
    }

  } catch (error) {
    console.error("❌ Error during cleanup:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupTestTransactions()
  .then(() => {
    console.log("\n✨ Cleanup complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })