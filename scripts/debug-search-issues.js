#!/usr/bin/env node

/**
 * Debug Script for Search Issues
 * Tests HubSpot email search and SOB association issues
 */

const https = require("https")
const fs = require("fs")
const path = require("path")

// Read .env.local file directly
const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

// Parse environment variables
function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
  return match ? match[1] : null
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = ""

      res.on("data", (chunk) => {
        responseData += chunk
      })

      res.on("end", () => {
        try {
          const response = JSON.parse(responseData)
          resolve({ status: res.statusCode, data: response, headers: res.headers })
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData, headers: res.headers })
        }
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    if (data) {
      req.write(data)
    }

    req.end()
  })
}

async function testEmailSearch() {
  console.log("🔍 Testing Email Search...")

  // Test with a known email that should exist
  const searchData = JSON.stringify({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email___owner",
            operator: "EQ",
            value: "support@acme.com", // Using the mock data email
          },
        ],
      },
    ],
    properties: ["name", "domain", "email___owner", "dwolla_customer_id", "hs_object_id"],
    limit: 10,
  })

  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/objects/companies/search",
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options, searchData)
    console.log(`📊 Email Search Status: ${response.status}`)

    if (response.status === 200) {
      console.log("✅ Email search working!")
      console.log(`📋 Found ${response.data.results?.length || 0} companies`)

      if (response.data.results?.length > 0) {
        const company = response.data.results[0]
        console.log("📝 First result:")
        console.log(`   - ID: ${company.id}`)
        console.log(`   - Name: ${company.properties?.name || "N/A"}`)
        console.log(`   - Owner Email: ${company.properties?.email___owner || "N/A"}`)
        console.log(`   - Dwolla ID: ${company.properties?.dwolla_customer_id || "N/A"}`)

        // Test SOB associations for this company
        await testSOBAssociations(company.id)
      } else {
        console.log("⚠️  No companies found with that email. Trying alternate search...")
        await testAlternateEmailSearch()
      }
    } else {
      console.error(`❌ Email search failed (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Email search error:", error.message)
  }
}

async function testAlternateEmailSearch() {
  console.log("🔄 Testing with any email domain...")

  // Search for any companies with email addresses
  const searchData = JSON.stringify({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email___owner",
            operator: "HAS_PROPERTY",
            value: "",
          },
        ],
      },
    ],
    properties: ["name", "domain", "email___owner", "dwolla_customer_id", "hs_object_id"],
    limit: 5,
  })

  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/objects/companies/search",
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options, searchData)
    console.log(`📊 Alternate Search Status: ${response.status}`)

    if (response.status === 200) {
      console.log(`📋 Found ${response.data.results?.length || 0} companies with emails`)

      if (response.data.results?.length > 0) {
        const company = response.data.results[0]
        console.log("📝 Sample company with email:")
        console.log(`   - ID: ${company.id}`)
        console.log(`   - Name: ${company.properties?.name || "N/A"}`)
        console.log(`   - Owner Email: ${company.properties?.email___owner || "N/A"}`)
        console.log(`   - Dwolla ID: ${company.properties?.dwolla_customer_id || "N/A"}`)

        // Test SOB associations for this company
        await testSOBAssociations(company.id)
      }
    } else {
      console.error(`❌ Alternate search failed (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Alternate search error:", error.message)
  }
}

async function testSOBAssociations(companyId) {
  console.log(`\n📊 Testing SOB associations for company ${companyId}...`)

  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/companies/${companyId}/associations/summary_of_benefits`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)
    console.log(`📊 SOB Association Status: ${response.status}`)

    if (response.status === 200) {
      console.log(`📋 Found ${response.data.results?.length || 0} SOB associations`)

      if (response.data.results?.length > 0) {
        console.log("✅ SOB associations working!")
        console.log("📝 SOB IDs:")
        response.data.results.forEach((assoc, index) => {
          console.log(`   ${index + 1}. ID: ${assoc.id}, Type: ${assoc.type}`)
        })

        // Test fetching actual SOB data
        await testSOBDataFetch(response.data.results.map((a) => a.id))
      } else {
        console.log("⚠️  No SOB associations found for this company")
        await testDirectSOBSearch()
      }
    } else {
      console.error(`❌ SOB association failed (${response.status})`)
      console.error("Response:", response.data)

      // Try different object type names
      await testAlternateSOBAssociations(companyId)
    }
  } catch (error) {
    console.error("❌ SOB association error:", error.message)
  }
}

async function testAlternateSOBAssociations(companyId) {
  console.log("🔄 Testing alternate SOB object type names...")

  const alternateNames = [
    "2-134825309", // Numeric object type ID
    "summary_of_benefit", // Singular form
    "134825309", // Just the numeric part
  ]

  for (const objectType of alternateNames) {
    console.log(`   Testing: ${objectType}`)

    const options = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/companies/${companyId}/associations/${objectType}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }

    try {
      const response = await makeRequest(options)
      if (response.status === 200 && response.data.results?.length > 0) {
        console.log(
          `✅ Found ${response.data.results.length} associations with object type: ${objectType}`
        )
        return // Success, stop trying
      }
    } catch (error) {
      // Continue with next attempt
    }
  }

  console.log("❌ No alternate SOB object types worked")
}

async function testSOBDataFetch(sobIds) {
  console.log(`\n📊 Testing SOB data fetch for ${sobIds.length} SOBs...`)

  const requestData = JSON.stringify({
    inputs: sobIds.map((id) => ({ id })),
    properties: ["amount_to_draft", "fee_amount", "pdf_document_url", "hs_object_id"],
  })

  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/objects/summary_of_benefits/batch/read",
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options, requestData)
    console.log(`📊 SOB Data Fetch Status: ${response.status}`)

    if (response.status === 200) {
      console.log(`✅ Retrieved ${response.data.results?.length || 0} SOB records`)

      if (response.data.results?.length > 0) {
        const firstSOB = response.data.results[0]
        console.log("📝 First SOB sample:")
        console.log(`   - ID: ${firstSOB.id}`)
        console.log(`   - Amount to Draft: ${firstSOB.properties?.amount_to_draft || "N/A"}`)
        console.log(`   - Fee Amount: ${firstSOB.properties?.fee_amount || "N/A"}`)
        console.log(`   - PDF URL: ${firstSOB.properties?.pdf_document_url ? "Present" : "N/A"}`)
      }
    } else {
      console.error(`❌ SOB data fetch failed (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ SOB data fetch error:", error.message)
  }
}

async function testDirectSOBSearch() {
  console.log("\n🔄 Testing direct SOB search...")

  const searchData = JSON.stringify({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "createdate",
            operator: "GTE",
            value: "2020-01-01",
          },
        ],
      },
    ],
    properties: ["amount_to_draft", "fee_amount", "pdf_document_url", "hs_object_id"],
    limit: 5,
  })

  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/objects/summary_of_benefits/search",
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options, searchData)
    console.log(`📊 Direct SOB Search Status: ${response.status}`)

    if (response.status === 200) {
      console.log(`📋 Found ${response.data.results?.length || 0} SOB records directly`)

      if (response.data.results?.length > 0) {
        console.log("✅ Direct SOB search working!")
        const firstSOB = response.data.results[0]
        console.log("📝 First SOB:")
        console.log(`   - ID: ${firstSOB.id}`)
        console.log(`   - Amount to Draft: ${firstSOB.properties?.amount_to_draft || "N/A"}`)
      }
    } else {
      console.error(`❌ Direct SOB search failed (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Direct SOB search error:", error.message)
  }
}

async function testDwollaPanel() {
  console.log("\n🔄 Testing Dwolla panel update issue...")
  console.log("⚠️  This requires checking the UI behavior - placeholder test might be interfering")
  console.log("💡 Recommendation: Check if DEMO_MODE is enabled or mock data is being used")
}

async function main() {
  console.log("🧪 Debug Script: Search Issues\n")

  // Check if API key is provided
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key!")
    console.error("Make sure HUBSPOT_API_KEY is set in .env.local")
    process.exit(1)
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...\n`)

  try {
    await testEmailSearch()
    await testDwollaPanel()

    console.log("\n🎉 Debug tests completed!")
    console.log("\n📝 Summary of identified issues:")
    console.log("1. Email search may be looking for wrong property or non-existent emails")
    console.log("2. SOB associations might need correct object type identifier")
    console.log("3. Mock data may be interfering with Dwolla panel updates")
    console.log("\n💡 Check the logs above for specific error details")
  } catch (error) {
    console.error("\n💥 Debug script failed:", error.message)
    process.exit(1)
  }
}

// Run the debug script
main()
