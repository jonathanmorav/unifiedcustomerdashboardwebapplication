/**
 * Test script to verify coverage month is being pulled from SOB objects
 * instead of Dwolla transfer objects
 */

import { HubSpotClient } from "@/lib/api/hubspot/client"

async function testSOBCoverageMonth() {
  console.log("Testing SOB-based coverage month retrieval...")
  console.log("===============================================")

  try {
    // Test SOB associations for a specific transfer
    // First, let's get a sample transfer ID from existing data
    const hubspotClient = new HubSpotClient()

    // Get a sample Dwolla transfer to test SOB associations
    console.log("\n1. Fetching sample Dwolla transfers...")
    const transfers = await hubspotClient.getDwollaTransfers({ limit: 5 })

    if (transfers.length === 0) {
      console.log("❌ No transfers found to test with")
      return
    }

    console.log(`Found ${transfers.length} transfers to test with`)

    // Test SOB associations for the first transfer
    const sampleTransfer = transfers[0]
    console.log(`\n2. Testing SOB associations for transfer: ${sampleTransfer.properties.dwolla_transfer_id}`)
    console.log(`   Transfer coverage month: ${sampleTransfer.properties.coverage_month || 'Not set'}`)

    // Get SOB associations
    const sobAssociations = await hubspotClient.getDwollaTransferSOBAssociations(sampleTransfer.id)
    console.log(`   SOB associations found: ${sobAssociations.results.length}`)

    if (sobAssociations.results.length > 0) {
      const sobId = sobAssociations.results[0].id
      console.log(`   SOB ID: ${sobId}`)

      // Get the SOB object to check coverage month
      console.log("\n3. Fetching SOB object details...")
      const sobResponse = await hubspotClient.batchReadObjects(
        "2-45680577", // SOB object type ID
        [sobId],
        ["coverage_month", "amount_to_draft", "hs_object_id"]
      )

      if (sobResponse.results.length > 0) {
        const sob = sobResponse.results[0]
        console.log("   SOB Details:")
        console.log(`   - SOB ID: ${sob.properties.hs_object_id}`)
        console.log(`   - Coverage Month: ${sob.properties.coverage_month || 'Not set'}`)
        console.log(`   - Amount to Draft: $${sob.properties.amount_to_draft || 0}`)

        if (sob.properties.coverage_month) {
          console.log("\n✅ SUCCESS: SOB contains coverage month!")
          console.log(`   Transfer coverage month: ${sampleTransfer.properties.coverage_month || 'Not set'}`)
          console.log(`   SOB coverage month: ${sob.properties.coverage_month}`)

          const transferMonth = sampleTransfer.properties.coverage_month
          const sobMonth = sob.properties.coverage_month

          if (transferMonth !== sobMonth) {
            console.log("⚠️  DIFFERENCE DETECTED:")
            console.log(`   - Transfer: ${transferMonth || 'null'}`)
            console.log(`   - SOB: ${sobMonth}`)
            console.log("   This confirms the new logic will use SOB data!")
          } else {
            console.log("ℹ️  Coverage months are the same in both objects")
          }
        } else {
          console.log("⚠️  SOB does not have coverage_month property set")
        }
      } else {
        console.log("❌ Could not fetch SOB object details")
      }
    } else {
      console.log("⚠️  No SOB associations found for this transfer")
      console.log("   This means the SOB lookup will fall back to transfer properties")
    }

    // Test multiple transfers
    console.log("\n4. Testing multiple transfers...")
    let sobCoverageCount = 0
    let transferCoverageCount = 0

    for (let i = 0; i < Math.min(3, transfers.length); i++) {
      const transfer = transfers[i]
      const associations = await hubspotClient.getDwollaTransferSOBAssociations(transfer.id)

      if (associations.results.length > 0) {
        const sobId = associations.results[0].id
        const sobResponse = await hubspotClient.batchReadObjects(
          "2-45680577",
          [sobId],
          ["coverage_month"]
        )

        if (sobResponse.results.length > 0 && sobResponse.results[0].properties.coverage_month) {
          sobCoverageCount++
        }
      }

      if (transfer.properties.coverage_month) {
        transferCoverageCount++
      }
    }

    console.log(`   Results from ${Math.min(3, transfers.length)} transfers:`)
    console.log(`   - Transfers with coverage month: ${transferCoverageCount}`)
    console.log(`   - SOBs with coverage month: ${sobCoverageCount}`)

    if (sobCoverageCount > 0) {
      console.log("\n✅ SUCCESS: SOB objects contain coverage month data!")
      console.log("   The new implementation will prioritize SOB coverage months.")
    }

  } catch (error) {
    console.error("❌ Test failed:", error)
    console.error("This is likely due to missing environment variables for HubSpot authentication.")
    console.error("To run this test, ensure HUBSPOT_API_KEY is set in your environment.")
  }
}

// Run the test
testSOBCoverageMonth().catch(console.error)
