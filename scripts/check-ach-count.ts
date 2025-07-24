#!/usr/bin/env tsx

import { prisma } from "@/lib/db"

async function checkACHCount() {
  try {
    const totalCount = await prisma.aCHTransaction.count()
    const uniqueCustomers = await prisma.aCHTransaction.findMany({
      select: { customerEmail: true },
      distinct: ['customerEmail'],
    })
    
    const recentTransactions = await prisma.aCHTransaction.findMany({
      orderBy: { created: 'desc' },
      take: 5,
      select: {
        customerName: true,
        customerEmail: true,
        amount: true,
        status: true,
        created: true,
        direction: true,
      }
    })

    console.log(`\n📊 ACH Transaction Summary:`)
    console.log(`   Total transactions: ${totalCount}`)
    console.log(`   Unique customers: ${uniqueCustomers.length}`)
    console.log(`\n📅 Recent Transactions:`)
    
    recentTransactions.forEach(t => {
      console.log(`   - ${t.customerName} (${t.customerEmail}) - $${t.amount} - ${t.status} - ${t.direction} - ${t.created.toISOString()}`)
    })
    
  } catch (error) {
    console.error("Error checking ACH count:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkACHCount()