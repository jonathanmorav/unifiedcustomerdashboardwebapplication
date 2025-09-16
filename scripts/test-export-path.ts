/**
 * Test which path the export is taking and why coverage month is Unknown
 */

import { TransferAdapter } from "@/lib/api/adapters/transfer-adapter"
import { HubSpotClient } from "@/lib/api/hubspot/client"
import { prisma } from "@/lib/db"

async function testExportPath() {
  console.log("🧪 Testing Export Path and Coverage Month Logic")
  console.log("==============================================")

  try {
    // Test 1: Check if TransferAdapter works
    console.log("\n1. Testing TransferAdapter...")
    try {
      const transferAdapter = new TransferAdapter()
      const result = await transferAdapter.getTransfersWithCompatibility({
        limit: 3,
        useHubSpot: true,
      })

      console.log(`✅ TransferAdapter SUCCESS: Found ${result.transfers.length} transfers`)
      
      if (result.transfers.length > 0) {
        const firstTransfer = result.transfers[0]
        console.log(`   Sample transfer:`)
        console.log(`   - ID: ${firstTransfer.dwollaId}`)
        console.log(`   - Coverage Month: ${firstTransfer.coverageMonth || 'NOT SET'}`)
        console.log(`   - Amount: $${firstTransfer.amount}`)
        console.log(`   - Status: ${firstTransfer.status}`)
      }

      console.log("\n   → Export would use TransferAdapter path")
      console.log("   → Coverage months should come from SOB lookup logic")

    } catch (transferError) {
      console.log("❌ TransferAdapter FAILED:", transferError instanceof Error ? transferError.message : String(transferError))
      console.log("\n   → Export will use database fallback path")

      // Test 2: Check database fallback path
      console.log("\n2. Testing Database Fallback Path...")
      
      const transactions = await prisma.aCHTransaction.findMany({
        take: 3,
        orderBy: { created: 'desc' }
      })

      console.log(`   Found ${transactions.length} database transactions`)

      if (transactions.length > 0) {
        console.log("\n   Testing SOB lookup for database transactions...")

        for (let i = 0; i < Math.min(2, transactions.length); i++) {
          const transaction = transactions[i]
          console.log(`\n   Transaction ${i + 1}: ${transaction.dwollaId}`)
          console.log(`   - Metadata coverage: ${(transaction.metadata as any)?.coverageMonth || 'NOT SET'}`)

          // Try HubSpot SOB lookup (same as export logic)
          try {
            const hubspotClient = new HubSpotClient()
            const hubspotTransfer = await hubspotClient.getDwollaTransferById(transaction.dwollaId)
            console.log(`   - Found HubSpot transfer: ${hubspotTransfer.id}`)
            console.log(`   - Transfer coverage month: ${hubspotTransfer.properties.coverage_month || 'NOT SET'}`)

            // Try SOB associations
            const sobAssociations = await hubspotClient.getDwollaTransferSOBAssociations(hubspotTransfer.id)
            console.log(`   - SOB associations: ${sobAssociations.results.length}`)

            if (sobAssociations.results.length > 0) {
              const sobId = sobAssociations.results[0].id
              const sobResponse = await hubspotClient.batchReadObjects(
                "summary_of_benefits",
                [sobId],
                ["coverage_month"]
              )

              if (sobResponse.results.length > 0) {
                const sobCoverageMonth = (sobResponse.results[0].properties as any)?.coverage_month
                console.log(`   - SOB coverage month: ${sobCoverageMonth || 'NOT SET'}`)
              } else {
                console.log(`   - SOB batch read failed`)
              }
            } else {
              console.log(`   - No SOB associations found`)
            }

          } catch (hubspotError) {
            console.log(`   ❌ HubSpot lookup failed:`, hubspotError instanceof Error ? hubspotError.message : String(hubspotError))
          }
        }
      }
    }

    // Test 3: Check what the export would actually return
    console.log("\n3. 🎯 SUMMARY")
    console.log("=============")

    console.log("Based on this test:")
    console.log("- If TransferAdapter works → coverage months from SOB lookup")
    console.log("- If TransferAdapter fails → database fallback with SOB lookup")
    console.log("- If SOB lookup fails → 'Unknown' coverage months")

    console.log("\nTo fix 'Unknown' coverage months, check:")
    console.log("1. Environment variables for HubSpot API access")
    console.log("2. SOB associations between transfers and SOB objects")
    console.log("3. Coverage month data quality in SOB objects")

  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

// Run the test
testExportPath().catch(console.error)


