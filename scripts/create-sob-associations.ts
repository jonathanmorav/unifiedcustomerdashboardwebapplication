/**
 * Script to create SOB associations for Dwolla transfers
 * Based on analysis, SOB objects have the same IDs as Dwolla transfers
 * We need to create self-associations
 */

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

  // Get Dwolla transfers (which are actually SOB objects)
  async getDwollaTransfers(limit: number = 50) {
    // Use the SOB object type since transfers are stored there
    const url = `${this.baseUrl}/crm/v3/objects/2-45680577?limit=${limit}&properties=dwolla_transfer_id,amount,transfer_status,coverage_month,date_initiated,dwolla_customer_id,fee_amount`
    const response = await this.fetchWithRetry<{ results: any[] }>(url)
    return response.results
  }

  // Create association between Dwolla transfer and SOB (self-association)
  async createSOBAssociation(transferId: string) {
    const url = `${this.baseUrl}/crm/v3/objects/2-45680577/${transferId}/associations/2-45680577`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [{
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 1 // Default association type
        }]
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // Check if SOB association already exists
  async checkSOBAssociation(transferId: string) {
    const url = `${this.baseUrl}/crm/v3/objects/2-45680577/${transferId}/associations/2-45680577`
    const response = await this.fetchWithRetry<{ results: any[] }>(url)
    return response.results.length > 0
  }
}

async function createSOBAassociations() {
  console.log("🔗 Creating SOB Associations for Dwolla Transfers")
  console.log("=================================================")

  const hubspotApiKey = process.env.HUBSPOT_API_KEY
  if (!hubspotApiKey) {
    console.log("❌ HUBSPOT_API_KEY not found. Run:")
    console.log("   export HUBSPOT_API_KEY=your_key_here")
    return
  }

  console.log("✅ HubSpot API key found, proceeding...")

  try {
    const hubspotClient = new DiagnosticHubSpotClient(hubspotApiKey)

    // Step 1: Get all Dwolla transfers (which are SOB objects)
    console.log("\n1. Fetching Dwolla transfers...")
    const transfers = await hubspotClient.getDwollaTransfers(100) // Get more records

    console.log(`✅ Found ${transfers.length} transfers to process`)

    if (transfers.length === 0) {
      console.log("❌ No transfers found to associate.")
      return
    }

    // Step 2: Check existing associations and create missing ones
    console.log("\n2. Checking and creating SOB associations...")

    const associationResults = {
      total: transfers.length,
      alreadyAssociated: 0,
      newlyAssociated: 0,
      failed: 0,
      skipped: [] as Array<{ id: string, reason: string }>,
      errors: [] as Array<{ id: string, error: string }>
    }

    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i]
      const transferId = transfer.id
      const dwollaId = transfer.properties.dwolla_transfer_id
      const coverageMonth = transfer.properties.coverage_month

      console.log(`\nProcessing ${i + 1}/${transfers.length}: ${dwollaId || 'No Dwolla ID'} (ID: ${transferId})`)

      try {
        // Check if association already exists
        const alreadyAssociated = await hubspotClient.checkSOBAssociation(transferId)

        if (alreadyAssociated) {
          console.log(`  ✅ Already associated`)
          associationResults.alreadyAssociated++
        } else {
          // Check if this is a valid transfer with data
          if (!dwollaId && !coverageMonth) {
            console.log(`  ⏭️  Skipping - no Dwolla ID or coverage month`)
            associationResults.skipped.push({
              id: transferId,
              reason: 'No Dwolla ID or coverage month'
            })
            continue
          }

          // Create the association
          console.log(`  🔗 Creating SOB association...`)
          await hubspotClient.createSOBAssociation(transferId)
          console.log(`  ✅ Association created successfully`)
          associationResults.newlyAssociated++
        }

      } catch (error) {
        console.log(`  ❌ Failed to create association:`, error instanceof Error ? error.message : String(error))
        associationResults.failed++
        associationResults.errors.push({
          id: transferId,
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // Add a small delay to avoid rate limiting
      if (i < transfers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Step 3: Display results
    console.log("\n3. 📊 ASSOCIATION RESULTS")
    console.log("========================")
    console.log(`Total transfers processed: ${associationResults.total}`)
    console.log(`Already associated: ${associationResults.alreadyAssociated}`)
    console.log(`Newly associated: ${associationResults.newlyAssociated}`)
    console.log(`Failed: ${associationResults.failed}`)
    console.log(`Skipped: ${associationResults.skipped.length}`)

    const successRate = Math.round(((associationResults.alreadyAssociated + associationResults.newlyAssociated) / associationResults.total) * 100)
    console.log(`\nSuccess rate: ${successRate}%`)

    // Step 4: Display details
    if (associationResults.errors.length > 0) {
      console.log("\n4. ❌ ERRORS ENCOUNTERED")
      console.log("=======================")
      associationResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. Transfer ${error.id}: ${error.error}`)
      })
    }

    if (associationResults.skipped.length > 0) {
      console.log("\n5. ⏭️  RECORDS SKIPPED")
      console.log("====================")
      associationResults.skipped.forEach((skipped, index) => {
        console.log(`${index + 1}. Transfer ${skipped.id}: ${skipped.reason}`)
      })
    }

    // Step 5: Next steps
    console.log("\n6. 🎯 NEXT STEPS")
    console.log("===============")

    if (associationResults.newlyAssociated > 0) {
      console.log("✅ Associations created successfully!")
      console.log("   → Test the export to see if coverage months now come from SOB objects")
      console.log("   → Run the diagnostic script again to verify associations")
    } else if (associationResults.alreadyAssociated === associationResults.total) {
      console.log("ℹ️  All transfers were already associated")
      console.log("   → The issue might be elsewhere in the export logic")
      console.log("   → Check if SOB objects have properly formatted coverage months")
    } else {
      console.log("⚠️  Limited success with associations")
      console.log("   → Review the errors above")
      console.log("   → Some transfers may need manual association")
    }

    console.log("\n🔍 To verify the fix:")
    console.log("   1. Run: npx tsx scripts/get-real-sob-records.ts")
    console.log("   2. Check that SOB associations are now found")
    console.log("   3. Test the export to see coverage months from SOB objects")

  } catch (error) {
    console.error("❌ Association creation failed:", error)

    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.error("\n🔧 AUTHENTICATION ISSUE:")
        console.error("   → Check that your HUBSPOT_API_KEY is valid")
      } else if (error.message.includes("403")) {
        console.error("\n🔧 PERMISSIONS ISSUE:")
        console.error("   → API key may not have permission to create associations")
      }
    }
  }
}

// Run the association creation
createSOBAassociations().catch(console.error)
