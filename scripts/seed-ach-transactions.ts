import { PrismaClient } from "@prisma/client"
import { ACHTransactionSync } from "../lib/api/dwolla/ach-sync"
import { DwollaClient } from "../lib/api/dwolla/client"

const prisma = new PrismaClient()

async function seedACHTransactions() {
  console.log("🌱 Starting ACH transaction seeding...")

  try {
    // Check if we already have transactions
    const existingCount = await prisma.aCHTransaction.count()

    if (existingCount > 0) {
      console.log(`✅ Database already contains ${existingCount} ACH transactions.`)
      const continueSeeding = process.argv.includes("--force")

      if (!continueSeeding) {
        console.log("Use --force flag to add more transactions.")
        return
      }
    }

    // Create ACH sync service
    const dwollaClient = new DwollaClient({
      failOnMissingEndpoints: false,
    })
    const achSync = new ACHTransactionSync(dwollaClient)

    // Sync transactions (will generate mock data in demo mode)
    console.log("📥 Syncing ACH transactions...")

    const result = await achSync.syncTransactions({
      limit: 100, // Generate 100 transactions
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      endDate: new Date(),
    })

    console.log(`✅ Successfully synced ${result.synced} transactions`)

    if (result.failed > 0) {
      console.log(`⚠️  Failed to sync ${result.failed} transactions`)
      result.errors.forEach((error) => console.error(`  - ${error}`))
    }

    // Show some statistics
    const stats = await prisma.aCHTransaction.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    })

    console.log("\n📊 Transaction Statistics:")
    stats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat._count._all} transactions`)
    })

    const totalAmount = await prisma.aCHTransaction.aggregate({
      _sum: {
        amount: true,
      },
    })

    console.log(`\n💰 Total transaction volume: $${totalAmount._sum.amount?.toFixed(2) || "0.00"}`)
  } catch (error) {
    console.error("❌ Error seeding ACH transactions:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }

  console.log("\n🎉 ACH transaction seeding completed!")
}

// Run the seed function
seedACHTransactions().catch((error) => {
  console.error("Unexpected error:", error)
  process.exit(1)
})
