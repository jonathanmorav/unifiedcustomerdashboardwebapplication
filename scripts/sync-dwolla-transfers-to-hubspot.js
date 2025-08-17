#!/usr/bin/env node

/**
 * Sync Dwolla Transfers to HubSpot
 * 
 * This script syncs ACHTransaction records from the local database
 * to HubSpot Dwolla Transfer objects (Object ID: 45362259)
 * 
 * Usage: node scripts/sync-dwolla-transfers-to-hubspot.js [options]
 * 
 * Options:
 *   --dry-run     Preview changes without making API calls
 *   --limit N     Process only N transfers (default: all)
 *   --from DATE   Sync transfers from this date (YYYY-MM-DD)
 *   --to DATE     Sync transfers until this date (YYYY-MM-DD)
 */

const https = require("https")
const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
  return match ? match[1] : null
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")
const DWOLLA_TRANSFER_OBJECT_ID = "45362259"

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  dryRun: args.includes("--dry-run"),
  limit: null,
  fromDate: null,
  toDate: null,
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--limit" && args[i + 1]) {
    options.limit = parseInt(args[i + 1])
  }
  if (args[i] === "--from" && args[i + 1]) {
    options.fromDate = new Date(args[i + 1])
  }
  if (args[i] === "--to" && args[i + 1]) {
    options.toDate = new Date(args[i + 1])
  }
}

const prisma = new PrismaClient()

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

// Search for existing transfer in HubSpot
async function findExistingTransfer(dwollaTransferId) {
  const searchOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/search`,
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
            propertyName: "dwolla_transfer_id",
            operator: "EQ",
            value: dwollaTransferId,
          },
        ],
      },
    ],
    properties: ["dwolla_transfer_id", "hs_object_id"],
    limit: 1,
  })

  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200 && response.data.results?.length > 0) {
    return response.data.results[0]
  }
  
  return null
}

// Create or update transfer in HubSpot
async function syncTransferToHubSpot(transaction) {
  const existingTransfer = await findExistingTransfer(transaction.dwollaId)
  
  // Calculate coverage month from created date or scheduled date
  const coverageMonth = new Date(transaction.created).toISOString().slice(0, 7)
  
  // Map transaction fields to HubSpot properties
  const properties = {
    dwolla_transfer_id: transaction.dwollaId,
    dwolla_customer_id: transaction.customerId || "",
    amount: parseFloat(transaction.amount.toString()),
    fee_amount: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
    is_credit: transaction.direction === "credit" ? "Yes" : "No",
    transfer_status: mapStatusToHubSpot(transaction.status),
    date_initiated: new Date(transaction.created).toISOString(),
    coverage_month: coverageMonth,
    reconciliation_status: "Pending", // Default to pending for new transfers
  }
  
  // Add optional fields if present
  if (transaction.achReturnCode) {
    properties.failure_reason = `ACH Return Code: ${transaction.achReturnCode} - ${transaction.achReturnReason || ""}`
  }
  
  if (transaction.correlationId) {
    properties.invoice_reference = transaction.correlationId
  }
  
  if (existingTransfer) {
    // Update existing transfer
    console.log(`Updating transfer ${transaction.dwollaId}...`)
    
    if (options.dryRun) {
      console.log("  [DRY RUN] Would update with properties:", properties)
      return { success: true, action: "update", id: existingTransfer.id }
    }
    
    const updateOptions = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/${existingTransfer.id}`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
    
    const response = await makeRequest(updateOptions, JSON.stringify({ properties }))
    
    if (response.status === 200) {
      return { success: true, action: "update", id: existingTransfer.id }
    } else {
      console.error(`  Failed to update: ${response.status}`, response.data)
      return { success: false, action: "update", error: response.data }
    }
  } else {
    // Create new transfer
    console.log(`Creating transfer ${transaction.dwollaId}...`)
    
    if (options.dryRun) {
      console.log("  [DRY RUN] Would create with properties:", properties)
      return { success: true, action: "create", id: "dry-run" }
    }
    
    const createOptions = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
    
    const response = await makeRequest(createOptions, JSON.stringify({ properties }))
    
    if (response.status === 201) {
      return { success: true, action: "create", id: response.data.id }
    } else {
      console.error(`  Failed to create: ${response.status}`, response.data)
      return { success: false, action: "create", error: response.data }
    }
  }
}

// Map local status to HubSpot enum values
function mapStatusToHubSpot(status) {
  const statusMap = {
    processed: "Processed",
    pending: "Pending",
    processing: "Processing",
    failed: "Failed",
    cancelled: "Cancelled",
  }
  
  return statusMap[status.toLowerCase()] || "Pending"
}

async function main() {
  console.log("🔄 Dwolla Transfer Sync to HubSpot")
  console.log("===================================")
  
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key in .env.local!")
    process.exit(1)
  }
  
  if (options.dryRun) {
    console.log("🔍 Running in DRY RUN mode - no changes will be made")
  }
  
  console.log(`📊 Configuration:`)
  console.log(`   - Limit: ${options.limit || "No limit"}`)
  console.log(`   - From Date: ${options.fromDate || "No start date"}`)
  console.log(`   - To Date: ${options.toDate || "No end date"}`)
  console.log("")
  
  try {
    // Build query filters
    const where = {
      direction: "credit", // Only sync customer-initiated transfers
    }
    
    if (options.fromDate || options.toDate) {
      where.created = {}
      if (options.fromDate) {
        where.created.gte = options.fromDate
      }
      if (options.toDate) {
        where.created.lte = options.toDate
      }
    }
    
    // Fetch transactions from database
    const transactions = await prisma.aCHTransaction.findMany({
      where,
      take: options.limit || undefined,
      orderBy: { created: "desc" },
    })
    
    console.log(`📥 Found ${transactions.length} transfers to sync\n`)
    
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
    }
    
    // Process each transaction
    for (const transaction of transactions) {
      try {
        const result = await syncTransferToHubSpot(transaction)
        
        if (result.success) {
          if (result.action === "create") {
            results.created++
            console.log(`  ✅ Created (HubSpot ID: ${result.id})`)
          } else {
            results.updated++
            console.log(`  ✅ Updated (HubSpot ID: ${result.id})`)
          }
        } else {
          results.failed++
        }
        
        // Add delay to avoid rate limiting
        if (!options.dryRun) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        results.failed++
        console.error(`  ❌ Error processing ${transaction.dwollaId}:`, error.message)
      }
    }
    
    // Print summary
    console.log("\n📊 Sync Summary:")
    console.log(`   - Created: ${results.created}`)
    console.log(`   - Updated: ${results.updated}`)
    console.log(`   - Failed: ${results.failed}`)
    console.log(`   - Total: ${transactions.length}`)
    
    if (options.dryRun) {
      console.log("\n💡 This was a dry run. Use without --dry-run to apply changes.")
    }
    
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})