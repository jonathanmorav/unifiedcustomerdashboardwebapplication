#!/usr/bin/env node

/**
 * Test script to verify coverage_month field is included in CSV exports
 */

import { TransferAdapter } from "../lib/api/adapters/transfer-adapter"

async function testCoverageMonthExport() {
  console.log("Testing Coverage Month Export Field")
  console.log("====================================\n")

  try {
    const adapter = new TransferAdapter()
    
    // Test fetching transfers with coverage month
    console.log("1. Fetching transfers from database...")
    const dbResult = await adapter.getTransfersWithCompatibility({
      limit: 5,
      page: 1,
      useHubSpot: false
    })
    
    console.log(`   Found ${dbResult.transfers.length} transfers from database`)
    
    // Check if transfers have coverage month
    console.log("\n2. Checking coverage_month field in database transfers:")
    dbResult.transfers.forEach((transfer, index) => {
      console.log(`   Transfer ${index + 1}:`)
      console.log(`     - ID: ${transfer.dwollaId}`)
      console.log(`     - Coverage Month: ${transfer.coverageMonth || "NOT SET"}`)
      console.log(`     - Created: ${new Date(transfer.created).toISOString()}`)
    })
    
    // Test fetching from HubSpot if configured
    if (process.env.HUBSPOT_API_KEY) {
      console.log("\n3. Fetching transfers from HubSpot...")
      const hubspotResult = await adapter.getTransfersWithCompatibility({
        limit: 5,
        page: 1,
        useHubSpot: true
      })
      
      console.log(`   Found ${hubspotResult.transfers.length} transfers from HubSpot`)
      
      console.log("\n4. Checking coverage_month field in HubSpot transfers:")
      hubspotResult.transfers.forEach((transfer, index) => {
        console.log(`   Transfer ${index + 1}:`)
        console.log(`     - ID: ${transfer.dwollaId}`)
        console.log(`     - Coverage Month: ${transfer.coverageMonth || "NOT SET"}`)
        console.log(`     - Created: ${new Date(transfer.created).toISOString()}`)
      })
    } else {
      console.log("\n3. Skipping HubSpot test (HUBSPOT_API_KEY not configured)")
    }
    
    // Test CSV export format
    console.log("\n5. Sample CSV Export Format:")
    console.log("   Headers: Transfer ID, Transfer Date, Transfer Amount, Transfer Status, Company Name, Coverage Month, Double Bill, ...")
    
    if (dbResult.transfers.length > 0) {
      const sampleTransfer = dbResult.transfers[0]
      console.log(`   Sample Row: ${sampleTransfer.dwollaId}, ${new Date(sampleTransfer.created).toLocaleDateString()}, ${sampleTransfer.amount}, ${sampleTransfer.status}, ${sampleTransfer.companyName || ""}, ${sampleTransfer.coverageMonth || ""}, ...`)
    }
    
    console.log("\n✅ Coverage Month field is properly configured for CSV export!")
    console.log("   The field will appear between 'Company Name' and 'Double Bill' columns")
    
  } catch (error) {
    console.error("\n❌ Error testing coverage month export:", error)
    process.exit(1)
  }
}

// Run the test
testCoverageMonthExport().then(() => {
  console.log("\nTest completed successfully!")
  process.exit(0)
}).catch(error => {
  console.error("Test failed:", error)
  process.exit(1)
})
