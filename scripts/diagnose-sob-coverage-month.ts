/**
 * Diagnostic script to check SOB associations and coverage month data
 * This will help identify why coverage month is showing as "Unknown"
 */

import { HubSpotClient } from "@/lib/api/hubspot/client"
import { logger } from "@/lib/logger"

async function diagnoseSOBCoverageMonth() {
  console.log("🔍 Diagnosing SOB Coverage Month Issues")
  console.log("=======================================")

  try {
    const hubspotClient = new HubSpotClient()

    // Step 1: Get some recent transfers to test
    console.log("\n1. Fetching recent Dwolla transfers...")
    const transfers = await hubspotClient.getDwollaTransfers({ limit: 10 })

    console.log(`Found ${transfers.length} transfers to analyze`)

    if (transfers.length === 0) {
      console.log("❌ No transfers found. Check HubSpot connection and data.")
      return
    }

    // Step 2: Analyze each transfer
    const analysis = {
      totalTransfers: transfers.length,
      transfersWithSOBAssociations: 0,
      transfersWithSOBCoverageMonth: 0,
      transfersWithTransferCoverageMonth: 0,
      transfersWithAnyCoverageMonth: 0,
      sobAssociationsFound: [] as Array<{transferId: string, sobId: string, coverageMonth?: string}>,
      errors: [] as Array<{transferId: string, error: string}>
    }

    for (const transfer of transfers) {
      const transferId = transfer.id
      const dwollaId = transfer.properties.dwolla_transfer_id

      console.log(`\n2. Analyzing transfer: ${dwollaId}`)
      console.log(`   Transfer ID: ${transferId}`)
      console.log(`   Transfer coverage month: ${transfer.properties.coverage_month || 'Not set'}`)

      try {
        // Check SOB associations
        const sobAssociations = await hubspotClient.getDwollaTransferSOBAssociations(transferId)

        if (sobAssociations.results.length > 0) {
          analysis.transfersWithSOBAssociations++
          console.log(`   ✅ SOB associations found: ${sobAssociations.results.length}`)

          // Get SOB details
          for (const association of sobAssociations.results) {
            const sobId = association.id
            console.log(`   SOB ID: ${sobId}`)

            try {
              const sobResponse = await hubspotClient.batchReadObjects(
                "2-45680577", // SOB object type ID
                [sobId],
                ["coverage_month", "amount_to_draft", "hs_object_id"]
              )

              if (sobResponse.results.length > 0) {
                const sob = sobResponse.results[0]
                const sobCoverageMonth = sob.properties.coverage_month

                console.log(`   SOB coverage month: ${sobCoverageMonth || 'Not set'}`)
                console.log(`   SOB amount to draft: $${sob.properties.amount_to_draft || 0}`)
                console.log(`   SOB object ID: ${sob.properties.hs_object_id}`)

                analysis.sobAssociationsFound.push({
                  transferId,
                  sobId,
                  coverageMonth: sobCoverageMonth
                })

                if (sobCoverageMonth) {
                  analysis.transfersWithSOBCoverageMonth++
                }
              } else {
                console.log(`   ❌ SOB batch read returned no results for ID: ${sobId}`)
              }
            } catch (sobError) {
              console.log(`   ❌ Error reading SOB ${sobId}:`, sobError)
              analysis.errors.push({
                transferId,
                error: `SOB read error: ${sobError instanceof Error ? sobError.message : String(sobError)}`
              })
            }
          }
        } else {
          console.log(`   ❌ No SOB associations found`)
        }

        // Check if transfer has coverage month
        if (transfer.properties.coverage_month) {
          analysis.transfersWithTransferCoverageMonth++
        }

        // Check if we have ANY coverage month
        if (transfer.properties.coverage_month || analysis.sobAssociationsFound.some(s => s.transferId === transferId && s.coverageMonth)) {
          analysis.transfersWithAnyCoverageMonth++
        }

      } catch (error) {
        console.log(`   ❌ Error analyzing transfer:`, error)
        analysis.errors.push({
          transferId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // Step 3: Summary
    console.log("\n3. 📊 ANALYSIS SUMMARY")
    console.log("======================")
    console.log(`Total transfers analyzed: ${analysis.totalTransfers}`)
    console.log(`Transfers with SOB associations: ${analysis.transfersWithSOBAssociations}`)
    console.log(`Transfers with SOB coverage month: ${analysis.transfersWithSOBCoverageMonth}`)
    console.log(`Transfers with transfer coverage month: ${analysis.transfersWithTransferCoverageMonth}`)
    console.log(`Transfers with ANY coverage month: ${analysis.transfersWithAnyCoverageMonth}`)
    console.log(`Errors encountered: ${analysis.errors.length}`)

    // Step 4: Recommendations
    console.log("\n4. 💡 RECOMMENDATIONS")
    console.log("====================")

    if (analysis.transfersWithSOBAssociations === 0) {
      console.log("❌ ISSUE: No transfers have SOB associations")
      console.log("   → Check if SOB objects are properly associated with Dwolla transfers")
      console.log("   → Verify the association type ID (2-45680577) is correct")
    } else if (analysis.transfersWithSOBCoverageMonth === 0) {
      console.log("❌ ISSUE: SOB associations exist but no SOB objects have coverage_month")
      console.log("   → Check if SOB objects have the coverage_month property populated")
      console.log("   → Verify the property name is correct")
    } else {
      console.log("✅ SOB data looks good - the issue might be elsewhere")
    }

    if (analysis.errors.length > 0) {
      console.log(`\n❌ ERRORS FOUND (${analysis.errors.length}):`)
      analysis.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. Transfer ${err.transferId}: ${err.error}`)
      })
    }

    // Step 5: Export analysis for further investigation
    console.log("\n5. 📄 SOB ASSOCIATIONS FOUND")
    console.log("============================")
    if (analysis.sobAssociationsFound.length > 0) {
      analysis.sobAssociationsFound.forEach((sob, index) => {
        console.log(`${index + 1}. Transfer ${sob.transferId} → SOB ${sob.sobId} (Coverage: ${sob.coverageMonth || 'Not set'})`)
      })
    } else {
      console.log("No SOB associations found")
    }

  } catch (error) {
    console.error("❌ Diagnostic failed:", error)
    console.error("This is likely due to missing environment variables for HubSpot authentication.")
    console.error("Ensure HUBSPOT_API_KEY is properly configured.")
  }
}

// Run the diagnostic
diagnoseSOBCoverageMonth().catch(console.error)
