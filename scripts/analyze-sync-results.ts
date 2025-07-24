import { prisma } from "../lib/db"

async function analyzeSyncResults() {
  try {
    // Count by customerName
    const bankTransfers = await prisma.aCHTransaction.count({
      where: {
        OR: [
          { customerName: "Wesbanco " },
          { customerName: { contains: "Bank" } },
          { customerEmail: null },
        ],
      },
    })

    const customerTransfers = await prisma.aCHTransaction.count({
      where: {
        customerEmail: { not: null },
      },
    })

    console.log("\n=== Transfer Analysis ===")
    console.log(`Total transfers: ${await prisma.aCHTransaction.count()}`)
    console.log(`Customer transfers (with email): ${customerTransfers}`)
    console.log(`Bank/null transfers: ${bankTransfers}`)

    // Show sample of non-customer transfers
    const nonCustomerTransfers = await prisma.aCHTransaction.findMany({
      where: {
        customerEmail: null,
      },
      select: {
        customerName: true,
        sourceName: true,
        destinationName: true,
      },
      take: 10,
    })

    console.log("\n=== Sample Non-Customer Transfers ===")
    nonCustomerTransfers.forEach((tx, i) => {
      console.log(`${i + 1}. Customer: ${tx.customerName || "NULL"}`)
      console.log(`   Source: ${tx.sourceName}`)
      console.log(`   Destination: ${tx.destinationName}\n`)
    })
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeSyncResults()
