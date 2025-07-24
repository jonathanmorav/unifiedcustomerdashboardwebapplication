#!/usr/bin/env node

/**
 * Test script to verify onboarding fields are being fetched from HubSpot API
 */

const https = require("https")

const fs = require("fs")
const path = require("path")

// Read .env.local file directly
const envPath = path.join(__dirname, ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

// Parse environment variables
function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
  return match ? match[1] : null
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")
const API_URL = "https://api.hubapi.com"

if (!HUBSPOT_API_KEY) {
  console.error("❌ HUBSPOT_API_KEY environment variable is not set")
  process.exit(1)
}

console.log("🧪 Testing HubSpot Onboarding Fields\n")

async function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => (data += chunk))
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data)
          resolve({ status: res.statusCode, data: parsed })
        } catch (e) {
          resolve({ status: res.statusCode, data })
        }
      })
    })

    req.on("error", reject)
    req.end()
  })
}

async function testOnboardingFields() {
  try {
    // First, get a list of companies
    console.log("🔍 Fetching companies...")
    const options = {
      hostname: "api.hubapi.com",
      path: "/crm/v3/objects/companies?limit=5&properties=name,domain,dwolla_customer_id,onboarding_status,onboarding_step",
      method: "GET",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }

    const companiesResponse = await makeRequest(options)

    if (companiesResponse.status !== 200) {
      console.error(
        "❌ Failed to fetch companies:",
        companiesResponse.status,
        companiesResponse.data
      )
      return
    }

    console.log("✅ Successfully fetched companies")
    const companies = companiesResponse.data.results || []
    console.log(`📊 Found ${companies.length} companies\n`)

    if (companies.length === 0) {
      console.log("ℹ️  No companies found to test with")
      return
    }

    // Test each company for onboarding fields
    companies.forEach((company, index) => {
      console.log(`🏢 Company ${index + 1}:`)
      console.log(`   - ID: ${company.id}`)
      console.log(`   - Name: ${company.properties?.name || "N/A"}`)
      console.log(`   - Domain: ${company.properties?.domain || "N/A"}`)
      console.log(`   - Dwolla ID: ${company.properties?.dwolla_customer_id || "N/A"}`)
      console.log(`   - Onboarding Status: ${company.properties?.onboarding_status || "N/A"}`)
      console.log(`   - Onboarding Step: ${company.properties?.onboarding_step || "N/A"}`)
      console.log("")
    })

    // Check if any company has onboarding fields populated
    const hasOnboardingStatus = companies.some((c) => c.properties?.onboarding_status)
    const hasOnboardingStep = companies.some((c) => c.properties?.onboarding_step)

    console.log("📈 Field Analysis:")
    console.log(
      `   - Companies with onboarding_status: ${companies.filter((c) => c.properties?.onboarding_status).length}`
    )
    console.log(
      `   - Companies with onboarding_step: ${companies.filter((c) => c.properties?.onboarding_step).length}`
    )

    if (!hasOnboardingStatus && !hasOnboardingStep) {
      console.log("\n⚠️  Note: No companies have onboarding fields populated yet.")
      console.log(
        "   This is expected if the custom properties haven't been created in HubSpot yet."
      )
      console.log("   The API integration is working correctly though!")
    } else {
      console.log("\n✅ Great! Some companies have onboarding fields populated.")
    }
  } catch (error) {
    console.error("❌ Error during testing:", error.message)
  }
}

testOnboardingFields()
