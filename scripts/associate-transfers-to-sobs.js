#!/usr/bin/env node

/**
 * Associate Dwolla Transfers to Summary of Benefits in HubSpot
 * 
 * This script creates associations between Dwolla Transfer objects
 * and Summary of Benefits (SOB) objects based on:
 * - Coverage month matching
 * - Customer ID matching
 * - Amount reconciliation
 * 
 * Usage: node scripts/associate-transfers-to-sobs.js [options]
 * 
 * Options:
 *   --dry-run           Preview associations without making API calls
 *   --coverage-month    Process only this coverage month (YYYY-MM)
 *   --limit N          Process only N transfers (default: all)
 */

const https = require("https")
const fs = require("fs")
const path = require("path")

const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
  return match ? match[1] : null
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")
const DWOLLA_TRANSFER_OBJECT_ID = "45362259"
const SOB_OBJECT_ID = "2-45680577"
const COMPANY_OBJECT_ID = "companies"

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  dryRun: args.includes("--dry-run"),
  coverageMonth: null,
  limit: null,
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--coverage-month" && args[i + 1]) {
    options.coverageMonth = args[i + 1]
  }
  if (args[i] === "--limit" && args[i + 1]) {
    options.limit = parseInt(args[i + 1])
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

// Get all Dwolla Transfers for a coverage month
async function getTransfersForMonth(coverageMonth) {
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
  
  if (coverageMonth) {
    filters.push({
      propertyName: "coverage_month",
      operator: "EQ",
      value: coverageMonth,
    })
  }
  
  // Only get unmatched transfers
  filters.push({
    propertyName: "reconciliation_status",
    operator: "IN",
    values: ["Pending", "Out of Balance"],
  })

  const searchBody = JSON.stringify({
    filterGroups: filters.length > 0 ? [{ filters }] : [],
    properties: [
      "dwolla_transfer_id",
      "dwolla_customer_id",
      "amount",
      "coverage_month",
      "reconciliation_status",
      "hs_object_id",
    ],
    limit: options.limit || 100,
  })

  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200) {
    return response.data.results || []
  }
  
  console.error(`Failed to fetch transfers: ${response.status}`, response.data)
  return []
}

// Get all SOBs for a coverage month
async function getSOBsForMonth(coverageMonth) {
  const searchOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${SOB_OBJECT_ID}/search`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const filters = []
  
  if (coverageMonth) {
    filters.push({
      propertyName: "coverage_month",
      operator: "EQ",
      value: coverageMonth,
    })
  }

  const searchBody = JSON.stringify({
    filterGroups: filters.length > 0 ? [{ filters }] : [],
    properties: [
      "amount_to_draft",
      "fee_amount",
      "coverage_month",
      "hs_object_id",
    ],
    limit: 100,
  })

  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200) {
    return response.data.results || []
  }
  
  console.error(`Failed to fetch SOBs: ${response.status}`, response.data)
  return []
}

// Get company for a Dwolla customer ID
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

// Get SOBs associated with a company
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

// Check if transfer is already associated with SOB
async function isTransferAssociatedWithSOB(transferId, sobId) {
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
  
  if (response.status === 200 && response.data.results) {
    return response.data.results.some(assoc => assoc.id === sobId)
  }
  
  return false
}

// Create association between transfer and SOB
async function associateTransferToSOB(transferId, sobId) {
  const associationOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/${transferId}/associations/${SOB_OBJECT_ID}/${sobId}/transfer_to_sob`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(associationOptions)
  
  if (response.status === 200 || response.status === 201) {
    return { success: true }
  }
  
  // If association type doesn't exist, try without specific type
  if (response.status === 400) {
    associationOptions.path = `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/${transferId}/associations/${SOB_OBJECT_ID}/${sobId}`
    const retryResponse = await makeRequest(associationOptions)
    
    if (retryResponse.status === 200 || retryResponse.status === 201) {
      return { success: true }
    }
    
    return { success: false, error: retryResponse.data }
  }
  
  return { success: false, error: response.data }
}

// Update transfer reconciliation status
async function updateTransferStatus(transferId, status) {
  const updateOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/${transferId}`,
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const updateBody = JSON.stringify({
    properties: {
      reconciliation_status: status,
    },
  })

  const response = await makeRequest(updateOptions, updateBody)
  
  return response.status === 200
}

// Match transfers to SOBs
async function matchTransfersToSOBs(transfers, sobs) {
  const matches = []
  const unmatched = []
  
  for (const transfer of transfers) {
    let matched = false
    
    // First try to match by customer ID
    if (transfer.properties.dwolla_customer_id) {
      const company = await getCompanyByDwollaId(transfer.properties.dwolla_customer_id)
      
      if (company) {
        console.log(`  Found company ${company.properties.name} for customer ${transfer.properties.dwolla_customer_id}`)
        
        // Get SOBs for this company
        const companySOBAssociations = await getCompanySOBs(company.id)
        
        // Find matching SOB by coverage month and amount
        for (const sobAssoc of companySOBAssociations) {
          const sob = sobs.find(s => s.id === sobAssoc.id)
          
          if (sob && sob.properties.coverage_month === transfer.properties.coverage_month) {
            // Check if amounts match reasonably (within 5%)
            const transferAmount = parseFloat(transfer.properties.amount)
            const sobAmount = parseFloat(sob.properties.amount_to_draft) + parseFloat(sob.properties.fee_amount || 0)
            const difference = Math.abs(transferAmount - sobAmount)
            const percentDiff = (difference / sobAmount) * 100
            
            if (percentDiff <= 5) {
              matches.push({
                transfer,
                sob,
                matchType: "customer_and_amount",
                company: company.properties.name,
              })
              matched = true
              break
            }
          }
        }
      }
    }
    
    // If not matched by customer, try by coverage month and amount
    if (!matched) {
      for (const sob of sobs) {
        if (sob.properties.coverage_month === transfer.properties.coverage_month) {
          const transferAmount = parseFloat(transfer.properties.amount)
          const sobAmount = parseFloat(sob.properties.amount_to_draft) + parseFloat(sob.properties.fee_amount || 0)
          const difference = Math.abs(transferAmount - sobAmount)
          const percentDiff = (difference / sobAmount) * 100
          
          if (percentDiff <= 1) { // Stricter match without customer ID
            matches.push({
              transfer,
              sob,
              matchType: "amount_only",
            })
            matched = true
            break
          }
        }
      }
    }
    
    if (!matched) {
      unmatched.push(transfer)
    }
  }
  
  return { matches, unmatched }
}

async function main() {
  console.log("🔗 Dwolla Transfer to SOB Association Script")
  console.log("============================================")
  
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key in .env.local!")
    process.exit(1)
  }
  
  if (options.dryRun) {
    console.log("🔍 Running in DRY RUN mode - no changes will be made")
  }
  
  console.log(`📊 Configuration:`)
  console.log(`   - Coverage Month: ${options.coverageMonth || "All months"}`)
  console.log(`   - Limit: ${options.limit || "No limit"}`)
  console.log("")
  
  try {
    // Fetch transfers and SOBs
    console.log("📥 Fetching Dwolla Transfers...")
    const transfers = await getTransfersForMonth(options.coverageMonth)
    console.log(`   Found ${transfers.length} unmatched transfers`)
    
    console.log("\n📥 Fetching Summary of Benefits...")
    const sobs = await getSOBsForMonth(options.coverageMonth)
    console.log(`   Found ${sobs.length} SOBs`)
    
    if (transfers.length === 0 || sobs.length === 0) {
      console.log("\n⚠️  No data to process")
      return
    }
    
    // Match transfers to SOBs
    console.log("\n🔍 Matching transfers to SOBs...")
    const { matches, unmatched } = await matchTransfersToSOBs(transfers, sobs)
    
    console.log(`\n📊 Matching Results:`)
    console.log(`   - Matched: ${matches.length}`)
    console.log(`   - Unmatched: ${unmatched.length}`)
    
    // Process matches
    if (matches.length > 0) {
      console.log("\n🔗 Creating associations...")
      
      for (const match of matches) {
        const transferId = match.transfer.id
        const sobId = match.sob.id
        const transferName = match.transfer.properties.dwolla_transfer_id
        
        console.log(`\n  Transfer ${transferName}:`)
        console.log(`    - Match type: ${match.matchType}`)
        if (match.company) {
          console.log(`    - Company: ${match.company}`)
        }
        console.log(`    - SOB ID: ${sobId}`)
        
        // Check if already associated
        const alreadyAssociated = await isTransferAssociatedWithSOB(transferId, sobId)
        
        if (alreadyAssociated) {
          console.log(`    ✓ Already associated`)
          continue
        }
        
        if (options.dryRun) {
          console.log(`    [DRY RUN] Would create association`)
          console.log(`    [DRY RUN] Would update status to "Matched"`)
        } else {
          // Create association
          const assocResult = await associateTransferToSOB(transferId, sobId)
          
          if (assocResult.success) {
            console.log(`    ✅ Association created`)
            
            // Update reconciliation status
            const statusUpdated = await updateTransferStatus(transferId, "Matched")
            if (statusUpdated) {
              console.log(`    ✅ Status updated to "Matched"`)
            } else {
              console.log(`    ⚠️  Failed to update status`)
            }
          } else {
            console.log(`    ❌ Failed to create association:`, assocResult.error)
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }
    
    // Report unmatched transfers
    if (unmatched.length > 0) {
      console.log("\n⚠️  Unmatched Transfers:")
      for (const transfer of unmatched) {
        console.log(`   - ${transfer.properties.dwolla_transfer_id} (${transfer.properties.coverage_month})`)
      }
    }
    
    if (options.dryRun) {
      console.log("\n💡 This was a dry run. Use without --dry-run to apply changes.")
    }
    
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    process.exit(1)
  }
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})