/**
 * Script to analyze SOB objects and identify potential matching criteria
 * with Dwolla transfers
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

  // Get SOB objects
  async getSOBObjects(limit: number = 10) {
    const url = `${this.baseUrl}/crm/v3/objects/2-45680577?limit=${limit}&properties=amount_to_draft,fee_amount,coverage_month,pdf_document_url,double_bill,hs_object_id,createdate`
    const response = await this.fetchWithRetry<{ results: any[] }>(url)
    return response.results
  }

  // Get company associations for SOB objects
  async getSOBCompanyAssociations(sobId: string) {
    const url = `${this.baseUrl}/crm/v3/objects/2-45680577/${sobId}/associations/companies`
    return this.fetchWithRetry<{ results: Array<{ id: string; type: string }> }>(url)
  }

  // Get company details
  async getCompanyById(companyId: string) {
    const url = `${this.baseUrl}/crm/v3/objects/companies/${companyId}?properties=name,domain`
    return this.fetchWithRetry<{ id: string; properties: any }>(url)
  }
}

async function analyzeSOBObjects() {
  console.log("🔍 Analyzing SOB Objects for Association Potential")
  console.log("=================================================")

  // Check if HUBSPOT_API_KEY is available
  const hubspotApiKey = process.env.HUBSPOT_API_KEY
  if (!hubspotApiKey) {
    console.log("❌ HUBSPOT_API_KEY not found. Run:")
    console.log("   export HUBSPOT_API_KEY=your_key_here")
    return
  }

  console.log("✅ HubSpot API key found, proceeding...")

  try {
    const hubspotClient = new DiagnosticHubSpotClient(hubspotApiKey)

    // Step 1: Get SOB objects
    console.log("\n1. Fetching SOB objects...")
    const sobObjects = await hubspotClient.getSOBObjects(20)

    console.log(`✅ Found ${sobObjects.length} SOB objects`)

    if (sobObjects.length === 0) {
      console.log("❌ No SOB objects found. Cannot proceed with association analysis.")
      return
    }

    // Step 2: Analyze SOB object properties
    console.log("\n2. Analyzing SOB object properties...")

    const sobAnalysis = {
      total: sobObjects.length,
      withCoverageMonth: 0,
      withAmountToDraft: 0,
      withCompanyAssociations: 0,
      coverageMonthValues: new Set<string>(),
      amountRange: { min: Infinity, max: 0, total: 0 },
      companyIds: new Set<string>(),
      sobDetails: [] as Array<{
        id: string,
        coverageMonth: string,
        amountToDraft: number,
        companyId?: string,
        companyName?: string
      }>
    }

    for (const sob of sobObjects) {
      const sobId = sob.id
      const coverageMonth = sob.properties.coverage_month
      const amountToDraft = sob.properties.amount_to_draft

      // Track coverage month values
      if (coverageMonth) {
        sobAnalysis.withCoverageMonth++
        sobAnalysis.coverageMonthValues.add(coverageMonth)
      }

      // Track amount ranges
      if (amountToDraft) {
        sobAnalysis.withAmountToDraft++
        const amount = parseFloat(amountToDraft)
        sobAnalysis.amountRange.min = Math.min(sobAnalysis.amountRange.min, amount)
        sobAnalysis.amountRange.max = Math.max(sobAnalysis.amountRange.max, amount)
        sobAnalysis.amountRange.total += amount
      }

      // Get company associations
      try {
        const companyAssociations = await hubspotClient.getSOBCompanyAssociations(sobId)

        if (companyAssociations.results.length > 0) {
          sobAnalysis.withCompanyAssociations++
          const companyId = companyAssociations.results[0].id
          sobAnalysis.companyIds.add(companyId)

          // Get company details
          try {
            const company = await hubspotClient.getCompanyById(companyId)
            sobAnalysis.sobDetails.push({
              id: sobId,
              coverageMonth: coverageMonth || 'Not set',
              amountToDraft: amountToDraft || 0,
              companyId: companyId,
              companyName: company.properties.name
            })
          } catch (companyError) {
            sobAnalysis.sobDetails.push({
              id: sobId,
              coverageMonth: coverageMonth || 'Not set',
              amountToDraft: amountToDraft || 0,
              companyId: companyId,
              companyName: 'Error loading'
            })
          }
        } else {
          sobAnalysis.sobDetails.push({
            id: sobId,
            coverageMonth: coverageMonth || 'Not set',
            amountToDraft: amountToDraft || 0
          })
        }
      } catch (associationError) {
        sobAnalysis.sobDetails.push({
          id: sobId,
          coverageMonth: coverageMonth || 'Not set',
          amountToDraft: amountToDraft || 0
        })
      }
    }

    // Step 3: Display analysis results
    console.log("\n3. 📊 SOB ANALYSIS RESULTS")
    console.log("========================")
    console.log(`Total SOB objects: ${sobAnalysis.total}`)
    console.log(`With coverage month: ${sobAnalysis.withCoverageMonth} (${Math.round(sobAnalysis.withCoverageMonth / sobAnalysis.total * 100)}%)`)
    console.log(`With amount to draft: ${sobAnalysis.withAmountToDraft} (${Math.round(sobAnalysis.withAmountToDraft / sobAnalysis.total * 100)}%)`)
    console.log(`With company associations: ${sobAnalysis.withCompanyAssociations} (${Math.round(sobAnalysis.withCompanyAssociations / sobAnalysis.total * 100)}%)`)
    console.log(`Unique companies: ${sobAnalysis.companyIds.size}`)

    console.log(`\nCoverage month values: ${Array.from(sobAnalysis.coverageMonthValues).join(', ')}`)

    if (sobAnalysis.withAmountToDraft > 0) {
      console.log(`\nAmount range: $${sobAnalysis.amountRange.min} - $${sobAnalysis.amountRange.max}`)
      console.log(`Average amount: $${Math.round(sobAnalysis.amountRange.total / sobAnalysis.withAmountToDraft)}`)
    }

    // Step 4: Display sample SOB details
    console.log("\n4. 📋 SAMPLE SOB OBJECTS")
    console.log("========================")

    const sampleSize = Math.min(5, sobAnalysis.sobDetails.length)
    for (let i = 0; i < sampleSize; i++) {
      const sob = sobAnalysis.sobDetails[i]
      console.log(`\nSOB ${i + 1}:`)
      console.log(`  ID: ${sob.id}`)
      console.log(`  Coverage Month: ${sob.coverageMonth}`)
      console.log(`  Amount to Draft: $${sob.amountToDraft}`)
      if (sob.companyName) {
        console.log(`  Company: ${sob.companyName} (${sob.companyId})`)
      } else {
        console.log(`  Company: Not associated`)
      }
    }

    // Step 5: Identify matching strategies
    console.log("\n5. 🎯 POTENTIAL MATCHING STRATEGIES")
    console.log("=================================")

    console.log("Based on available data, here are potential ways to match Dwolla transfers to SOB objects:")
    console.log("")

    if (sobAnalysis.withCompanyAssociations > 0) {
      console.log("✅ Strategy 1: Company-based matching")
      console.log("   → Match transfers to SOBs via associated companies")
      console.log("   → Requires company associations on both transfers and SOBs")
      console.log(`   → Coverage: ${sobAnalysis.withCompanyAssociations}/${sobAnalysis.total} SOBs have companies`)
    }

    if (sobAnalysis.withAmountToDraft > 0) {
      console.log("\n✅ Strategy 2: Amount-based matching")
      console.log("   → Match transfers to SOBs by amount_to_draft")
      console.log("   → Requires accurate amount data in both systems")
      console.log(`   → Coverage: ${sobAnalysis.withAmountToDraft}/${sobAnalysis.total} SOBs have amounts`)
    }

    if (sobAnalysis.withCoverageMonth > 0) {
      console.log("\n✅ Strategy 3: Coverage month matching")
      console.log("   → Match transfers to SOBs by coverage month")
      console.log("   → Requires coverage month data in transfers")
      console.log(`   → Coverage: ${sobAnalysis.withCoverageMonth}/${sobAnalysis.total} SOBs have coverage months`)
    }

    console.log("\n❓ Strategy 4: Manual association")
    console.log("   → Manually associate transfers to SOBs")
    console.log("   → Most reliable but time-consuming")
    console.log("   → Best for initial setup and corrections")

    // Step 6: Recommendations
    console.log("\n6. 💡 RECOMMENDATIONS")
    console.log("===================")

    const bestStrategy = sobAnalysis.withCompanyAssociations > sobAnalysis.withAmountToDraft ?
      "Company-based" : "Amount-based"

    console.log(`🎯 Recommended primary strategy: ${bestStrategy} matching`)
    console.log("")

    if (sobAnalysis.withCompanyAssociations === 0 && sobAnalysis.withAmountToDraft === 0) {
      console.log("⚠️  Limited matching options available")
      console.log("   → Consider manual association or adding more data to SOB objects")
    }

    console.log("\nNext step: Create association script using the recommended strategy")

  } catch (error) {
    console.error("❌ Analysis failed:", error)

    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.error("\n🔧 AUTHENTICATION ISSUE:")
        console.error("   → Check that your HUBSPOT_API_KEY is valid")
      } else if (error.message.includes("403")) {
        console.error("\n🔧 PERMISSIONS ISSUE:")
        console.error("   → API key may not have permission to read SOB objects")
      }
    }
  }
}

// Run the analysis
analyzeSOBObjects().catch(console.error)
