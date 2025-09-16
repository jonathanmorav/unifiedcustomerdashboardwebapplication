/**
 * Analyze SOB objects and database transactions to identify potential matching criteria
 */

import { prisma } from "@/lib/db"

async function analyzeSOBTransactionMatching() {
  console.log("🔍 Analyzing SOB and Transaction Data for Matching")
  console.log("=================================================")

  const hubspotApiKey = process.env.HUBSPOT_API_KEY
  if (!hubspotApiKey) {
    console.log("❌ HUBSPOT_API_KEY not found. Run:")
    console.log("   export HUBSPOT_API_KEY=your_key_here")
    return
  }

  console.log("✅ HUBSPOT_API_KEY found")

  try {
    // Get database transactions
    console.log("\n1. Fetching database transactions...")
    const dbTransactions = await prisma.aCHTransaction.findMany({
      take: 20,
      orderBy: { created: 'desc' },
      select: {
        id: true,
        dwollaId: true,
        amount: true,
        status: true,
        created: true,
        customerName: true,
        companyName: true,
        correlationId: true,
        metadata: true
      }
    })

    console.log(`   Found ${dbTransactions.length} database transactions`)

    // Get HubSpot SOB objects with all available properties
    console.log("\n2. Fetching HubSpot SOB objects...")
    const baseUrl = "https://api.hubapi.com"
    const hubspotResponse = await fetch(`${baseUrl}/crm/v3/objects/2-45680577?limit=50&properties=dwolla_transfer_id,coverage_month,amount_to_draft,fee_amount,pdf_document_url,double_bill,hs_object_id,createdate,hs_lastmodifieddate`, {
      headers: {
        'Authorization': `Bearer ${hubspotApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!hubspotResponse.ok) {
      throw new Error(`HubSpot API failed: ${hubspotResponse.status}`)
    }

    const hubspotData = await hubspotResponse.json()
    const sobObjects = hubspotData.results || []

    console.log(`   Found ${sobObjects.length} HubSpot SOB objects`)

    // Analyze potential matching criteria
    console.log("\n3. 📊 MATCHING CRITERIA ANALYSIS")
    console.log("===============================")

    // Amount-based matching potential
    console.log("\nAmount-based matching analysis:")
    const dbAmounts = dbTransactions.map(tx => parseFloat(tx.amount?.toString() || '0')).filter(a => a > 0)
    const sobAmounts = sobObjects.map((sob: any) => parseFloat(sob.properties.amount_to_draft || '0')).filter(a => a > 0)

    console.log(`   Database amounts: ${dbAmounts.length} non-zero amounts`)
    console.log(`   SOB amounts: ${sobAmounts.length} non-zero amounts`)
    
    if (dbAmounts.length > 0 && sobAmounts.length > 0) {
      const dbAmountRange = { min: Math.min(...dbAmounts), max: Math.max(...dbAmounts) }
      const sobAmountRange = { min: Math.min(...sobAmounts), max: Math.max(...sobAmounts) }
      
      console.log(`   DB amount range: $${dbAmountRange.min} - $${dbAmountRange.max}`)
      console.log(`   SOB amount range: $${sobAmountRange.min} - $${sobAmountRange.max}`)

      // Check for exact amount matches
      const exactMatches = dbAmounts.filter(dbAmount => 
        sobAmounts.some(sobAmount => Math.abs(dbAmount - sobAmount) < 0.01)
      )
      console.log(`   Exact amount matches: ${exactMatches.length}`)
    } else {
      const exactMatches: number[] = []
    }

    // Date-based matching potential
    console.log("\nDate-based matching analysis:")
    const dbDates = dbTransactions.map(tx => tx.created.toISOString().split('T')[0])
    const sobDates = sobObjects.map((sob: any) => {
      const createDate = sob.properties.createdate
      return createDate ? new Date(createDate).toISOString().split('T')[0] : null
    }).filter(Boolean)

    console.log(`   Database transaction dates: ${new Set(dbDates).size} unique dates`)
    console.log(`   SOB creation dates: ${new Set(sobDates).size} unique dates`)

    // Coverage month analysis
    console.log("\nCoverage month analysis:")
    const sobCoverageMonths = sobObjects.map((sob: any) => sob.properties.coverage_month).filter(Boolean)
    const uniqueCoverageMonths = [...new Set(sobCoverageMonths)]
    
    console.log(`   SOB coverage months: ${sobCoverageMonths.length} populated`)
    console.log(`   Unique coverage values: ${uniqueCoverageMonths.join(', ')}`)

    // Company name matching potential
    console.log("\nCompany name matching analysis:")
    const dbCompanies = dbTransactions.map(tx => tx.companyName).filter(Boolean)
    const uniqueDbCompanies = [...new Set(dbCompanies)]
    
    console.log(`   Database companies: ${dbCompanies.length} transactions with company names`)
    console.log(`   Unique DB companies: ${uniqueDbCompanies.length}`)

    // Display sample data for matching strategy development
    console.log("\n4. 📋 SAMPLE DATA FOR MATCHING STRATEGY")
    console.log("======================================")

    console.log("\nSample Database Transactions:")
    console.log("─".repeat(50))
    dbTransactions.slice(0, 5).forEach((tx, index) => {
      console.log(`${index + 1}. Amount: $${tx.amount} | Company: ${tx.companyName || 'N/A'} | Date: ${tx.created.toISOString().split('T')[0]}`)
    })

    console.log("\nSample SOB Objects:")
    console.log("─".repeat(50))
    sobObjects.slice(0, 5).forEach((sob: any, index: number) => {
      const createDate = sob.properties.createdate ? new Date(sob.properties.createdate).toISOString().split('T')[0] : 'N/A'
      console.log(`${index + 1}. Amount: $${sob.properties.amount_to_draft || 'N/A'} | Coverage: ${sob.properties.coverage_month || 'N/A'} | Date: ${createDate}`)
    })

    // Suggest matching strategies
    console.log("\n5. 💡 RECOMMENDED MATCHING STRATEGIES")
    console.log("===================================")

    console.log("Based on the analysis, here are potential matching strategies:")
    console.log("")

    // Check for exact amount matches (declare at top level)
    let exactMatches: number[] = []
    if (dbAmounts.length > 0 && sobAmounts.length > 0) {
      exactMatches = dbAmounts.filter(dbAmount => 
        sobAmounts.some(sobAmount => Math.abs(dbAmount - sobAmount) < 0.01)
      )
      
      if (exactMatches.length > 0) {
        console.log("✅ Strategy 1: Exact Amount Matching")
        console.log("   → Match transactions to SOBs by exact amount")
        console.log(`   → Potential matches: ${exactMatches.length}`)
        console.log("   → Risk: Multiple SOBs with same amount")
      }
    }

    console.log("\n✅ Strategy 2: Amount + Date Range Matching")
    console.log("   → Match by amount within date proximity (±7 days)")
    console.log("   → More precise than amount alone")
    console.log("   → Good for transactions created around SOB creation time")

    console.log("\n✅ Strategy 3: Company Name + Amount Matching")
    console.log("   → Match by company name and amount")
    console.log("   → Requires SOB objects to have company associations")
    console.log("   → Most business-logic accurate")

    console.log("\n✅ Strategy 4: Hybrid Scoring System")
    console.log("   → Score matches based on multiple criteria:")
    console.log("     - Amount similarity (exact = 100, close = 50-99)")
    console.log("     - Date proximity (same day = 100, within week = 50-99)")
    console.log("     - Company match (exact = 100)")
    console.log("   → Use highest scoring match above threshold")

    console.log("\n6. 🎯 NEXT STEPS")
    console.log("===============")
    console.log("1. Implement the hybrid scoring system (most robust)")
    console.log("2. Test with sample data to validate matches")
    console.log("3. Integrate into export route")
    console.log("4. Add fallback logic for unmatched transactions")

  } catch (error) {
    console.error("❌ Analysis failed:", error)
  }
}

// Run the analysis
analyzeSOBTransactionMatching().catch(console.error)
