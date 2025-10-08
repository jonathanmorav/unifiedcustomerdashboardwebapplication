/**
 * Script to fetch 5 real Dwolla transfer records and check their SOB coverage month data
 * This will help verify if SOB objects exist and have coverage_month populated
 */

// Using diagnostic HubSpot client instead of full client to avoid env validation

// Minimal HubSpot client for diagnostic purposes
class DiagnosticHubSpotClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = "https://api.hubapi.com"
  }

  private async fetchWithRetry<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // Get Dwolla transfers with minimal implementation
  async getDwollaTransfers(filters: { limit?: number, coverageMonth?: string } = {}) {
    const limit = filters.limit || 5

    // First try to see if the object exists by checking properties
    try {
      console.log("   → Checking if dwolla_transfers object exists...")
      const propertiesUrl = `${this.baseUrl}/crm/v3/properties/dwolla_transfers`
      await this.fetchWithRetry(propertiesUrl)
      console.log("   ✅ dwolla_transfers object exists")
    } catch (error) {
      console.log(`   ❌ dwolla_transfers object not found or no access: ${error}`)
      console.log("   → Trying alternative object names...")

      // Try alternative object names
      const alternatives = ["dwolla_transfer", "2-45680577", "transfers"]
      for (const alt of alternatives) {
        try {
          console.log(`   → Trying ${alt}...`)
          const propertiesUrl = `${this.baseUrl}/crm/v3/properties/${alt}`
          await this.fetchWithRetry(propertiesUrl)
          console.log(`   ✅ Found object: ${alt}`)
          // If we find it, update the URL and continue
          const url = `${this.baseUrl}/crm/v3/objects/${alt}?limit=${limit}&properties=dwolla_transfer_id,amount,transfer_status,coverage_month,date_initiated,dwolla_customer_id,fee_amount`
          const response = await this.fetchWithRetry<{ results: any[] }>(url)
          return response.results
        } catch (altError) {
          console.log(`   ❌ ${alt} also failed`)
        }
      }

      throw new Error("Could not find Dwolla transfers object with any known name")
    }

    // Try the object name first
    try {
      const url = `${this.baseUrl}/crm/v3/objects/dwolla_transfers?limit=${limit}&properties=dwolla_transfer_id,amount,transfer_status,coverage_month,date_initiated,dwolla_customer_id,fee_amount`
      const response = await this.fetchWithRetry<{ results: any[] }>(url)
      return response.results
    } catch (error) {
      console.log(`   → dwolla_transfers name failed, trying with object ID...`)
      // If that fails, use the object ID we found
      const url = `${this.baseUrl}/crm/v3/objects/2-45680577?limit=${limit}&properties=dwolla_transfer_id,amount,transfer_status,coverage_month,date_initiated,dwolla_customer_id,fee_amount`
      const response = await this.fetchWithRetry<{ results: any[] }>(url)
      return response.results
    }
  }

  // Get SOB associations for a transfer
  async getDwollaTransferSOBAssociations(transferId: string) {
    // Try the object name first (as used in existing code)
    try {
      const url = `${this.baseUrl}/crm/v3/objects/dwolla_transfers/${transferId}/associations/2-45680577`
      return await this.fetchWithRetry<{ results: Array<{ id: string; type: string }> }>(url)
    } catch (error) {
      console.log(`   → dwolla_transfers name failed, trying with object ID...`)
      // If that fails, try with the object ID we found
      const url = `${this.baseUrl}/crm/v3/objects/2-45680577/${transferId}/associations/2-45680577`
      return await this.fetchWithRetry<{ results: Array<{ id: string; type: string }> }>(url)
    }
  }

  // Batch read SOB objects
  async batchReadObjects(objectType: string, ids: string[], properties: string[]) {
    const url = `${this.baseUrl}/crm/v3/objects/${objectType}/batch/read`
    const response = await this.fetchWithRetry<{ results: Array<{ id: string; properties: any }> }>(url, {
      method: 'POST',
      body: JSON.stringify({
        inputs: ids.map(id => ({ id })),
        properties
      })
    })
    return response
  }
}

async function getRealSOBRecords() {
  console.log("🔍 Fetching 5 Real Dwolla Transfer Records with SOB Coverage Month Data")
  console.log("====================================================================")

  // Check if we have the minimal required environment
  const hubspotApiKey = process.env.HUBSPOT_API_KEY

  if (!hubspotApiKey) {
    console.log("❌ Missing HUBSPOT_API_KEY environment variable")
    console.log("\n🔧 SETUP INSTRUCTIONS:")
    console.log("1. Find your existing .env or .env.local file and check for HUBSPOT_API_KEY")
    console.log("2. Or set the environment variable:")
    console.log("   export HUBSPOT_API_KEY=your_existing_key_here")
    console.log("\n3. Then run this script again")
    console.log("\n💡 The API key should already be configured since the app is running!")
    return
  }

  console.log("✅ HubSpot API key found, proceeding...")

  try {
    // Use diagnostic client instead of full HubSpotClient
    const hubspotClient = new DiagnosticHubSpotClient(hubspotApiKey)

    // Step 1: Get 5 recent Dwolla transfers
    console.log("\n1. Fetching recent Dwolla transfers...")
    const transfers = await hubspotClient.getDwollaTransfers({
      limit: 5,
      // You can add filters here if needed
      // coverageMonth: "2024-01" // Uncomment to filter by specific month
    })

    console.log(`✅ Found ${transfers.length} transfers`)

    if (transfers.length === 0) {
      console.log("❌ No transfers found. Check HubSpot connection and data.")
      return
    }

    // Step 2: Analyze each transfer
    console.log("\n2. Analyzing transfers and SOB associations...")

    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i]
      const dwollaId = transfer.properties.dwolla_transfer_id
      const transferId = transfer.id

      console.log(`\n📋 RECORD ${i + 1}: ${dwollaId}`)
      console.log("─".repeat(60))

      // Transfer details
      console.log(`Transfer ID: ${transferId}`)
      console.log(`Dwolla ID: ${dwollaId}`)
      console.log(`Amount: $${transfer.properties.amount || 'N/A'}`)
      console.log(`Status: ${transfer.properties.transfer_status || 'N/A'}`)
      console.log(`Transfer Coverage Month: ${transfer.properties.coverage_month || 'NOT SET'}`)
      console.log(`Created: ${transfer.properties.date_initiated || transfer.properties.createdate || 'N/A'}`)

      try {
        // Step 3: Check for SOB associations
        console.log(`\n🔗 Checking SOB associations...`)
        const sobAssociations = await hubspotClient.getDwollaTransferSOBAssociations(transferId)

        console.log(`SOB Associations Found: ${sobAssociations.results.length}`)

        if (sobAssociations.results.length > 0) {
          console.log("✅ Transfer has SOB associations!")

          // Step 4: Get SOB details for each association
          for (let j = 0; j < sobAssociations.results.length; j++) {
            const sobAssociation = sobAssociations.results[j]
            const sobId = sobAssociation.id

            console.log(`\n  SOB ${j + 1}:`)
            console.log(`  SOB ID: ${sobId}`)

            try {
              // Fetch SOB object details
              const sobResponse = await hubspotClient.batchReadObjects(
                "summary_of_benefits",
                [sobId],
                [
                  "coverage_month",
                  "amount_to_draft",
                  "fee_amount",
                  "pdf_document_url",
                  "double_bill",
                  "hs_object_id",
                  "createdate"
                ]
              )

              if (sobResponse.results.length > 0) {
                const sob = sobResponse.results[0]

                console.log(`  ✅ SOB Details Retrieved:`)
                console.log(`    SOB Object ID: ${sob.properties.hs_object_id}`)
                console.log(`    SOB Coverage Month: ${sob.properties.coverage_month || 'NOT SET'}`)
                console.log(`    Amount to Draft: $${sob.properties.amount_to_draft || 'N/A'}`)
                console.log(`    Fee Amount: $${sob.properties.fee_amount || 'N/A'}`)
                console.log(`    Double Bill: ${sob.properties.double_bill || 'N/A'}`)
                console.log(`    PDF URL: ${sob.properties.pdf_document_url || 'N/A'}`)
                console.log(`    Created: ${sob.properties.createdate || 'N/A'}`)

                // Compare coverage months
                const transferMonth = transfer.properties.coverage_month
                const sobMonth = sob.properties.coverage_month

                if (sobMonth) {
                  if (transferMonth === sobMonth) {
                    console.log(`    📊 Coverage months match: ${sobMonth}`)
                  } else {
                    console.log(`    ⚠️  Coverage months differ:`)
                    console.log(`       Transfer: ${transferMonth || 'NOT SET'}`)
                    console.log(`       SOB: ${sobMonth}`)
                  }
                } else {
                  console.log(`    ⚠️  SOB has no coverage month set`)
                }

              } else {
                console.log(`  ❌ SOB batch read returned no results for ID: ${sobId}`)
              }

            } catch (sobError) {
              console.log(`  ❌ Error fetching SOB ${sobId}:`, sobError instanceof Error ? sobError.message : String(sobError))
            }
          }

        } else {
          console.log("❌ No SOB associations found for this transfer")
          console.log("   This means the transfer is not linked to any SOB objects")
        }

      } catch (associationError) {
        console.log(`❌ Error checking SOB associations:`, associationError instanceof Error ? associationError.message : String(associationError))
      }

      console.log("") // Empty line between records
    }

    // Step 5: Summary
    console.log("\n3. 📊 SUMMARY")
    console.log("============")

    let sobAssociationsCount = 0
    let coverageMonthFromSOBCount = 0
    let coverageMonthFromTransferCount = 0

    for (const transfer of transfers) {
      try {
        const associations = await hubspotClient.getDwollaTransferSOBAssociations(transfer.id)

        if (associations.results.length > 0) {
          sobAssociationsCount++

          // Check if any SOB has coverage month
          for (const association of associations.results) {
            const sobResponse = await hubspotClient.batchReadObjects(
              "summary_of_benefits",
              [association.id],
              ["coverage_month"]
            )

            if (sobResponse.results.length > 0 && sobResponse.results[0].properties.coverage_month) {
              coverageMonthFromSOBCount++
              break // Only count once per transfer
            }
          }
        }

        if (transfer.properties.coverage_month) {
          coverageMonthFromTransferCount++
        }

      } catch (error) {
        // Ignore errors in summary
      }
    }

    console.log(`Total transfers analyzed: ${transfers.length}`)
    console.log(`Transfers with SOB associations: ${sobAssociationsCount}`)
    console.log(`Transfers with coverage month from SOB: ${coverageMonthFromSOBCount}`)
    console.log(`Transfers with coverage month from transfer: ${coverageMonthFromTransferCount}`)

    console.log("\n4. 💡 INSIGHTS")
    console.log("==============")

    if (sobAssociationsCount === 0) {
      console.log("❌ ISSUE: No transfers have SOB associations")
      console.log("   → SOB objects need to be associated with Dwolla transfers")
      console.log("   → Check if the association workflow is working correctly")
    } else if (coverageMonthFromSOBCount === 0) {
      console.log("❌ ISSUE: SOB associations exist but no SOB objects have coverage_month")
      console.log("   → SOB objects need to have coverage_month property populated")
      console.log("   → Check if SOB creation/update process sets this field")
    } else {
      console.log("✅ SOB data structure looks good!")
      console.log("   → SOB associations exist and have coverage month data")
      console.log("   → The new implementation should work correctly")
    }

    console.log("\n5. 🧪 TEST RESULTS FOR EXPORT")
    console.log("============================")

    if (coverageMonthFromSOBCount > 0) {
      console.log("✅ Expected: Export should now pull coverage month from SOB objects")
      console.log(`   → ${coverageMonthFromSOBCount} transfers should get coverage month from SOB`)
      console.log(`   → ${coverageMonthFromTransferCount} transfers should fall back to transfer data`)
      console.log(`   → Remaining transfers should use calculated fallback`)
    } else {
      console.log("⚠️  Expected: Export will still show 'Unknown' for most transfers")
      console.log("   → No SOB objects have coverage_month populated")
      console.log("   → Need to either populate SOB coverage_month or fix associations")
    }

  } catch (error) {
    console.error("❌ Script failed:", error)

    if (error instanceof Error) {
      if (error.message.includes("Missing or invalid environment variables")) {
        console.error("\n🔧 SETUP REQUIRED:")
        console.error("   1. Create .env.local file with: HUBSPOT_API_KEY=your_key_here")
        console.error("   2. Or run: export HUBSPOT_API_KEY=your_key_here")
        console.error("   3. Then re-run this script")
      } else if (error.message.includes("401") || error.message.includes("unauthorized")) {
        console.error("\n🔧 AUTHENTICATION ISSUE:")
        console.error("   → Check that your HUBSPOT_API_KEY is valid and has correct permissions")
        console.error("   → Ensure the key has access to Dwolla Transfers and SOB objects")
      } else if (error.message.includes("403") || error.message.includes("forbidden")) {
        console.error("\n🔧 PERMISSIONS ISSUE:")
        console.error("   → Your API key may not have permission to read the required objects")
        console.error("   → Check HubSpot API key scopes and permissions")
      } else {
        console.error("\n🔧 OTHER ERROR:")
        console.error("   → Check your HubSpot API key and network connection")
        console.error(`   → Error details: ${error.message}`)
      }
    }
  }
}

// Run the script
getRealSOBRecords().catch(console.error)
