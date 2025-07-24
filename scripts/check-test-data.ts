#!/usr/bin/env tsx

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { prisma } from "@/lib/db"

async function checkTestData() {
  console.log("🔍 Checking for test data in ACH transactions...\n")

  try {
    // Get sample of recent transactions
    const recentTransactions = await prisma.aCHTransaction.findMany({
      select: {
        id: true,
        dwollaId: true,
        customerName: true,
        customerEmail: true,
        amount: true,
        created: true,
        companyName: true,
      },
      orderBy: { created: "desc" },
      take: 10,
    })

    console.log("📊 Recent transactions:")
    recentTransactions.forEach((t) => {
      console.log(
        `- ${t.customerName} (${t.customerEmail || "no email"}) - $${t.amount} - ID: ${
          t.dwollaId
        }`
      )
    })

    // Check for test data patterns
    const testPatterns = await prisma.aCHTransaction.findMany({
      where: {
        OR: [
          { customerEmail: { contains: "test", mode: "insensitive" } },
          { customerEmail: { contains: "example.com", mode: "insensitive" } },
          { customerName: { contains: "Test", mode: "insensitive" } },
          { customerName: { contains: "Demo", mode: "insensitive" } },
          { dwollaId: { startsWith: "test-" } },
          { dwollaId: { startsWith: "mock-" } },
          { dwollaId: { startsWith: "demo-" } },
          // Check for UUIDs that don't match Dwolla's format
          { dwollaId: { not: { contains: "-" } } },
        ],
      },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        dwollaId: true,
        amount: true,
        created: true,
      },
    })

    console.log(`\n🧪 Found ${testPatterns.length} potential test transactions:`)
    if (testPatterns.length > 0) {
      testPatterns.forEach((t) => {
        console.log(
          `   - ${t.customerName} (${t.customerEmail || "no email"}) - ID: ${t.dwollaId}`
        )
      })

      console.log("\n💡 To remove these test transactions, you can:")
      console.log("   1. Delete all data and re-sync from Dwolla:")
      console.log("      npm run ach:cleanup:all && npm run ach:sync:all")
      console.log("   2. Or manually delete specific test records")
    } else {
      console.log("   ✅ No obvious test data found!")
    }

    // Check for transactions with specific test emails
    const knownTestEmails = [
      "john.doe@example.com",
      "jane.smith@test.com",
      "test@test.com",
    ]

    const testEmailTransactions = await prisma.aCHTransaction.count({
      where: {
        customerEmail: { in: knownTestEmails },
      },
    })

    if (testEmailTransactions > 0) {
      console.log(`\n⚠️  Found ${testEmailTransactions} transactions with known test emails`)
    }

    // Summary
    const totalCount = await prisma.aCHTransaction.count()
    const realDwollaPattern = await prisma.aCHTransaction.count({
      where: {
        dwollaId: {
          contains: "-",
          notIn: testPatterns.map((t) => t.dwollaId),
        },
      },
    })

    console.log("\n📈 Summary:")
    console.log(`   Total transactions: ${totalCount}`)
    console.log(`   Likely real Dwolla transactions: ${realDwollaPattern}`)
    console.log(`   Potential test transactions: ${testPatterns.length}`)
  } catch (error) {
    console.error("❌ Error checking test data:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTestData()