#!/usr/bin/env node

/**
 * Check Company Properties Script
 * Lists available properties on HubSpot companies
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

async function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = ""

      res.on("data", (chunk) => {
        responseData += chunk
      })

      res.on("end", () => {
        try {
          const response = JSON.parse(responseData)
          resolve({ status: res.statusCode, data: response })
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData })
        }
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.end()
  })
}

async function getCompanyProperties() {
  console.log("🔍 Fetching HubSpot company properties...")

  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/properties/companies",
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)

    if (response.status === 200) {
      console.log("✅ Retrieved company properties")

      // Filter for email-related properties
      const emailProperties = response.data.results.filter(
        (prop) =>
          prop.name.toLowerCase().includes("email") || prop.label.toLowerCase().includes("email")
      )

      console.log("\n📧 Email-related properties:")
      emailProperties.forEach((prop) => {
        console.log(`   - Name: ${prop.name}`)
        console.log(`     Label: ${prop.label}`)
        console.log(`     Type: ${prop.type}`)
        console.log(`     Description: ${prop.description || "N/A"}`)
        console.log("")
      })

      // Look for owner properties
      const ownerProperties = response.data.results.filter(
        (prop) =>
          prop.name.toLowerCase().includes("owner") || prop.label.toLowerCase().includes("owner")
      )

      console.log("👤 Owner-related properties:")
      ownerProperties.forEach((prop) => {
        console.log(`   - Name: ${prop.name}`)
        console.log(`     Label: ${prop.label}`)
        console.log(`     Type: ${prop.type}`)
        console.log(`     Description: ${prop.description || "N/A"}`)
        console.log("")
      })

      // Look for dwolla properties
      const dwollaProperties = response.data.results.filter((prop) =>
        prop.name.toLowerCase().includes("dwolla")
      )

      console.log("💳 Dwolla-related properties:")
      dwollaProperties.forEach((prop) => {
        console.log(`   - Name: ${prop.name}`)
        console.log(`     Label: ${prop.label}`)
        console.log(`     Type: ${prop.type}`)
        console.log(`     Description: ${prop.description || "N/A"}`)
        console.log("")
      })

      // Show total count
      console.log(`📊 Total properties: ${response.data.results.length}`)
    } else {
      console.error(`❌ Failed to fetch properties (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Error fetching properties:", error.message)
  }
}

async function testBasicCompanySearch() {
  console.log("\n🔍 Testing basic company search...")

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
    properties: ["name", "domain", "hs_object_id", "hubspot_owner_id"],
    limit: 3,
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
    const response = await makeRequest(options)

    if (response.status === 200) {
      console.log(`📋 Found ${response.data.results?.length || 0} companies`)

      if (response.data.results?.length > 0) {
        console.log("\n📝 Sample companies:")
        response.data.results.forEach((company, index) => {
          console.log(`   ${index + 1}. ID: ${company.id}`)
          console.log(`      Name: ${company.properties?.name || "N/A"}`)
          console.log(`      Domain: ${company.properties?.domain || "N/A"}`)
          console.log(`      Owner ID: ${company.properties?.hubspot_owner_id || "N/A"}`)
          console.log("")
        })
      }
    } else {
      console.error(`❌ Search failed (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Search error:", error.message)
  }
}

async function main() {
  console.log("🧪 HubSpot Company Properties Checker\n")

  // Check if API key is provided
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key!")
    console.error("Make sure HUBSPOT_API_KEY is set in .env.local")
    process.exit(1)
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...\n`)

  try {
    await getCompanyProperties()
    await testBasicCompanySearch()

    console.log("\n🎉 Property check completed!")
    console.log("\n💡 Use the correct property names shown above for email searches")
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    process.exit(1)
  }
}

// Run the script
main()
