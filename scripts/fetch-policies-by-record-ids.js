#!/usr/bin/env node

/**
 * Fetch policies associated with HubSpot Record IDs
 * 
 * This script fetches all policies associated with given HubSpot Record IDs
 * and exports them in a format similar to the reconciliation page CSV export.
 * 
 * Usage: 
 *   node scripts/fetch-policies-by-record-ids.js --ids "ID1,ID2,ID3"
 *   node scripts/fetch-policies-by-record-ids.js --ids-file record-ids.txt
 *   echo "ID1,ID2,ID3" | node scripts/fetch-policies-by-record-ids.js --stdin
 * 
 * Options:
 *   --ids          Comma-separated list of HubSpot Record IDs
 *   --ids-file     File containing Record IDs (one per line or comma-separated)
 *   --stdin        Read IDs from stdin
 *   --format       Output format: csv, json, table (default: csv)
 *   --output       Output file path (default: stdout)
 *   --type         Record type: transfer, sob, company (default: transfer)
 */

const https = require("https")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

// Load environment variables
const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
  return match ? match[1] : null
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")

// HubSpot object IDs
const OBJECT_IDS = {
  DWOLLA_TRANSFER: "2-45362259",
  SOB: "2-45680577",
  COMPANY: "companies",
  POLICY: "2-45586773"
}

// Parse command line arguments
async function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    ids: [],
    format: "csv",
    output: null,
    type: "transfer"
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ids" && args[i + 1]) {
      options.ids = args[i + 1].split(",").map(id => id.trim())
      i++
    } else if (args[i] === "--ids-file" && args[i + 1]) {
      const fileContent = fs.readFileSync(args[i + 1], "utf8")
      options.ids = fileContent.split(/[\n,]/).map(id => id.trim()).filter(Boolean)
      i++
    } else if (args[i] === "--stdin") {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      })
      
      const lines = []
      for await (const line of rl) {
        lines.push(line)
      }
      
      const input = lines.join("\n")
      options.ids = input.split(/[\n,]/).map(id => id.trim()).filter(Boolean)
    } else if (args[i] === "--format" && args[i + 1]) {
      options.format = args[i + 1]
      i++
    } else if (args[i] === "--output" && args[i + 1]) {
      options.output = args[i + 1]
      i++
    } else if (args[i] === "--type" && args[i + 1]) {
      options.type = args[i + 1]
      i++
    }
  }

  return options
}

// Make HubSpot API request
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

// Get transfer details by ID
async function getTransferDetails(transferId) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${OBJECT_IDS.DWOLLA_TRANSFER}/${transferId}?properties=dwolla_transfer_id,amount,transfer_status,coverage_month,date_initiated,dwolla_customer_id,fee_amount,reconciliation_status`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(options)
  
  if (response.status === 200) {
    return response.data
  }
  
  return null
}

// Get SOB associations for a transfer
async function getTransferSOBAssociations(transferId) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${OBJECT_IDS.DWOLLA_TRANSFER}/${transferId}/associations/${OBJECT_IDS.SOB}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(options)
  
  if (response.status === 200) {
    return response.data.results || []
  }
  
  return []
}

// Get SOB details
async function getSOBDetails(sobId) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${OBJECT_IDS.SOB}/${sobId}?properties=amount_to_draft,fee_amount,coverage_month,pdf_document_url,double_bill,client_id___sc__sob_`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(options)
  
  if (response.status === 200) {
    return response.data
  }
  
  return null
}

// Get policies associated with a SOB
async function getSOBPolicies(sobId) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${OBJECT_IDS.SOB}/${sobId}/associations/${OBJECT_IDS.POLICY}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(options)
  
  if (response.status === 200 && response.data.results?.length > 0) {
    // Batch read policy details
    const policyIds = response.data.results.map(a => a.id)
    
    const batchOptions = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/${OBJECT_IDS.POLICY}/batch/read`,
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
        "last_name",
        "carrier",
        "plan_name",
        "policy_id",
        "enrollment_status"
      ]
    })

    const batchResponse = await makeRequest(batchOptions, batchBody)
    
    if (batchResponse.status === 200) {
      return batchResponse.data.results || []
    }
  }
  
  return []
}

// Get company details by ID
async function getCompanyDetails(companyId) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${OBJECT_IDS.COMPANY}/${companyId}?properties=name,dwolla_customer_id,city,state`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(options)
  
  if (response.status === 200) {
    return response.data
  }
  
  return null
}

// Get company by Dwolla customer ID
async function getCompanyByDwollaId(dwollaCustomerId) {
  if (!dwollaCustomerId) return null
  
  const searchOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${OBJECT_IDS.COMPANY}/search`,
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
    properties: ["name", "dwolla_customer_id", "city", "state"],
    limit: 1,
  })

  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200 && response.data.results?.length > 0) {
    return response.data.results[0]
  }
  
  return null
}

// Format currency
function formatCurrency(amount) {
  return Number(amount || 0).toFixed(2)
}

// Format date
function formatDate(dateString) {
  if (!dateString) return ""
  return new Date(dateString).toLocaleDateString()
}

// Export to CSV format
function exportToCSV(results) {
  const rows = []
  
  // Header row
  rows.push([
    "Transfer ID",
    "Transfer Date",
    "Transfer Amount",
    "Transfer Status",
    "Company Name",
    "Double Bill",
    "Policy ID",
    "Policy Holder",
    "Product Name",
    "Plan Name",
    "Monthly Cost",
    "Coverage Level",
    "Carrier"
  ].join(","))
  
  // Data rows
  for (const result of results) {
    const transfer = result.transfer
    const sob = result.sob
    const company = result.company
    const policies = result.policies || []
    
    const doubleBill = sob?.properties?.double_bill === "Yes" ? "Yes" : "No"
    const transferDate = formatDate(transfer?.properties?.date_initiated || transfer?.createdAt)
    const companyName = company?.properties?.name || "Unknown"
    
    if (policies.length > 0) {
      // One row per policy
      for (const policy of policies) {
        const row = [
          transfer?.properties?.dwolla_transfer_id || transfer?.id || "",
          transferDate,
          formatCurrency(transfer?.properties?.amount),
          transfer?.properties?.transfer_status || "",
          `"${companyName}"`,
          doubleBill,
          policy.properties.policy_id || "",
          `"${policy.properties.policyholder || ""}"`,
          `"${policy.properties.product_name || ""}"`,
          `"${policy.properties.plan_name || ""}"`,
          formatCurrency(policy.properties.cost_per_month),
          policy.properties.coverage_level || "",
          policy.properties.carrier || "Unmapped"
        ]
        rows.push(row.join(","))
      }
    } else {
      // Transfer without policies
      const row = [
        transfer?.properties?.dwolla_transfer_id || transfer?.id || "",
        transferDate,
        formatCurrency(transfer?.properties?.amount),
        transfer?.properties?.transfer_status || "",
        `"${companyName}"`,
        doubleBill,
        "",
        "",
        "",
        "",
        "0.00",
        "",
        ""
      ]
      rows.push(row.join(","))
    }
  }
  
  // Add summary section
  rows.push("") // Empty row
  rows.push("CARRIER SUMMARY,,,,,,,,,,,,")
  
  // Calculate carrier totals
  const carrierTotals = {}
  for (const result of results) {
    for (const policy of result.policies || []) {
      const carrier = policy.properties.carrier || "Unmapped"
      const amount = Number(policy.properties.cost_per_month || 0)
      
      if (!carrierTotals[carrier]) {
        carrierTotals[carrier] = {
          totalAmount: 0,
          policyCount: 0,
          products: {}
        }
      }
      
      carrierTotals[carrier].totalAmount += amount
      carrierTotals[carrier].policyCount++
      
      // Track by product
      const product = policy.properties.product_name || "Unknown"
      if (!carrierTotals[carrier].products[product]) {
        carrierTotals[carrier].products[product] = {
          totalAmount: 0,
          policyCount: 0
        }
      }
      carrierTotals[carrier].products[product].totalAmount += amount
      carrierTotals[carrier].products[product].policyCount++
    }
  }
  
  // Add carrier summary rows
  let grandTotal = 0
  for (const [carrier, data] of Object.entries(carrierTotals)) {
    // Carrier level
    rows.push(`,,,,,,,,,,${formatCurrency(data.totalAmount)},${data.policyCount} policies,${carrier}`)
    grandTotal += data.totalAmount
    
    // Product level
    for (const [product, productData] of Object.entries(data.products)) {
      rows.push(`,,,,,,,,  → ${product},,${formatCurrency(productData.totalAmount)},${productData.policyCount} policies,`)
    }
  }
  
  // Grand total
  rows.push(`,,,,,,,,GRAND TOTAL,,${formatCurrency(grandTotal)},,`)
  
  return rows.join("\n")
}

// Export to JSON format
function exportToJSON(results) {
  const output = {
    transfers: results,
    summary: {
      totalTransfers: results.length,
      totalPolicies: results.reduce((sum, r) => sum + (r.policies?.length || 0), 0),
      totalAmount: results.reduce((sum, r) => sum + Number(r.transfer?.properties?.amount || 0), 0),
      carrierBreakdown: {}
    }
  }
  
  // Calculate carrier breakdown
  for (const result of results) {
    for (const policy of result.policies || []) {
      const carrier = policy.properties.carrier || "Unmapped"
      const amount = Number(policy.properties.cost_per_month || 0)
      
      if (!output.summary.carrierBreakdown[carrier]) {
        output.summary.carrierBreakdown[carrier] = {
          totalAmount: 0,
          policyCount: 0
        }
      }
      
      output.summary.carrierBreakdown[carrier].totalAmount += amount
      output.summary.carrierBreakdown[carrier].policyCount++
    }
  }
  
  return JSON.stringify(output, null, 2)
}

// Export to table format
function exportToTable(results) {
  console.log("\n📊 Policy Details for Provided Record IDs\n")
  console.log("=" .repeat(80))
  
  for (const result of results) {
    const transfer = result.transfer
    const sob = result.sob
    const company = result.company
    const policies = result.policies || []
    
    console.log(`\n🔄 Transfer: ${transfer?.properties?.dwolla_transfer_id || transfer?.id}`)
    console.log(`   Amount: $${formatCurrency(transfer?.properties?.amount)}`)
    console.log(`   Status: ${transfer?.properties?.transfer_status || "Unknown"}`)
    console.log(`   Company: ${company?.properties?.name || "Unknown"}`)
    console.log(`   Double Bill: ${sob?.properties?.double_bill === "Yes" ? "Yes" : "No"}`)
    
    if (policies.length > 0) {
      console.log(`   📋 Policies (${policies.length}):`)
      for (const policy of policies) {
        console.log(`      - ${policy.properties.product_name || "Unknown Product"}`)
        console.log(`        Policy ID: ${policy.properties.policy_id || "N/A"}`)
        console.log(`        Holder: ${policy.properties.policyholder || "Unknown"}`)
        console.log(`        Cost: $${formatCurrency(policy.properties.cost_per_month)}/month`)
        console.log(`        Carrier: ${policy.properties.carrier || "Unmapped"}`)
      }
    } else {
      console.log(`   ⚠️  No policies associated`)
    }
  }
  
  // Summary
  console.log("\n" + "=" .repeat(80))
  console.log("📈 SUMMARY")
  console.log(`   Total Transfers: ${results.length}`)
  console.log(`   Total Policies: ${results.reduce((sum, r) => sum + (r.policies?.length || 0), 0)}`)
  console.log(`   Total Transfer Amount: $${formatCurrency(results.reduce((sum, r) => sum + Number(r.transfer?.properties?.amount || 0), 0))}`)
}

async function main() {
  const options = await parseArgs()
  
  if (options.ids.length === 0) {
    console.error("❌ No Record IDs provided!")
    console.log("\nUsage:")
    console.log("  node scripts/fetch-policies-by-record-ids.js --ids \"ID1,ID2,ID3\"")
    console.log("  node scripts/fetch-policies-by-record-ids.js --ids-file record-ids.txt")
    console.log("  echo \"ID1,ID2,ID3\" | node scripts/fetch-policies-by-record-ids.js --stdin")
    process.exit(1)
  }
  
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key in .env.local!")
    process.exit(1)
  }
  
  console.error(`\n🔍 Fetching policies for ${options.ids.length} record IDs...`)
  console.error(`   Type: ${options.type}`)
  console.error(`   Format: ${options.format}`)
  
  const results = []
  
  for (let i = 0; i < options.ids.length; i++) {
    const recordId = options.ids[i]
    
    process.stderr.write(`\r   Processing ${i + 1}/${options.ids.length}: ${recordId}...`)
    
    try {
      let transfer, sob, company, policies = []
      
      if (options.type === "transfer") {
        // Get transfer details
        transfer = await getTransferDetails(recordId)
        
        if (transfer) {
          // Get associated SOB
          const sobAssociations = await getTransferSOBAssociations(recordId)
          
          if (sobAssociations.length > 0) {
            sob = await getSOBDetails(sobAssociations[0].id)
            
            // Get policies for SOB
            policies = await getSOBPolicies(sobAssociations[0].id)
          }
          
          // Get company details
          if (transfer.properties.dwolla_customer_id) {
            company = await getCompanyByDwollaId(transfer.properties.dwolla_customer_id)
          }
        }
      } else if (options.type === "sob") {
        // Direct SOB lookup
        sob = await getSOBDetails(recordId)
        policies = await getSOBPolicies(recordId)
        
        // Try to find associated transfer
        // This would require reverse lookup - not implemented yet
      } else if (options.type === "company") {
        // Company lookup
        company = await getCompanyDetails(recordId)
        
        // Would need to find associated transfers/SOBs
        // This would require more complex queries
      }
      
      results.push({
        recordId,
        transfer,
        sob,
        company,
        policies
      })
      
    } catch (error) {
      console.error(`\n⚠️  Error processing ${recordId}:`, error.message)
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.error(`\n✅ Processing complete!`)
  
  // Export results
  let output
  switch (options.format) {
    case "json":
      output = exportToJSON(results)
      break
    case "table":
      exportToTable(results)
      return
    case "csv":
    default:
      output = exportToCSV(results)
      break
  }
  
  if (options.output) {
    fs.writeFileSync(options.output, output)
    console.error(`\n📄 Results saved to: ${options.output}`)
  } else {
    console.log(output)
  }
}

// Run the script
main().catch((error) => {
  console.error("❌ Unhandled error:", error)
  process.exit(1)
})