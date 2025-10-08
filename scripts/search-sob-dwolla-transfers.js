#!/usr/bin/env node

/**
 * Search for SOB IDs that have been processed via Dwolla transfers
 * 
 * This script searches across HubSpot and local database to find:
 * - All SOB IDs that have associated Dwolla transfers
 * - Transfer status and processing information
 * - Company associations and customer details
 * 
 * Usage: node scripts/search-sob-dwolla-transfers.js [options]
 * 
 * Options:
 *   --coverage-month YYYY-MM    Filter by specific coverage month
 *   --status STATUS             Filter by transfer status (processed, failed, pending)
 *   --customer-id ID            Search by specific Dwolla customer ID
 *   --export-csv FILE           Export results to CSV file
 *   --detailed                  Include detailed policy information
 *   --format FORMAT             Output format: json, table, csv (default: table)
 */

const https = require("https")
const fs = require("fs")
const path = require("path")

// Load environment variables
const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
  return match ? match[1] : null
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")
const DATABASE_URL = getEnvVar("DATABASE_URL")

// HubSpot object IDs
const DWOLLA_TRANSFER_OBJECT_ID = "45362259"
const SOB_OBJECT_ID = "2-45680577"
const COMPANY_OBJECT_ID = "companies"

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  coverageMonth: null,
  status: null,
  customerId: null,
  exportCsv: null,
  detailed: args.includes("--detailed"),
  format: "table"
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--coverage-month" && args[i + 1]) {
    options.coverageMonth = args[i + 1]
  }
  if (args[i] === "--status" && args[i + 1]) {
    options.status = args[i + 1]
  }
  if (args[i] === "--customer-id" && args[i + 1]) {
    options.customerId = args[i + 1]
  }
  if (args[i] === "--export-csv" && args[i + 1]) {
    options.exportCsv = args[i + 1]
    options.format = "csv"
  }
  if (args[i] === "--format" && args[i + 1]) {
    options.format = args[i + 1]
  }
}

async function makeRequest(requestOptions, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let responseData = ""
      res.on("data", (chunk) => {
        responseData += chunk
      })
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) })
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData })
        }
      })
    })
    req.on("error", reject)
    if (data) req.write(data)
    req.end()
  })
}

// Get all Dwolla Transfers with optional filtering
async function getDwollaTransfers() {
  const searchOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/search`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const filters = []
  
  if (options.coverageMonth) {
    filters.push({
      propertyName: "coverage_month",
      operator: "EQ",
      value: options.coverageMonth,
    })
  }

  if (options.status) {
    const statusMap = {
      'processed': 'processed',
      'failed': 'failed',
      'pending': 'pending',
      'completed': 'processed'
    }
    filters.push({
      propertyName: "transfer_status",
      operator: "EQ",
      value: statusMap[options.status.toLowerCase()] || options.status,
    })
  }

  if (options.customerId) {
    filters.push({
      propertyName: "dwolla_customer_id",
      operator: "EQ",
      value: options.customerId,
    })
  }

  const searchBody = JSON.stringify({
    filterGroups: filters.length > 0 ? [{ filters }] : [],
    properties: [
      "dwolla_transfer_id",
      "dwolla_customer_id", 
      "amount",
      "fee_amount",
      "transfer_status",
      "reconciliation_status",
      "coverage_month",
      "date_initiated",
      "transfer_schedule_date",
      "hs_object_id",
    ],
    limit: 100,
  })

  let allResults = []
  let after = null

  do {
    if (after) {
      const searchObj = JSON.parse(searchBody)
      searchObj.after = after
      searchBody = JSON.stringify(searchObj)
    }

    const response = await makeRequest(searchOptions, searchBody)
    
    if (response.status === 200) {
      const results = response.data.results || []
      allResults = allResults.concat(results)
      after = response.data.paging?.next?.after
    } else {
      console.error(`Failed to fetch Dwolla transfers: ${response.status}`, response.data)
      break
    }
  } while (after)

  return allResults
}

// Get SOB associations for a transfer
async function getTransferSOBAssociations(transferId) {
  const associationsOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/${transferId}/associations/${SOB_OBJECT_ID}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(associationsOptions)
  
  if (response.status === 200) {
    return response.data.results || []
  }
  
  return []
}

// Get SOB details by ID
async function getSOBDetails(sobId) {
        const sobOptions = {
        hostname: "api.hubapi.com",
        path: `/crm/v3/objects/${SOB_OBJECT_ID}/${sobId}?properties=amount_to_draft,fee_amount,coverage_month,pdf_document_url,double_bill,hs_object_id`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }

  const response = await makeRequest(sobOptions)
  
  if (response.status === 200) {
    return response.data
  }
  
  return null
}

// Get company details by Dwolla customer ID
async function getCompanyByDwollaId(dwollaCustomerId) {
  if (!dwollaCustomerId) return null
  
  const searchOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${COMPANY_OBJECT_ID}/search`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const searchBody = JSON.stringify({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "dwolla_customer_id",
            operator: "EQ",
            value: dwollaCustomerId,
          },
        ],
      },
    ],
    properties: ["name", "dwolla_customer_id", "hs_object_id"],
    limit: 1,
  })

  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200 && response.data.results?.length > 0) {
    return response.data.results[0]
  }
  
  return null
}

// Get company SOB associations
async function getCompanySOBs(companyId) {
  const associationsOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${COMPANY_OBJECT_ID}/${companyId}/associations/${SOB_OBJECT_ID}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(associationsOptions)
  
  if (response.status === 200) {
    return response.data.results || []
  }
  
  return []
}

// Get policies for a SOB (if detailed flag is set)
async function getSOBPolicies(sobId) {
  if (!options.detailed) return []

  const associationsOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${SOB_OBJECT_ID}/${sobId}/associations/2-45586773`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(associationsOptions)
  
  if (response.status === 200 && response.data.results?.length > 0) {
    // Batch read policy details
    const policyIds = response.data.results.map(a => a.id)
    
    const batchOptions = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/2-45586773/batch/read`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }

    const batchBody = JSON.stringify({
      inputs: policyIds.map(id => ({ id })),
      properties: [
        "policyholder",
        "product_name",
        "cost_per_month",
        "coverage_level",
        "first_name",
        "last_name"
      ]
    })

    const batchResponse = await makeRequest(batchOptions, batchBody)
    
    if (batchResponse.status === 200) {
      return batchResponse.data.results || []
    }
  }
  
  return []
}

// Format currency
function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString()
}

// Export to CSV
function exportToCsv(results, filename) {
  const headers = [
    "SOB ID",
    "Transfer ID", 
    "Company Name",
    "Dwolla Customer ID",
    "Coverage Month",
    "Transfer Amount",
    "SOB Amount",
    "Fee Amount",
    "Transfer Status",
    "Reconciliation Status",
    "Date Initiated",
    "Policy Count"
  ]

  if (options.detailed) {
    headers.push("Policies")
  }

  const rows = results.map(result => {
    const row = [
      result.sobId || "N/A",
      result.transfer.properties.dwolla_transfer_id || "N/A",
      result.company?.properties?.name || "Unknown",
      result.transfer.properties.dwolla_customer_id || "N/A",
      result.transfer.properties.coverage_month || "N/A",
      result.transfer.properties.amount || "0",
      result.sob?.properties?.amount_to_draft || "0",
      result.transfer.properties.fee_amount || "0",
      result.transfer.properties.transfer_status || "Unknown",
      result.transfer.properties.reconciliation_status || "Unknown",
      formatDate(result.transfer.properties.date_initiated),
      result.policies?.length || 0
    ]

    if (options.detailed && result.policies?.length > 0) {
      const policyStr = result.policies.map(p => 
        `${p.properties.product_name || 'Unknown'} (${p.properties.policyholder || 'Unknown'})`
      ).join("; ")
      row.push(policyStr)
    } else if (options.detailed) {
      row.push("")
    }

    return row
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  fs.writeFileSync(filename, csvContent)
  console.log(`\n📄 Results exported to ${filename}`)
}

// Display results in table format
function displayTable(results) {
  if (results.length === 0) {
    console.log("\n📊 No results found.")
    return
  }

  console.log(`\n📊 Found ${results.length} SOB(s) with Dwolla transfer processing:\n`)
  
  // Group by company for better organization
  const grouped = results.reduce((acc, result) => {
    const companyName = result.company?.properties?.name || "Unknown Company"
    if (!acc[companyName]) acc[companyName] = []
    acc[companyName].push(result)
    return acc
  }, {})

  Object.entries(grouped).forEach(([companyName, companyResults]) => {
    console.log(`🏢 ${companyName}`)
    console.log(`   Dwolla Customer ID: ${companyResults[0].company?.properties?.dwolla_customer_id || "N/A"}`)
    console.log(`   SOBs processed: ${companyResults.length}`)
    console.log("")

    companyResults.forEach(result => {
      console.log(`   📋 SOB ID: ${result.sobId}`)
      console.log(`      Transfer ID: ${result.transfer.properties.dwolla_transfer_id}`)
      console.log(`      Coverage Month: ${result.transfer.properties.coverage_month || "N/A"}`)
      console.log(`      Transfer Amount: ${formatCurrency(result.transfer.properties.amount)}`)
      console.log(`      SOB Amount: ${formatCurrency(result.sob?.properties?.amount_to_draft)}`)
      console.log(`      Fee: ${formatCurrency(result.transfer.properties.fee_amount)}`)
      console.log(`      Status: ${result.transfer.properties.transfer_status || "Unknown"}`)
      console.log(`      Reconciliation: ${result.transfer.properties.reconciliation_status || "Unknown"}`)
      console.log(`      Date: ${formatDate(result.transfer.properties.date_initiated)}`)
      
      if (options.detailed && result.policies?.length > 0) {
        console.log(`      Policies (${result.policies.length}):`)
        result.policies.forEach(policy => {
          console.log(`        - ${policy.properties.product_name || "Unknown"} (${policy.properties.policyholder || "Unknown"})`)
        })
      }
      console.log("")
    })
  })
}

// Display results in JSON format
function displayJson(results) {
  console.log(JSON.stringify(results, null, 2))
}

async function main() {
  console.log("🔍 SOB IDs with Dwolla Transfer Processing Search")
  console.log("===============================================")
  
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key in .env.local!")
    process.exit(1)
  }
  
  console.log(`📊 Search Configuration:`)
  console.log(`   - Coverage Month: ${options.coverageMonth || "All months"}`)
  console.log(`   - Status Filter: ${options.status || "All statuses"}`)
  console.log(`   - Customer ID: ${options.customerId || "All customers"}`)
  console.log(`   - Include Details: ${options.detailed ? "Yes" : "No"}`)
  console.log(`   - Output Format: ${options.format}`)
  console.log("")
  
  try {
    // Step 1: Get all Dwolla transfers
    console.log("📥 Fetching Dwolla transfers...")
    const transfers = await getDwollaTransfers()
    console.log(`   Found ${transfers.length} transfers`)
    
    if (transfers.length === 0) {
      console.log("\n⚠️  No transfers found matching criteria")
      return
    }

    // Step 2: For each transfer, find associated SOBs
    console.log("\n🔗 Finding SOB associations...")
    const results = []
    
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i]
      const transferId = transfer.id
      
      process.stdout.write(`\r   Processing ${i + 1}/${transfers.length} transfers...`)
      
      // Get SOB associations
      const sobAssociations = await getTransferSOBAssociations(transferId)
      
      for (const sobAssoc of sobAssociations) {
        const sobId = sobAssoc.id
        
        // Get SOB details
        const sob = await getSOBDetails(sobId)
        
        // Get company details
        const company = await getCompanyByDwollaId(transfer.properties.dwolla_customer_id)
        
        // Get policies if detailed
        const policies = await getSOBPolicies(sobId)
        
        results.push({
          sobId,
          transfer,
          sob,
          company,
          policies
        })
      }
      
      // If no direct SOB associations, try to find via company
      if (sobAssociations.length === 0 && transfer.properties.dwolla_customer_id) {
        const company = await getCompanyByDwollaId(transfer.properties.dwolla_customer_id)
        
        if (company) {
          const companySOBs = await getCompanySOBs(company.id)
          
          // Try to match by coverage month
          for (const sobAssoc of companySOBs) {
            const sob = await getSOBDetails(sobAssoc.id)
            
            if (sob?.properties?.coverage_month === transfer.properties.coverage_month) {
              const policies = await getSOBPolicies(sobAssoc.id)
              
              results.push({
                sobId: sobAssoc.id,
                transfer,
                sob,
                company,
                policies,
                matchType: "indirect_company_match"
              })
            }
          }
        }
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    console.log(`\n   Found ${results.length} SOB-transfer associations`)
    
    // Step 3: Display results
    if (options.format === "json") {
      displayJson(results)
    } else if (options.format === "csv" || options.exportCsv) {
      const filename = options.exportCsv || `sob-dwolla-transfers-${new Date().toISOString().slice(0, 10)}.csv`
      exportToCsv(results, filename)
      if (options.format !== "csv") {
        displayTable(results)
      }
    } else {
      displayTable(results)
    }
    
    // Summary statistics
    console.log(`\n📈 Summary Statistics:`)
    console.log(`   - Total SOBs with transfers: ${results.length}`)
    console.log(`   - Unique companies: ${new Set(results.map(r => r.company?.id)).size}`)
    console.log(`   - Coverage months: ${new Set(results.map(r => r.transfer.properties.coverage_month)).size}`)
    
    const statusCounts = results.reduce((acc, r) => {
      const status = r.transfer.properties.transfer_status || "unknown"
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})
    
    console.log(`   - Status breakdown:`)
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`     • ${status}: ${count}`)
    })
    
    const totalAmount = results.reduce((sum, r) => {
      return sum + Number(r.transfer.properties.amount || 0)
    }, 0)
    
    console.log(`   - Total transfer amount: ${formatCurrency(totalAmount)}`)
    
  } catch (error) {
    console.error("\n💥 Search failed:", error.message)
    if (error.stack) {
      console.error("Stack trace:", error.stack)
    }
    process.exit(1)
  }
}

// Run the search
main().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})