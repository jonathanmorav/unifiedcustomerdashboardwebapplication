import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function migrateCompletedToProcessed() {
  console.log("🔄 Starting migration: Completed → Processed status...")

  try {
    // First, check how many records need to be updated
    const completedCount = await prisma.aCHTransaction.count({
      where: {
        status: "completed",
      },
    })

    if (completedCount === 0) {
      console.log('✅ No records with "completed" status found. Migration not needed.')
      return
    }

    console.log(`📊 Found ${completedCount} records with "completed" status to migrate.`)

    // Confirm migration in production
    if (process.env.NODE_ENV === "production" && !process.argv.includes("--confirm")) {
      console.log(
        "⚠️  Production environment detected. Use --confirm flag to proceed with migration."
      )
      return
    }

    // Update records from 'completed' to 'processed'
    const updateResult = await prisma.aCHTransaction.updateMany({
      where: {
        status: "completed",
      },
      data: {
        status: "processed",
      },
    })

    console.log(
      `✅ Successfully migrated ${updateResult.count} records from "completed" to "processed" status.`
    )

    // Verify the migration
    const verifyCompleted = await prisma.aCHTransaction.count({
      where: {
        status: "completed",
      },
    })

    const verifyProcessed = await prisma.aCHTransaction.count({
      where: {
        status: "processed",
      },
    })

    console.log(`🔍 Verification:`)
    console.log(`  - Records with "completed" status: ${verifyCompleted}`)
    console.log(`  - Records with "processed" status: ${verifyProcessed}`)

    if (verifyCompleted === 0 && updateResult.count > 0) {
      console.log("🎉 Migration completed successfully!")
    } else if (verifyCompleted > 0) {
      console.log(
        '⚠️  Warning: Some records still have "completed" status. Please check for concurrent modifications.'
      )
    }

    // Show updated statistics
    const stats = await prisma.aCHTransaction.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    })

    console.log("\n📊 Updated Transaction Statistics:")
    stats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat._count._all} transactions`)
    })
  } catch (error) {
    console.error("❌ Error during migration:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateCompletedToProcessed().catch((error) => {
  console.error("Unexpected error:", error)
  process.exit(1)
})
