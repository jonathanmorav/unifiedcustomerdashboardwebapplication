/**
 * Test script to verify the export coverage month functionality
 * This tests the actual export logic with SOB coverage month retrieval
 */

import { HubSpotClient } from "@/lib/api/hubspot/client"
import { logger } from "@/lib/logger"

// Mock transaction data similar to what's in the database
const mockTransactions = [
  {
    id: "mock-1",
    dwollaId: "TR_1234567890", // Replace with real transfer IDs when testing
    status: "processed",
    amount: 150.00,
    direction: "credit",
    customerName: "Test Customer 1",
    created: new Date("2024-01-15"),
    metadata: {}
  },
  {
    id: "mock-2",
    dwollaId: "TR_0987654321", // Replace with real transfer IDs when testing
    status: "processed",
    amount: 200.00,
    direction: "credit",
    customerName: "Test Customer 2",
    created: new Date("2024-02-15"),
    metadata: {}
  }
]

async function testExportCoverageMonth() {
  console.log("🧪 Testing Export Coverage Month Functionality")
  console.log("==============================================")

  try {
    const hubspotClient = new HubSpotClient()

    // Test the export logic for each mock transaction
    console.log("\n1. Testing coverage month resolution for transactions...")

    for (const transaction of mockTransactions) {
      console.log(`\nTesting transaction: ${transaction.dwollaId}`)

      let coverageMonth = (transaction.metadata as any)?.coverageMonth
      let coverageSource = "metadata"

      // If not in metadata, try to get from SOB objects via HubSpot (same logic as export)
      if (!coverageMonth) {
        try {
          console.log("   → Looking up transfer in HubSpot...")

          // First, get the Dwolla transfer
          const hubspotTransfer = await hubspotClient.getDwollaTransferById(transaction.dwollaId)

          console.log(`   ✅ Found HubSpot transfer: ${hubspotTransfer.id}`)
          console.log(`   Transfer coverage month: ${hubspotTransfer.properties.coverage_month || 'Not set'}`)

          // Try to get coverage month from associated SOB objects
          const sobAssociations = await hubspotClient.getDwollaTransferSOBAssociations(hubspotTransfer.id)

          console.log(`   SOB associations found: ${sobAssociations.results.length}`)

          if (sobAssociations.results.length > 0) {
            // Get the SOB object to retrieve coverage month
            const sobId = sobAssociations.results[0].id
            console.log(`   → Fetching SOB: ${sobId}`)

            const sobResponse = await hubspotClient.batchReadObjects(
              "2-45680577", // SOB object type ID
              [sobId],
              ["coverage_month", "amount_to_draft", "hs_object_id"]
            )

            if (sobResponse.results.length > 0) {
              const sob = sobResponse.results[0]
              coverageMonth = sob.properties.coverage_month
              coverageSource = "sob"

              console.log(`   ✅ SOB coverage month: ${coverageMonth || 'Not set'}`)
              console.log(`   SOB amount to draft: $${sob.properties.amount_to_draft || 0}`)
              console.log(`   SOB object ID: ${sob.properties.hs_object_id}`)
            } else {
              console.log(`   ❌ SOB batch read returned no results`)
            }
          } else {
            console.log(`   ⚠️  No SOB associations found`)
          }

          // Fallback to transfer's coverage_month if SOB lookup failed
          if (!coverageMonth) {
            coverageMonth = hubspotTransfer.properties.coverage_month
            coverageSource = "transfer_fallback"
            console.log(`   → Using transfer fallback: ${coverageMonth || 'Not set'}`)
          }

        } catch (error) {
          // If HubSpot fails completely, leave as undefined
          coverageMonth = undefined
          coverageSource = "error"

          console.log(`   ❌ Error during lookup:`, error instanceof Error ? error.message : String(error))
        }
      }

      const finalCoverageMonth = coverageMonth || "Unknown"

      console.log(`\n   📋 RESULT:`)
      console.log(`   Source: ${coverageSource}`)
      console.log(`   Coverage Month: ${finalCoverageMonth}`)
      console.log(`   Would export as: "${finalCoverageMonth}"`)

      if (finalCoverageMonth === "Unknown") {
        console.log(`   ⚠️  This transaction will show "Unknown" in the export!`)
      } else {
        console.log(`   ✅ This transaction has valid coverage month data!`)
      }
    }

    console.log("\n2. 💡 SUMMARY")
    console.log("=============")

    const results = await Promise.all(mockTransactions.map(async (transaction) => {
      let coverageMonth = (transaction.metadata as any)?.coverageMonth

      if (!coverageMonth) {
        try {
          const hubspotTransfer = await hubspotClient.getDwollaTransferById(transaction.dwollaId)
          const sobAssociations = await hubspotClient.getDwollaTransferSOBAssociations(hubspotTransfer.id)

          if (sobAssociations.results.length > 0) {
            const sobId = sobAssociations.results[0].id
            const sobResponse = await hubspotClient.batchReadObjects(
              "2-45680577",
              [sobId],
              ["coverage_month"]
            )

            if (sobResponse.results.length > 0) {
              coverageMonth = sobResponse.results[0].properties.coverage_month
            }
          }

          if (!coverageMonth) {
            coverageMonth = hubspotTransfer.properties.coverage_month
          }
        } catch (error) {
          // Ignore errors for summary
        }
      }

      return {
        dwollaId: transaction.dwollaId,
        coverageMonth: coverageMonth || "Unknown"
      }
    }))

    const unknownCount = results.filter(r => r.coverageMonth === "Unknown").length
    const validCount = results.filter(r => r.coverageMonth !== "Unknown").length

    console.log(`Transactions tested: ${results.length}`)
    console.log(`With valid coverage month: ${validCount}`)
    console.log(`With "Unknown" coverage month: ${unknownCount}`)

    if (unknownCount > 0) {
      console.log(`\n⚠️  ISSUE IDENTIFIED: ${unknownCount} transactions will export with "Unknown" coverage month`)
      console.log("   This indicates either:")
      console.log("   - SOB associations don't exist")
      console.log("   - SOB objects don't have coverage_month populated")
      console.log("   - Transfer objects don't have coverage_month populated")
      console.log("   - There's an error in the lookup process")
    } else {
      console.log(`\n✅ SUCCESS: All tested transactions have valid coverage month data!`)
    }

  } catch (error) {
    console.error("❌ Test failed:", error)
    console.error("This is likely due to missing environment variables or invalid transfer IDs.")
    console.error("Make sure HUBSPOT_API_KEY is configured and transfer IDs are valid.")
  }
}

// Instructions for running the test
console.log("📝 INSTRUCTIONS:")
console.log("1. Replace the mock dwollaId values in mockTransactions with real transfer IDs")
console.log("2. Ensure HUBSPOT_API_KEY environment variable is set")
console.log("3. Run: npx tsx scripts/test-export-coverage-month.ts")
console.log("")

// Run the test
testExportCoverageMonth().catch(console.error)
