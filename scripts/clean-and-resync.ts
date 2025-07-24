import { prisma } from "../lib/db"
import { DwollaClient } from "../lib/api/dwolla/client"
import { ACHTransactionSync } from "../lib/api/dwolla/ach-sync"
import dotenv from "dotenv"
import path from "path"

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

async function cleanAndResync() {
  try {
    console.log("\n=== Cleaning Database ===\n")

    // Delete ALL transactions to start fresh
    const deleteResult = await prisma.aCHTransaction.deleteMany({})
    console.log(`Deleted ${deleteResult.count} transactions\n`)

    // Delete only non-customer transfers
    const keepCustomers = await prisma.aCHTransaction.deleteMany({
      where: {
        customerEmail: null,
      },
    })
    console.log(`Keeping only customer transfers...\n`)

    // Now let's sync with proper filtering
    console.log("=== Starting Fresh Sync ===\n")

    const dwollaClient = new DwollaClient()
    const syncService = new ACHTransactionSync(dwollaClient)

    // We need to fetch enough to get 300 customer transfers
    // If 217 out of 500 were customers, we need about 700 to get 300 customers
    const results = await syncService.syncTransactions({ limit: 700 })

    console.log("\n=== Final Results ===")

    const customerCount = await prisma.aCHTransaction.count({
      where: {
        customerEmail: { not: null },
      },
    })

    const bankCount = await prisma.aCHTransaction.count({
      where: {
        customerEmail: null,
      },
    })

    console.log(`Customer-initiated transfers: ${customerCount}`)
    console.log(`Bank transfers that got through: ${bankCount}`)

    // Now delete the bank transfers that got through
    if (bankCount > 0) {
      console.log("\nCleaning up bank transfers...")
      const cleanupResult = await prisma.aCHTransaction.deleteMany({
        where: {
          customerEmail: null,
        },
      })
      console.log(`Removed ${cleanupResult.count} bank transfers`)
    }

    const finalCount = await prisma.aCHTransaction.count()
    console.log(`\nFinal database count: ${finalCount} customer-initiated transfers`)
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanAndResync()
