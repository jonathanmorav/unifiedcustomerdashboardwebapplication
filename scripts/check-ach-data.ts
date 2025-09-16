import { prisma } from "../lib/db"

async function checkACHData() {
  try {
    // Get sample of transactions
    const transactions = await prisma.aCHTransaction.findMany({
      orderBy: { created: "desc" },
      take: 10,
      select: {
        id: true,
        dwollaId: true,
        customerName: true,
        companyName: true,
        customerEmail: true,
        sourceName: true,
        destinationName: true,
        amount: true,
        status: true,
        created: true,
      },
    })

    console.log("\n=== Recent ACH Transactions ===")
    transactions.forEach((tx, i) => {
      console.log(`\n--- Transaction ${i + 1} ---`)
      console.log(`Dwolla ID: ${tx.dwollaId}`)
      console.log(`Customer Name: ${tx.customerName || "NULL"}`)
      console.log(`Company Name: ${tx.companyName || "NULL"}`)
      console.log(`Customer Email: ${tx.customerEmail || "NULL"}`)
      console.log(`Source: ${tx.sourceName || "NULL"}`)
      console.log(`Destination: ${tx.destinationName || "NULL"}`)
      console.log(`Amount: $${tx.amount}`)
      console.log(`Status: ${tx.status}`)
      console.log(`Created: ${tx.created}`)
    })

    // Check for patterns in customer names
    const customerNames = await prisma.aCHTransaction.groupBy({
      by: ["customerName"],
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
      where: {
        customerName: { not: null },
      },
    })

    console.log("\n=== Top Customer Names ===")
    customerNames.forEach((cn) => {
      console.log(`${cn.customerName}: ${cn._count._all} transactions`)
    })

    // Check company names
    const companyNames = await prisma.aCHTransaction.groupBy({
      by: ["companyName"],
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
      where: {
        companyName: { not: null },
      },
    })

    console.log("\n=== Top Company Names ===")
    companyNames.forEach((cn) => {
      console.log(`${cn.companyName}: ${cn._count._all} transactions`)
    })
  } catch (error) {
    console.error("Error checking ACH data:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkACHData()
