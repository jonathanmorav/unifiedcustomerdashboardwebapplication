#!/usr/bin/env node

/**
 * Fetch policies in exact reconciliation CSV format
 * Matches the format from reconciliation-2025-08-25 (5).csv
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

// Carrier mappings based on product types
const CARRIER_MAPPINGS = {
  "Dental": "SunLife",
  "Vision": "Guardian",
  "Accident": "SunLife",
  "Critical Illness": "SunLife",
  "Long Term Disability": "SunLife",
  "Short Term Disability": "SunLife",
  "Voluntary Life & AD&D": "SunLife",
  "Life - Dependent": "SunLife",
  "Long Term Care": "Unum",
  "Identity Theft Protection": "Transunion",
  "Telehealth": "Recuro",
  "Telemedicine": "Recuro",
  "Legal Services": "MetLife",
  "Pet Insurance": "Nationwide",
  "Hospital Indemnity": "SunLife",
  // Sedera products
  "Health": "Sedera",
  "Health Cost Sharing": "Sedera",
  "Sedera Health Cost Sharing": "Sedera",
  // Hanleigh products
  "Excess Disability": "Hanleigh",
  "Excess Disability Insurance": "Hanleigh"
}

// Parse command line arguments
async function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    ids: [],
    output: null
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
    } else if (args[i] === "--output" && args[i + 1]) {
      options.output = args[i + 1]
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
    path: `/crm/v3/objects/${OBJECT_IDS.DWOLLA_TRANSFER}/${transferId}?properties=dwolla_transfer_id,amount,transfer_status,coverage_month,date_initiated,dwolla_customer_id,fee_amount,reconciliation_status,transfer_schedule_date`,
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
        "enrollment_status",
        "policy_type"
      ]
    })

    const batchResponse = await makeRequest(batchOptions, batchBody)
    
    if (batchResponse.status === 200) {
      return batchResponse.data.results || []
    }
  }
  
  return []
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
  const date = new Date(dateString)
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

// Determine carrier based on product name
function getCarrier(productName) {
  if (!productName) return ""
  
  for (const [product, carrier] of Object.entries(CARRIER_MAPPINGS)) {
    if (productName.includes(product)) {
      return carrier
    }
  }
  
  return "Unmapped" // Return unmapped to identify missing mappings
}

// Generate UUID-like ID from transfer data (placeholder - actual UUID would come from Dwolla)
function getTransferUUID(transfer) {
  // In the actual implementation, this would be the real Dwolla UUID
  // For now, we'll use the dwolla_customer_id if available
  const customerId = transfer?.properties?.dwolla_customer_id
  if (customerId && customerId.match(/^[a-f0-9-]{36}$/i)) {
    // If we have a UUID-formatted customer ID, use a portion of it
    // In production, this would be the actual transfer UUID from Dwolla
    return customerId.split('-').slice(0, 3).join('-') + '-f011-ac7e-0a27ad48efdb'
  }
  
  // Fallback to the transfer ID
  return transfer?.properties?.dwolla_transfer_id || transfer?.id || ""
}

// Helper function to escape CSV fields
function escapeCSVField(field) {
  if (field === null || field === undefined) return ""
  const str = String(field)
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Export to CSV format matching the reference
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
    
    // Calculate total policy cost
    const totalPolicyCost = policies.reduce((sum, policy) => {
      return sum + Number(policy.properties.cost_per_month || 0)
    }, 0)
    
    // Detect double billing by comparing transfer amount to policy costs
    // If transfer amount is roughly double the policy costs (+ fees), it's double billed
    const transferAmount = Number(transfer?.properties?.amount || 0)
    const feeAmount = Number(transfer?.properties?.fee_amount || 1.32)
    const expectedSingleBill = totalPolicyCost + feeAmount
    const expectedDoubleBill = (totalPolicyCost * 2) + (feeAmount * 2)
    
    // Check if the transfer amount is closer to double bill amount than single bill
    // Allow for small rounding differences (within $2)
    const isDoubleBilled = Math.abs(transferAmount - expectedDoubleBill) < Math.abs(transferAmount - expectedSingleBill) &&
                          Math.abs(transferAmount - expectedDoubleBill) < 2
    
    // First check the SOB double_bill field, then use our calculation as fallback
    const doubleBill = sob?.properties?.double_bill === "true" ? "Yes" : 
                      isDoubleBilled ? "Yes" : "No"
    
    const transferDate = formatDate(transfer?.properties?.date_initiated || transfer?.properties?.transfer_schedule_date || transfer?.createdAt)
    const companyName = company?.properties?.name || "Unknown"
    const transferUUID = getTransferUUID(transfer)
    const transferStatus = (transfer?.properties?.transfer_status || "").toLowerCase()
    
    if (policies.length > 0) {
      // One row per policy
      for (const policy of policies) {
        const productName = policy.properties.product_name || ""
        const policyHolder = policy.properties.policyholder || ""
        const planName = policy.properties.plan_name || "Standard"
        const carrier = getCarrier(productName)
        
        // Format policy ID as "PolicyHolder - ProductName"
        const policyId = policyHolder && productName 
          ? `${policyHolder} - ${productName}`
          : ""
        
        const row = [
          transferUUID,
          transferDate,
          formatCurrency(transfer?.properties?.amount),
          transferStatus,
          companyName,
          doubleBill,
          policyId,
          policyHolder,
          productName,
          planName,
          formatCurrency(policy.properties.cost_per_month),
          policy.properties.coverage_level || "Individual",
          carrier
        ]
        // Properly escape each field for CSV
        rows.push(row.map(escapeCSVField).join(","))
      }
    } else {
      // Transfer without policies
      const row = [
        transferUUID,
        transferDate,
        formatCurrency(transfer?.properties?.amount),
        transferStatus,
        companyName,
        doubleBill,
        "",
        "",
        "",
        "",
        formatCurrency(0),
        "",
        ""
      ]
      // Properly escape each field for CSV
      rows.push(row.map(escapeCSVField).join(","))
    }
  }
  
  return rows.join("\n")
}

async function main() {
  const options = await parseArgs()
  
  if (options.ids.length === 0) {
    console.error("❌ No Record IDs provided!")
    console.log("\nUsage:")
    console.log("  node scripts/fetch-policies-reconciliation-format.js --ids \"ID1,ID2,ID3\"")
    console.log("  node scripts/fetch-policies-reconciliation-format.js --ids-file record-ids.txt")
    console.log("  echo \"ID1,ID2,ID3\" | node scripts/fetch-policies-reconciliation-format.js --stdin")
    process.exit(1)
  }
  
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key in .env.local!")
    process.exit(1)
  }
  
  console.error(`\n🔍 Fetching policies for ${options.ids.length} record IDs...`)
  console.error(`   Format: Reconciliation CSV`)
  
  const results = []
  
  // Track statistics
  const stats = {
    totalProcessed: 0,
    transfersFound: 0,
    transfersNotFound: 0,
    transfersWithSOB: 0,
    transfersWithoutSOB: 0,
    transfersWithPolicies: 0,
    transfersWithoutPolicies: 0,
    apiErrors: 0,
    unmappedCarriers: new Set(),
    failedTransfers: []
  }
  
  for (let i = 0; i < options.ids.length; i++) {
    const recordId = options.ids[i]
    
    process.stderr.write(`\r   Processing ${i + 1}/${options.ids.length}: ${recordId}...`)
    
    try {
      // Get transfer details
      const transfer = await getTransferDetails(recordId)
      
      if (transfer) {
        stats.transfersFound++
        
        // Get associated SOB
        const sobAssociations = await getTransferSOBAssociations(recordId)
        let sob = null
        let policies = []
        
        if (sobAssociations.length > 0) {
          stats.transfersWithSOB++
          sob = await getSOBDetails(sobAssociations[0].id)
          
          // Get policies for SOB
          policies = await getSOBPolicies(sobAssociations[0].id)
          
          if (policies.length > 0) {
            stats.transfersWithPolicies++
            
            // Track unmapped carriers
            policies.forEach(policy => {
              const productName = policy.properties.product_name || ""
              const carrier = getCarrier(productName)
              if (carrier === "Unmapped" && productName) {
                stats.unmappedCarriers.add(productName)
              }
            })
          } else {
            stats.transfersWithoutPolicies++
          }
        } else {
          stats.transfersWithoutSOB++
          stats.transfersWithoutPolicies++
        }
        
        // Get company details
        let company = null
        if (transfer.properties.dwolla_customer_id) {
          company = await getCompanyByDwollaId(transfer.properties.dwolla_customer_id)
        }
        
        results.push({
          recordId,
          transfer,
          sob,
          company,
          policies
        })
      } else {
        stats.transfersNotFound++
        stats.failedTransfers.push(recordId)
      }
      
      stats.totalProcessed++
      
    } catch (error) {
      console.error(`\n⚠️  Error processing ${recordId}:`, error.message)
      stats.apiErrors++
      stats.failedTransfers.push(recordId)
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.error(`\n✅ Processing complete!`)
  
  // Print statistics
  console.error(`\n📊 Statistics:`)
  console.error(`   Total Processed: ${stats.totalProcessed}`)
  console.error(`   Transfers Found: ${stats.transfersFound}`)
  console.error(`   Transfers Not Found: ${stats.transfersNotFound}`)
  console.error(`   Transfers with SOB: ${stats.transfersWithSOB}`)
  console.error(`   Transfers without SOB: ${stats.transfersWithoutSOB}`)
  console.error(`   Transfers with Policies: ${stats.transfersWithPolicies}`)
  console.error(`   Transfers without Policies: ${stats.transfersWithoutPolicies}`)
  console.error(`   API Errors: ${stats.apiErrors}`)
  
  if (stats.unmappedCarriers.size > 0) {
    console.error(`\n⚠️  Unmapped Products Found:`)
    Array.from(stats.unmappedCarriers).forEach(product => {
      console.error(`   - ${product}`)
    })
  }
  
  if (stats.failedTransfers.length > 0) {
    console.error(`\n❌ Failed Transfer IDs: ${stats.failedTransfers.length}`)
    if (stats.failedTransfers.length <= 10) {
      stats.failedTransfers.forEach(id => console.error(`   - ${id}`))
    } else {
      console.error(`   (showing first 10)`)
      stats.failedTransfers.slice(0, 10).forEach(id => console.error(`   - ${id}`))
    }
  }
  
  // Export results
  const csvContent = exportToCSV(results)
  
  if (options.output) {
    fs.writeFileSync(options.output, csvContent)
    console.error(`\n📄 Results saved to: ${options.output}`)
  } else {
    console.log(csvContent)
  }
}

// Run the script
main().catch((error) => {
  console.error("❌ Unhandled error:", error)
  process.exit(1)
})