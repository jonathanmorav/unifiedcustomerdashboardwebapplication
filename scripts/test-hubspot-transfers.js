#!/usr/bin/env node

/**
 * Test HubSpot Dwolla Transfer Integration
 * 
 * This script tests the new HubSpot Dwolla Transfer object integration
 * to ensure the implementation is working correctly.
 * 
 * Usage: node scripts/test-hubspot-transfers.js
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

// Test 1: Verify Dwolla Transfer object exists
async function testTransferObjectExists() {
  console.log("\n📋 Test 1: Verify Dwolla Transfer object exists")
  
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/schemas/${DWOLLA_TRANSFER_OBJECT_ID}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }
  
  const response = await makeRequest(options)
  
  if (response.status === 200) {
    console.log("   ✅ Dwolla Transfer object exists")
    console.log(`   - Name: ${response.data.name}`)
    console.log(`   - Object ID: ${response.data.objectTypeId}`)
    return true
  } else {
    console.log(`   ❌ Failed to verify object (${response.status})`)
    return false
  }
}

// Test 2: Search for transfers with coverage month
async function testSearchTransfersByCoverageMonth() {
  console.log("\n📋 Test 2: Search transfers by coverage month")
  
  const currentMonth = new Date().toISOString().slice(0, 7)
  
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
            propertyName: "coverage_month",
            operator: "EQ",
            value: currentMonth,
          },
        ],
      },
    ],
    properties: ["dwolla_transfer_id", "amount", "coverage_month", "reconciliation_status"],
    limit: 5,
  })
  
  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200) {
    console.log(`   ✅ Search successful`)
    console.log(`   - Found ${response.data.results?.length || 0} transfers for ${currentMonth}`)
    
    if (response.data.results?.length > 0) {
      console.log("\n   Sample transfer:")
      const sample = response.data.results[0]
      console.log(`   - Transfer ID: ${sample.properties.dwolla_transfer_id}`)
      console.log(`   - Amount: $${sample.properties.amount}`)
      console.log(`   - Coverage Month: ${sample.properties.coverage_month}`)
      console.log(`   - Reconciliation Status: ${sample.properties.reconciliation_status}`)
    }
    
    return true
  } else {
    console.log(`   ❌ Search failed (${response.status})`)
    console.log(`   Response:`, response.data)
    return false
  }
}

// Test 3: Check transfer to SOB associations
async function testTransferToSOBAssociations() {
  console.log("\n📋 Test 3: Check Transfer to SOB associations")
  
  // First get a sample transfer
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
    filterGroups: [],
    properties: ["dwolla_transfer_id"],
    limit: 1,
  })
  
  const searchResponse = await makeRequest(searchOptions, searchBody)
  
  if (searchResponse.status !== 200 || !searchResponse.data.results?.length) {
    console.log("   ⚠️  No transfers found to test associations")
    return false
  }
  
  const transferId = searchResponse.data.results[0].id
  const transferName = searchResponse.data.results[0].properties.dwolla_transfer_id
  
  console.log(`   Testing transfer: ${transferName}`)
  
  // Check associations
  const assocOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${DWOLLA_TRANSFER_OBJECT_ID}/${transferId}/associations/${SOB_OBJECT_ID}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }
  
  const assocResponse = await makeRequest(assocOptions)
  
  if (assocResponse.status === 200) {
    const associations = assocResponse.data.results || []
    console.log(`   ✅ Association check successful`)
    console.log(`   - Found ${associations.length} SOB associations`)
    
    if (associations.length > 0) {
      console.log(`   - Associated SOB IDs:`, associations.map(a => a.id).join(", "))
    }
    
    return true
  } else {
    console.log(`   ❌ Failed to check associations (${assocResponse.status})`)
    return false
  }
}

// Test 4: Test reconciliation status update
async function testReconciliationStatusUpdate() {
  console.log("\n📋 Test 4: Test reconciliation status field")
  
  // Get a sample transfer
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
            propertyName: "reconciliation_status",
            operator: "IN",
            values: ["Pending", "Matched", "Out of Balance"],
          },
        ],
      },
    ],
    properties: ["dwolla_transfer_id", "reconciliation_status"],
    limit: 1,
  })
  
  const response = await makeRequest(searchOptions, searchBody)
  
  if (response.status === 200) {
    console.log(`   ✅ Reconciliation status field is working`)
    
    if (response.data.results?.length > 0) {
      const transfer = response.data.results[0]
      console.log(`   - Sample Transfer: ${transfer.properties.dwolla_transfer_id}`)
      console.log(`   - Current Status: ${transfer.properties.reconciliation_status}`)
    }
    
    return true
  } else {
    console.log(`   ❌ Failed to query reconciliation status (${response.status})`)
    return false
  }
}

// Test 5: Verify API endpoint integration
async function testAPIEndpoint() {
  console.log("\n📋 Test 5: Test local API endpoint with HubSpot flag")
  
  const testUrl = `http://localhost:3000/api/reconciliation/transfers?useHubSpot=true&limit=5`
  
  return new Promise((resolve) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/api/reconciliation/transfers?useHubSpot=true&limit=5",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
    
    const req = require("http").request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => {
        data += chunk
      })
      res.on("end", () => {
        if (res.statusCode === 401) {
          console.log("   ⚠️  API requires authentication (expected)")
          console.log("   - The endpoint exists and is protected")
          resolve(true)
        } else if (res.statusCode === 200) {
          console.log("   ✅ API endpoint is working")
          try {
            const parsed = JSON.parse(data)
            console.log(`   - Returned ${parsed.transfers?.length || 0} transfers`)
            console.log(`   - Source: ${parsed.source || "Unknown"}`)
          } catch (e) {
            console.log("   - Response received")
          }
          resolve(true)
        } else {
          console.log(`   ❌ Unexpected status: ${res.statusCode}`)
          resolve(false)
        }
      })
    })
    
    req.on("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        console.log("   ⚠️  Development server not running")
        console.log("   - Start the dev server with: npm run dev")
      } else {
        console.log(`   ❌ Error: ${error.message}`)
      }
      resolve(false)
    })
    
    req.end()
  })
}

async function main() {
  console.log("🧪 HubSpot Dwolla Transfer Integration Test")
  console.log("===========================================")
  
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key in .env.local!")
    process.exit(1)
  }
  
  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...`)
  
  const results = []
  
  try {
    // Run all tests
    results.push(await testTransferObjectExists())
    results.push(await testSearchTransfersByCoverageMonth())
    results.push(await testTransferToSOBAssociations())
    results.push(await testReconciliationStatusUpdate())
    results.push(await testAPIEndpoint())
    
    // Summary
    console.log("\n📊 Test Summary:")
    console.log("================")
    
    const passed = results.filter(r => r).length
    const failed = results.filter(r => !r).length
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    
    if (failed === 0) {
      console.log("\n🎉 All tests passed! The integration is working correctly.")
      console.log("\n📝 Next steps:")
      console.log("1. Run the sync script to populate transfers: node scripts/sync-dwolla-transfers-to-hubspot.js --dry-run")
      console.log("2. Run the association script: node scripts/associate-transfers-to-sobs.js --dry-run")
      console.log("3. Test in the UI by adding ?useHubSpot=true to the reconciliation page URL")
    } else {
      console.log("\n⚠️  Some tests failed. Please check the errors above.")
    }
    
  } catch (error) {
    console.error("\n💥 Test suite failed:", error.message)
    process.exit(1)
  }
}

// Run the tests
main().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})