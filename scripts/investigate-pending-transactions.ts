import { prisma } from "../lib/db"

async function investigatePendingTransactions() {
  try {
    console.log("🔍 Investigating pending transactions...\n")

    // Get all pending transactions with details
    const pendingTransactions = await prisma.aCHTransaction.findMany({
      where: {
        status: "pending"
      },
      orderBy: { amount: "desc" },
      select: {
        id: true,
        dwollaId: true,
        status: true,
        amount: true,
        customerName: true,
        customerEmail: true,
        companyName: true,
        created: true,
        lastUpdated: true,
        direction: true,
        sourceName: true,
        destinationName: true,
      },
    })

    console.log(`=== Pending Transactions Analysis (${pendingTransactions.length} found) ===`)
    
    if (pendingTransactions.length === 0) {
      console.log("❌ No pending transactions found!")
      return
    }

    // Show individual pending transactions
    console.log("\n--- Individual Pending Transactions ---")
    pendingTransactions.forEach((tx, i) => {
      console.log(`\n${i + 1}. Amount: $${tx.amount}`)
      console.log(`   Customer: ${tx.customerName || "NULL"}`)
      console.log(`   Company: ${tx.companyName || "NULL"}`)
      console.log(`   Email: ${tx.customerEmail || "NULL"}`)
      console.log(`   Direction: ${tx.direction}`)
      console.log(`   Source: ${tx.sourceName || "NULL"}`)
      console.log(`   Destination: ${tx.destinationName || "NULL"}`)
      console.log(`   Created: ${tx.created}`)
      console.log(`   Dwolla ID: ${tx.dwollaId}`)
    })

    // Calculate statistics
    const totalPendingAmount = pendingTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0)
    const averagePendingAmount = totalPendingAmount / pendingTransactions.length
    const maxPendingAmount = Math.max(...pendingTransactions.map(tx => parseFloat(tx.amount.toString())))
    const minPendingAmount = Math.min(...pendingTransactions.map(tx => parseFloat(tx.amount.toString())))

    console.log("\n--- Pending Transactions Statistics ---")
    console.log(`Total Pending Amount: $${totalPendingAmount.toFixed(2)}`)
    console.log(`Number of Pending Transactions: ${pendingTransactions.length}`)
    console.log(`Average Pending Amount: $${averagePendingAmount.toFixed(2)}`)
    console.log(`Largest Pending Amount: $${maxPendingAmount.toFixed(2)}`)
    console.log(`Smallest Pending Amount: $${minPendingAmount.toFixed(2)}`)

    // Check for potential issues
    console.log("\n--- Potential Issues ---")
    
    // Check for unusually large amounts
    const largeAmounts = pendingTransactions.filter(tx => parseFloat(tx.amount.toString()) > 10000)
    if (largeAmounts.length > 0) {
      console.log(`⚠️  Found ${largeAmounts.length} pending transactions over $10,000:`)
      largeAmounts.forEach(tx => {
        console.log(`   - $${tx.amount} (${tx.customerName || "Unknown"})`)
      })
    }

    // Check for duplicate customer names (potential mock data)
    const customerNames = pendingTransactions.map(tx => tx.customerName).filter(Boolean)
    const uniqueNames = new Set(customerNames)
    if (customerNames.length > uniqueNames.size) {
      console.log(`⚠️  Found duplicate customer names (${customerNames.length - uniqueNames.size} duplicates)`)
    }

    // Check for generic email patterns (potential mock data)
    const genericEmails = pendingTransactions.filter(tx => 
      tx.customerEmail && (
        tx.customerEmail.includes('@example.com') ||
        tx.customerEmail.includes('@test.com') ||
        tx.customerEmail.includes('demo')
      )
    )
    if (genericEmails.length > 0) {
      console.log(`⚠️  Found ${genericEmails.length} transactions with generic emails (potential mock data)`)
    }

    // Check for unusual Dwolla IDs (potential mock data)
    const mockDwollaIds = pendingTransactions.filter(tx => 
      tx.dwollaId && (
        tx.dwollaId.includes('mock') ||
        tx.dwollaId.includes('test') ||
        tx.dwollaId.includes('demo') ||
        tx.dwollaId.length < 10
      )
    )
    if (mockDwollaIds.length > 0) {
      console.log(`⚠️  Found ${mockDwollaIds.length} transactions with suspicious Dwolla IDs (potential mock data)`)
    }

    // Compare with other status amounts
    const allStatusAmounts = await prisma.aCHTransaction.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: { _all: true },
    })

    console.log("\n--- Comparison with Other Statuses ---")
    allStatusAmounts.forEach(status => {
      const totalAmount = status._sum.amount ? parseFloat(status._sum.amount.toString()) : 0
      console.log(`${status.status}: $${totalAmount.toFixed(2)} (${status._count._all} transactions)`)
    })

  } catch (error) {
    console.error("Error investigating pending transactions:", error)
  } finally {
    await prisma.$disconnect()
  }
}

investigatePendingTransactions() 