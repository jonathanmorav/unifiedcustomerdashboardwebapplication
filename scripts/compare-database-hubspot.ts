/**
 * Compare database Dwolla IDs with HubSpot SOB objects to find the disconnect
 */

import { prisma } from "@/lib/db"

async function compareDatabaseHubSpot() {
  console.log("🔍 Comparing Database vs HubSpot Data")
  console.log("====================================")

  const hubspotApiKey = process.env.HUBSPOT_API_KEY
  if (!hubspotApiKey) {
    console.log("❌ HUBSPOT_API_KEY not found. Run:")
    console.log("   export HUBSPOT_API_KEY=your_key_here")
    return
  }

  console.log("✅ HUBSPOT_API_KEY found")

  try {
    // Get recent database transactions
    console.log("\n1. Fetching recent database transactions...")
    const dbTransactions = await prisma.aCHTransaction.findMany({
      take: 10,
      orderBy: { created: 'desc' },
      select: {
        id: true,
        dwollaId: true,
        amount: true,
        status: true,
        created: true,
        metadata: true
      }
    })

    console.log(`   Found ${dbTransactions.length} database transactions`)

    // Get HubSpot SOB objects
    console.log("\n2. Fetching HubSpot SOB objects...")
    const baseUrl = "https://api.hubapi.com"
    const hubspotResponse = await fetch(`${baseUrl}/crm/v3/objects/2-45680577?limit=10&properties=dwolla_transfer_id,coverage_month,amount`, {
      headers: {
        'Authorization': `Bearer ${hubspotApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!hubspotResponse.ok) {
      throw new Error(`HubSpot API failed: ${hubspotResponse.status}`)
    }

    const hubspotData = await hubspotResponse.json()
    const hubspotSOBs = hubspotData.results || []

    console.log(`   Found ${hubspotSOBs.length} HubSpot SOB objects`)

    // Compare the data
    console.log("\n3. 📊 DATA COMPARISON")
    console.log("====================")

    console.log("\nDatabase Transactions:")
    console.log("─".repeat(50))
    dbTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. Dwolla ID: ${tx.dwollaId}`)
      console.log(`   Amount: $${tx.amount}`)
      console.log(`   Status: ${tx.status}`)
      console.log(`   Created: ${tx.created.toISOString().split('T')[0]}`)
      console.log(`   Metadata Coverage: ${(tx.metadata as any)?.coverageMonth || 'NOT SET'}`)
      console.log("")
    })

    console.log("\nHubSpot SOB Objects:")
    console.log("─".repeat(50))
    hubspotSOBs.forEach((sob: any, index: number) => {
      console.log(`${index + 1}. SOB ID: ${sob.id}`)
      console.log(`   Dwolla ID: ${sob.properties.dwolla_transfer_id || 'NOT SET'}`)
      console.log(`   Amount: $${sob.properties.amount || 'NOT SET'}`)
      console.log(`   Coverage Month: ${sob.properties.coverage_month || 'NOT SET'}`)
      console.log("")
    })

    // Find matches
    console.log("\n4. 🔗 MATCHING ANALYSIS")
    console.log("=======================")

    const dbDwollaIds = new Set(dbTransactions.map(tx => tx.dwollaId))
    const hubspotDwollaIds = new Set(hubspotSOBs.map((sob: any) => sob.properties.dwolla_transfer_id).filter(Boolean))

    console.log(`Database unique Dwolla IDs: ${dbDwollaIds.size}`)
    console.log(`HubSpot unique Dwolla IDs: ${hubspotDwollaIds.size}`)

    // Find overlaps
    const matches = Array.from(dbDwollaIds).filter(id => hubspotDwollaIds.has(id))
    const dbOnly = Array.from(dbDwollaIds).filter(id => !hubspotDwollaIds.has(id))
    const hubspotOnly = Array.from(hubspotDwollaIds).filter(id => !dbDwollaIds.has(id))

    console.log(`\nMatches (in both systems): ${matches.length}`)
    if (matches.length > 0) {
      matches.forEach(id => console.log(`  ✅ ${id}`))
    }

    console.log(`\nDatabase only: ${dbOnly.length}`)
    if (dbOnly.length > 0) {
      dbOnly.forEach(id => console.log(`  📊 ${id}`))
    }

    console.log(`\nHubSpot only: ${hubspotOnly.length}`)
    if (hubspotOnly.length > 0) {
      hubspotOnly.forEach(id => console.log(`  🏢 ${id}`))
    }

    // Summary
    console.log("\n5. 💡 ANALYSIS SUMMARY")
    console.log("=====================")

    if (matches.length === 0) {
      console.log("❌ CRITICAL ISSUE: No matching Dwolla IDs between database and HubSpot!")
      console.log("   → Database contains different transactions than HubSpot SOB objects")
      console.log("   → This explains why coverage month lookup fails")
      console.log("   → Need to either:")
      console.log("     1. Sync database transactions to HubSpot as SOB objects")
      console.log("     2. Use a different matching strategy")
      console.log("     3. Fix the data synchronization process")
    } else if (matches.length < Math.max(dbDwollaIds.size, hubspotDwollaIds.size)) {
      console.log("⚠️  PARTIAL SYNC: Some transactions exist in both systems")
      console.log(`   → ${matches.length} matches out of ${Math.max(dbDwollaIds.size, hubspotDwollaIds.size)} total`)
      console.log("   → Data synchronization may be incomplete")
    } else {
      console.log("✅ GOOD: All transactions have matching records")
      console.log("   → The issue may be in the lookup logic or data format")
    }

  } catch (error) {
    console.error("❌ Comparison failed:", error)
  }
}

// Run the comparison
compareDatabaseHubSpot().catch(console.error)


