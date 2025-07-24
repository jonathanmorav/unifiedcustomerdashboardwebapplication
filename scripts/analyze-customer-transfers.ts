import { prisma } from "../lib/db"

async function analyzeTransfers() {
  try {
    // Count customer-initiated transfers (where customerEmail is not null)
    const customerTransfers = await prisma.aCHTransaction.count({
      where: {
        customerEmail: { not: null },
      },
    })

    // Count bank transfers (where customerName is 'Wesbanco ')
    const bankTransfers = await prisma.aCHTransaction.count({
      where: {
        customerName: "Wesbanco ",
      },
    })

    // Get all unique customers
    const uniqueCustomers = await prisma.aCHTransaction.findMany({
      where: {
        customerEmail: { not: null },
      },
      select: {
        customerName: true,
        customerEmail: true,
        companyName: true,
      },
      distinct: ["customerEmail"],
    })

    console.log("\n=== Transfer Analysis ===")
    console.log(`Total transfers: ${await prisma.aCHTransaction.count()}`)
    console.log(`Customer-initiated transfers: ${customerTransfers}`)
    console.log(`Bank transfers (Wesbanco): ${bankTransfers}`)
    console.log(`\nUnique customers found: ${uniqueCustomers.length}`)

    uniqueCustomers.forEach((customer, i) => {
      console.log(`\n${i + 1}. ${customer.customerName}`)
      console.log(`   Email: ${customer.customerEmail}`)
      console.log(`   Company: ${customer.companyName || "N/A"}`)
    })

    // Show recent customer transfers
    const recentCustomerTransfers = await prisma.aCHTransaction.findMany({
      where: {
        customerEmail: { not: null },
      },
      orderBy: { created: "desc" },
      take: 5,
      select: {
        dwollaId: true,
        customerName: true,
        amount: true,
        status: true,
        created: true,
      },
    })

    console.log("\n=== Recent Customer-Initiated Transfers ===")
    recentCustomerTransfers.forEach((tx, i) => {
      console.log(`\n${i + 1}. ${tx.customerName} - $${tx.amount}`)
      console.log(`   Status: ${tx.status}`)
      console.log(`   Date: ${tx.created}`)
      console.log(`   ID: ...${tx.dwollaId.slice(-12)}`)
    })
  } catch (error) {
    console.error("Error analyzing transfers:", error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeTransfers()
