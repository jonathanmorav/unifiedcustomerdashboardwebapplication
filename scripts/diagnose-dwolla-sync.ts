#!/usr/bin/env tsx

/**
 * Diagnostic script to understand why we're not fetching all transfers from Dwolla
 */

import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { DwollaClient } from "@/lib/api/dwolla/client"
import { prisma } from "@/lib/db"

async function diagnoseDwollaSync() {
  console.log("🔍 Diagnosing Dwolla sync issues...\n")

  try {
    const client = new DwollaClient()
    const ourAccountId = process.env.DWOLLA_MASTER_ACCOUNT_ID

    console.log("📊 Configuration:")
    console.log(`   Master Account ID: ${ourAccountId}`)
    console.log(`   Environment: ${process.env.DWOLLA_ENVIRONMENT}`)
    console.log("")

    // Test 1: Basic API connectivity
    console.log("1️⃣ Testing API connectivity...")
    try {
      // Test with a simple API call
      const testResponse = await client.getTransfers({ limit: 1 })
      console.log("   ✅ API connection successful")
    } catch (error) {
      console.log("   ❌ API connection failed:", error)
      return
    }

    // Test 2: Count transfers with different parameters
    console.log("\n2️⃣ Counting transfers with different parameters...")
    
    // Get transfers without any date filter
    console.log("\n   a) All transfers (no date filter):")
    let allTransfers: any[] = []
    let offset = 0
    const limit = 200
    
    while (true) {
      const response = await client.getTransfers({ limit, offset })
      const transfers = response._embedded?.transfers || []
      
      if (transfers.length === 0) break
      
      allTransfers = allTransfers.concat(transfers)
      console.log(`      Page ${Math.floor(offset / limit) + 1}: ${transfers.length} transfers`)
      
      if (!response._links?.next) break
      offset += limit
    }
    
    console.log(`   Total transfers found: ${allTransfers.length}`)

    // Test 3: Analyze transfer types
    console.log("\n3️⃣ Analyzing transfer types...")
    let customerToUs = 0
    let usToCustomer = 0
    let bankToBankCount = 0
    let otherCount = 0

    for (const transfer of allTransfers) {
      const sourceUrl = transfer._links?.source?.href
      const destUrl = transfer._links?.destination?.href
      
      if (destUrl?.includes(ourAccountId)) {
        // Money coming TO us
        if (sourceUrl?.includes("/customers/")) {
          customerToUs++
        } else {
          bankToBankCount++
        }
      } else if (sourceUrl?.includes(ourAccountId)) {
        // Money going FROM us
        usToCustomer++
      } else {
        otherCount++
      }
    }

    console.log(`   Customer → Cakewalk: ${customerToUs} (these should be stored)`)
    console.log(`   Cakewalk → Customer: ${usToCustomer} (these should be filtered out)`)
    console.log(`   Bank → Bank: ${bankToBankCount}`)
    console.log(`   Other: ${otherCount}`)

    // Test 4: Check date ranges
    console.log("\n4️⃣ Checking date ranges...")
    const dates = allTransfers.map(t => new Date(t.created)).sort((a, b) => a.getTime() - b.getTime())
    if (dates.length > 0) {
      console.log(`   Oldest transfer: ${dates[0].toISOString()}`)
      console.log(`   Newest transfer: ${dates[dates.length - 1].toISOString()}`)
    }

    // Test 5: Sample customer transfers
    console.log("\n5️⃣ Sample customer-initiated transfers:")
    const customerTransfers = allTransfers.filter(t => {
      const destUrl = t._links?.destination?.href
      const sourceUrl = t._links?.source?.href
      return destUrl?.includes(ourAccountId) && sourceUrl?.includes("/customers/")
    })
    
    for (let i = 0; i < Math.min(5, customerTransfers.length); i++) {
      const t = customerTransfers[i]
      console.log(`   - ${t.id} - $${t.amount.value} - ${t.created}`)
    }

    // Test 6: Check what's in our database
    console.log("\n6️⃣ Database comparison:")
    const dbCount = await prisma.aCHTransaction.count()
    const dbIds = await prisma.aCHTransaction.findMany({
      select: { dwollaId: true },
      orderBy: { created: 'desc' },
      take: 10
    })
    
    console.log(`   Transactions in DB: ${dbCount}`)
    console.log(`   Expected (customer transfers): ${customerToUs}`)
    console.log(`   Missing: ${customerToUs - dbCount}`)
    
    // Check if recent transfers are missing
    const recentMissing = customerTransfers.filter(t => 
      !dbIds.some(db => db.dwollaId === t.id)
    ).slice(0, 5)
    
    if (recentMissing.length > 0) {
      console.log("\n   Sample missing transfers:")
      recentMissing.forEach(t => {
        console.log(`   - ${t.id} - $${t.amount.value} - ${t.created}`)
      })
    }

  } catch (error) {
    console.error("❌ Diagnostic error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run diagnostics
diagnoseDwollaSync()
  .then(() => console.log("\n✅ Diagnostics complete"))
  .catch(error => console.error("Fatal error:", error))