import { prisma } from "../lib/db"

async function checkFailedTransactions() {
  try {
    console.log("🔍 Checking failed transactions in database...\n")

    // Get total transaction counts by status
    const statusCounts = await prisma.aCHTransaction.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { status: "desc" },
    })

    console.log("=== Transaction Status Summary ===")
    statusCounts.forEach((status) => {
      const count = typeof status._count === 'object' && status._count !== null ? status._count._all ?? 0 : 0
      const amount = status._sum?.amount ?? 0
      console.log(`${status.status}: ${count} transactions, $${amount} total`)
    })

    // Get failed transactions with details
    const failedTransactions = await prisma.aCHTransaction.findMany({
      where: {
        OR: [
          { status: "failed" },
          { status: "returned" },
          { status: "cancelled" }
        ]
      },
      orderBy: { created: "desc" },
      take: 20,
      select: {
        id: true,
        dwollaId: true,
        status: true,
        amount: true,
        customerName: true,
        customerEmail: true,
        companyName: true,
        failureReason: true,
        failureCode: true,
        returnCode: true,
        created: true,
        lastUpdated: true,
        direction: true,
        sourceName: true,
        destinationName: true,
      },
    })

    console.log(`\n=== Failed/Returned/Cancelled Transactions (${failedTransactions.length} found) ===`)
    
    if (failedTransactions.length === 0) {
      console.log("❌ No failed transactions found in database!")
      console.log("This could mean:")
      console.log("1. No real failed transactions exist in Dwolla")
      console.log("2. Failed transactions are being filtered out during sync")
      console.log("3. Failed transactions have different status names")
    } else {
      failedTransactions.forEach((tx, i) => {
        console.log(`\n--- Failed Transaction ${i + 1} ---`)
        console.log(`ID: ${tx.id}`)
        console.log(`Dwolla ID: ${tx.dwollaId}`)
        console.log(`Status: ${tx.status}`)
        console.log(`Amount: $${tx.amount}`)
        console.log(`Direction: ${tx.direction}`)
        console.log(`Customer: ${tx.customerName || "NULL"}`)
        console.log(`Email: ${tx.customerEmail || "NULL"}`)
        console.log(`Company: ${tx.companyName || "NULL"}`)
        console.log(`Source: ${tx.sourceName || "NULL"}`)
        console.log(`Destination: ${tx.destinationName || "NULL"}`)
        console.log(`Failure Reason: ${tx.failureReason || "NULL"}`)
        console.log(`Failure Code: ${tx.failureCode || "NULL"}`)
        console.log(`Return Code: ${tx.returnCode || "NULL"}`)
        console.log(`Created: ${tx.created}`)
        console.log(`Last Updated: ${tx.lastUpdated}`)
      })
    }

    // Check for any transactions with return codes
    const transactionsWithReturnCodes = await prisma.aCHTransaction.findMany({
      where: {
        returnCode: { not: null }
      },
      select: {
        status: true,
        returnCode: true,
        failureReason: true,
        amount: true,
        created: true,
      },
      orderBy: { created: "desc" },
      take: 10,
    })

    console.log(`\n=== Transactions with Return Codes (${transactionsWithReturnCodes.length} found) ===`)
    transactionsWithReturnCodes.forEach((tx, i) => {
      console.log(`${i + 1}. Status: ${tx.status}, Return Code: ${tx.returnCode}, Reason: ${tx.failureReason || "NULL"}, Amount: $${tx.amount}, Created: ${tx.created}`)
    })

    // Check for any transactions with failure reasons
    const transactionsWithFailureReasons = await prisma.aCHTransaction.findMany({
      where: {
        failureReason: { not: null }
      },
      select: {
        status: true,
        failureReason: true,
        failureCode: true,
        amount: true,
        created: true,
      },
      orderBy: { created: "desc" },
      take: 10,
    })

    console.log(`\n=== Transactions with Failure Reasons (${transactionsWithFailureReasons.length} found) ===`)
    transactionsWithFailureReasons.forEach((tx, i) => {
      console.log(`${i + 1}. Status: ${tx.status}, Failure Code: ${tx.failureCode || "NULL"}, Reason: ${tx.failureReason}, Amount: $${tx.amount}, Created: ${tx.created}`)
    })

  } catch (error) {
    console.error("Error checking failed transactions:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFailedTransactions()
