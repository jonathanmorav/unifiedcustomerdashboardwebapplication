#!/usr/bin/env node

/**
 * Simple SOB-Dwolla Search Demo (No environment dependencies)
 * 
 * This script demonstrates the data structures and search patterns 
 * used to find SOB IDs with Dwolla transfer processing.
 */

console.log("🔍 SOB-Dwolla Transfer Search Capability Demo")
console.log("===========================================")
console.log("")

// Mock data structures that mirror the real system
const mockCompanies = [
  {
    companyId: "comp-12345",
    companyName: "Acme Corporation",
    dwollaCustomerId: "dwolla-customer-456"
  },
  {
    companyId: "comp-67890", 
    companyName: "TechStart Inc",
    dwollaCustomerId: "dwolla-customer-789"
  },
  {
    companyId: "comp-54321",
    companyName: "Global Enterprises",
    dwollaCustomerId: "dwolla-customer-101"
  }
]

const mockSOBs = [
  {
    sobId: "SOB-AAA123",
    companyId: "comp-12345",
    coverageMonth: "2024-08",
    amountToDraft: 1250.00,
    feeAmount: 25.00,
    lastFetchedAt: new Date(),
    policies: ["POL-001", "POL-002", "POL-003"]
  },
  {
    sobId: "SOB-BBB456",
    companyId: "comp-67890", 
    coverageMonth: "2024-08",
    amountToDraft: 875.50,
    feeAmount: 17.51,
    lastFetchedAt: new Date(),
    policies: ["POL-004", "POL-005"]
  },
  {
    sobId: "SOB-CCC789",
    companyId: "comp-54321",
    coverageMonth: "2024-07",
    amountToDraft: 2100.75,
    feeAmount: 42.02,
    lastFetchedAt: new Date(),
    policies: ["POL-006", "POL-007", "POL-008", "POL-009"]
  }
]

const mockDwollaTransfers = [
  {
    transferId: "dwolla-transfer-111",
    dwollaCustomerId: "dwolla-customer-456",
    amount: 1275.00, // amountToDraft + feeAmount
    status: "processed",
    reconciliationStatus: "Matched",
    dateInitiated: "2024-08-15",
    coverageMonth: "2024-08"
  },
  {
    transferId: "dwolla-transfer-222", 
    dwollaCustomerId: "dwolla-customer-789",
    amount: 893.01,
    status: "processed", 
    reconciliationStatus: "Matched",
    dateInitiated: "2024-08-14",
    coverageMonth: "2024-08"
  },
  {
    transferId: "dwolla-transfer-333",
    dwollaCustomerId: "dwolla-customer-101", 
    amount: 2142.77,
    status: "processed",
    reconciliationStatus: "Pending",
    dateInitiated: "2024-07-15", 
    coverageMonth: "2024-07"
  }
]

const mockACHTransactions = [
  {
    achId: "ach-001",
    dwollaId: "dwolla-transfer-111",
    customerId: "dwolla-customer-456",
    companyName: "Acme Corporation",
    amount: 1275.00,
    status: "processed",
    direction: "credit",
    created: "2024-08-15"
  },
  {
    achId: "ach-002", 
    dwollaId: "dwolla-transfer-222",
    customerId: "dwolla-customer-789",
    companyName: "TechStart Inc", 
    amount: 893.01,
    status: "processed",
    direction: "credit",
    created: "2024-08-14"
  },
  {
    achId: "ach-003",
    dwollaId: "dwolla-transfer-333", 
    customerId: "dwolla-customer-101",
    companyName: "Global Enterprises",
    amount: 2142.77,
    status: "processed", 
    direction: "credit",
    created: "2024-07-15"
  }
]

const mockPolicies = [
  { policyId: "POL-001", sobId: "SOB-AAA123", productName: "Dental", monthlyCost: 45.00, carrier: "SunLife" },
  { policyId: "POL-002", sobId: "SOB-AAA123", productName: "Vision", monthlyCost: 12.00, carrier: "Guardian" },
  { policyId: "POL-003", sobId: "SOB-AAA123", productName: "Life - Voluntary", monthlyCost: 125.00, carrier: "SunLife" },
  { policyId: "POL-004", sobId: "SOB-BBB456", productName: "Health", monthlyCost: 450.00, carrier: "Sedera" },
  { policyId: "POL-005", sobId: "SOB-BBB456", productName: "Dental", monthlyCost: 38.50, carrier: "SunLife" },
  { policyId: "POL-006", sobId: "SOB-CCC789", productName: "Health", monthlyCost: 850.00, carrier: "Sedera" },
  { policyId: "POL-007", sobId: "SOB-CCC789", productName: "Dental", monthlyCost: 67.50, carrier: "SunLife" },
  { policyId: "POL-008", sobId: "SOB-CCC789", productName: "Vision", monthlyCost: 15.00, carrier: "Guardian" },
  { policyId: "POL-009", sobId: "SOB-CCC789", productName: "Long Term Disability", monthlyCost: 89.25, carrier: "SunLife" }
]

// Search functions that mirror the real system capabilities

function searchSOBsByDwollaTransfers() {
  console.log("📋 Method 1: Direct SOB-Transfer Association Search")
  console.log("------------------------------------------------")
  
  const results = []
  
  // Find SOBs that have corresponding Dwolla transfers
  mockSOBs.forEach(sob => {
    const company = mockCompanies.find(c => c.companyId === sob.companyId)
    if (company) {
      const transfer = mockDwollaTransfers.find(t => 
        t.dwollaCustomerId === company.dwollaCustomerId && 
        t.coverageMonth === sob.coverageMonth
      )
      
      if (transfer) {
        const sobPolicies = mockPolicies.filter(p => p.sobId === sob.sobId)
        results.push({
          sobId: sob.sobId,
          transferId: transfer.transferId,
          companyName: company.companyName,
          dwollaCustomerId: company.dwollaCustomerId,
          coverageMonth: sob.coverageMonth,
          sobAmount: sob.amountToDraft,
          feeAmount: sob.feeAmount,
          transferAmount: transfer.amount,
          status: transfer.status,
          reconciliationStatus: transfer.reconciliationStatus,
          policyCount: sobPolicies.length,
          policies: sobPolicies
        })
      }
    }
  })
  
  console.log(`   Found ${results.length} SOBs with Dwolla transfer processing:\n`)
  
  results.forEach(result => {
    console.log(`   🏢 ${result.companyName}`)
    console.log(`      SOB ID: ${result.sobId}`)
    console.log(`      Transfer ID: ${result.transferId}`)
    console.log(`      Coverage Month: ${result.coverageMonth}`)
    console.log(`      SOB Amount: $${result.sobAmount.toFixed(2)} + $${result.feeAmount.toFixed(2)} fee`)
    console.log(`      Transfer Amount: $${result.transferAmount.toFixed(2)}`)
    console.log(`      Status: ${result.status} / ${result.reconciliationStatus}`)
    console.log(`      Policies: ${result.policyCount}`)
    
    // Show carrier breakdown
    const carrierTotals = result.policies.reduce((acc, policy) => {
      acc[policy.carrier] = (acc[policy.carrier] || 0) + policy.monthlyCost
      return acc
    }, {})
    
    console.log(`      Carrier Breakdown:`)
    Object.entries(carrierTotals).forEach(([carrier, amount]) => {
      console.log(`        - ${carrier}: $${amount.toFixed(2)}`)
    })
    console.log("")
  })
  
  return results
}

function searchViaACHCorrelation() {
  console.log("📋 Method 2: ACH Transaction Correlation Search")
  console.log("---------------------------------------------")
  
  const results = []
  
  // Start with ACH transactions and find related SOBs
  mockACHTransactions.forEach(ach => {
    const company = mockCompanies.find(c => c.dwollaCustomerId === ach.customerId)
    if (company) {
      const sobs = mockSOBs.filter(s => s.companyId === company.companyId)
      
      sobs.forEach(sob => {
        const sobPolicies = mockPolicies.filter(p => p.sobId === sob.sobId)
        results.push({
          achId: ach.achId,
          dwollaId: ach.dwollaId,
          sobId: sob.sobId,
          companyName: company.companyName,
          achAmount: ach.amount,
          sobAmount: sob.amountToDraft + sob.feeAmount,
          coverageMonth: sob.coverageMonth,
          policyCount: sobPolicies.length,
          matchType: "customer_id_correlation"
        })
      })
    }
  })
  
  console.log(`   Found ${results.length} SOB-ACH correlations:\n`)
  
  results.forEach(result => {
    const amountMatch = Math.abs(result.achAmount - result.sobAmount) < 1.0
    console.log(`   💳 ACH ${result.achId} ↔ SOB ${result.sobId}`)
    console.log(`      Company: ${result.companyName}`)
    console.log(`      ACH Amount: $${result.achAmount.toFixed(2)}`)
    console.log(`      SOB Amount: $${result.sobAmount.toFixed(2)}`)
    console.log(`      Amount Match: ${amountMatch ? '✅' : '❌'}`)
    console.log(`      Coverage: ${result.coverageMonth}`)
    console.log(`      Policies: ${result.policyCount}`)
    console.log("")
  })
  
  return results
}

function searchByCoverageMonth(targetMonth) {
  console.log(`📋 Method 3: Coverage Month Filter Search (${targetMonth})`)
  console.log("---------------------------------------------------")
  
  const results = []
  
  // Find all SOBs for the target coverage month
  const targetSOBs = mockSOBs.filter(s => s.coverageMonth === targetMonth)
  
  targetSOBs.forEach(sob => {
    const company = mockCompanies.find(c => c.companyId === sob.companyId)
    const transfer = mockDwollaTransfers.find(t => 
      t.dwollaCustomerId === company?.dwollaCustomerId && 
      t.coverageMonth === targetMonth
    )
    const ach = mockACHTransactions.find(a => a.dwollaId === transfer?.transferId)
    const policies = mockPolicies.filter(p => p.sobId === sob.sobId)
    
    if (company && transfer) {
      results.push({
        sobId: sob.sobId,
        companyName: company.companyName,
        transferId: transfer.transferId,
        achId: ach?.achId,
        amount: sob.amountToDraft + sob.feeAmount,
        policies: policies.length,
        status: transfer.status
      })
    }
  })
  
  console.log(`   Found ${results.length} SOBs for coverage month ${targetMonth}:\n`)
  
  results.forEach(result => {
    console.log(`   📅 ${result.sobId} - ${result.companyName}`)
    console.log(`      Transfer: ${result.transferId}`)
    console.log(`      ACH: ${result.achId || 'N/A'}`)
    console.log(`      Amount: $${result.amount.toFixed(2)}`)
    console.log(`      Policies: ${result.policies}`)
    console.log(`      Status: ${result.status}`)
    console.log("")
  })
  
  return results
}

function generateSummaryReport(allResults) {
  console.log("📊 Summary Report: SOB IDs with Dwolla Transfer Processing")
  console.log("========================================================")
  
  const uniqueSOBs = new Set()
  const uniqueCompanies = new Set()
  const uniqueTransfers = new Set()
  let totalAmount = 0
  let totalPolicies = 0
  
  allResults.forEach(result => {
    uniqueSOBs.add(result.sobId)
    uniqueCompanies.add(result.companyName)
    if (result.transferId) uniqueTransfers.add(result.transferId)
    totalAmount += result.sobAmount || result.amount || 0
    totalPolicies += result.policyCount || result.policies || 0
  })
  
  console.log(`\n📈 Key Metrics:`)
  console.log(`   - Total SOBs with Dwolla processing: ${uniqueSOBs.size}`)
  console.log(`   - Unique companies: ${uniqueCompanies.size}`)
  console.log(`   - Unique transfers: ${uniqueTransfers.size}`)
  console.log(`   - Total amount processed: $${totalAmount.toFixed(2)}`)
  console.log(`   - Total policies: ${totalPolicies}`)
  
  // Coverage month breakdown
  const monthBreakdown = {}
  mockSOBs.forEach(sob => {
    monthBreakdown[sob.coverageMonth] = (monthBreakdown[sob.coverageMonth] || 0) + 1
  })
  
  console.log(`\n📅 Coverage Months:`)
  Object.entries(monthBreakdown).forEach(([month, count]) => {
    console.log(`   - ${month}: ${count} SOBs`)
  })
  
  // Carrier breakdown
  const carrierBreakdown = {}
  mockPolicies.forEach(policy => {
    carrierBreakdown[policy.carrier] = (carrierBreakdown[policy.carrier] || 0) + policy.monthlyCost
  })
  
  console.log(`\n🏥 Carrier Breakdown:`)
  Object.entries(carrierBreakdown)
    .sort(([,a], [,b]) => b - a)
    .forEach(([carrier, amount]) => {
      console.log(`   - ${carrier}: $${amount.toFixed(2)}`)
    })
  
  console.log(`\n📋 Complete SOB List with Dwolla Processing:`)
  console.log(`${Array.from(uniqueSOBs).join(', ')}`)
}

// Main execution
function main() {
  console.log("This demo shows how the Unified Customer Dashboard can search for")
  console.log("SOB IDs that have been processed via Dwolla transfers using multiple methods.\n")
  
  // Run all search methods
  const results1 = searchSOBsByDwollaTransfers()
  const results2 = searchViaACHCorrelation()
  const results3 = searchByCoverageMonth("2024-08")
  
  // Combine all results
  const allResults = [...results1, ...results2, ...results3]
  
  generateSummaryReport(allResults)
  
  console.log("\n🛠️  Real Implementation:")
  console.log("   - HubSpot API integration for live SOB and transfer data")
  console.log("   - PostgreSQL database with caching for performance")
  console.log("   - Advanced correlation algorithms for matching")
  console.log("   - RESTful APIs for integration with other systems")
  console.log("   - Export capabilities (CSV, JSON)")
  console.log("   - Real-time reconciliation status tracking")
  
  console.log("\n💡 Available Scripts:")
  console.log("   - scripts/search-sob-dwolla-transfers.js (Node.js with HubSpot API)")
  console.log("   - scripts/search-sob-dwolla-transfers.ts (TypeScript version)")
  console.log("   - scripts/query-sob-dwolla-database.ts (Database-only search)")
  console.log("   - scripts/associate-transfers-to-sobs.js (Association management)")
  
  console.log("\n✅ Demo complete! This represents the core functionality")
  console.log("   available in the Unified Customer Dashboard for searching")
  console.log("   and correlating SOB IDs with Dwolla transfer processing.")
}

// Run the demo
main()