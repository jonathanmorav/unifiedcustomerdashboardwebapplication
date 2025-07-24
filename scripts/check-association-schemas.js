#!/usr/bin/env node

/**
 * Check HubSpot Association Schemas
 * Tests what object types are available for associations
 */

const https = require("https")
const fs = require("fs")
const path = require("path")

// Read .env.local file directly
const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf8")

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
          resolve({ status: res.statusCode, data: JSON.parse(responseData) })
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData })
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}

async function checkAssociationSchemas() {
  console.log("🔍 Checking HubSpot association schemas...\n")

  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/associations/definitions",
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)

    if (response.status === 200) {
      console.log("✅ Association schemas retrieved")
      console.log(`📊 Found ${response.data.results?.length || 0} association types\n`)

      // Look for Summary of Benefits related associations
      const sobAssociations = response.data.results.filter(
        (assoc) => assoc.fromObjectTypeId === "companies" || assoc.toObjectTypeId === "companies"
      )

      console.log("🏢 Company-related associations:")
      sobAssociations.forEach((assoc) => {
        console.log(`   - From: ${assoc.fromObjectTypeId} → To: ${assoc.toObjectTypeId}`)
        console.log(`     Type: ${assoc.name || "N/A"}`)
        console.log("")
      })
    } else {
      console.error(`❌ Failed to get association schemas (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Error:", error.message)
  }
}

async function testCompanyAssociation(companyId) {
  console.log(`\n🧪 Testing company ${companyId} associations...\n`)

  // Try different approaches
  const approaches = [
    {
      name: "summary_of_benefits",
      path: `/crm/v3/objects/companies/${companyId}/associations/summary_of_benefits`,
    },
    {
      name: "2-134825309",
      path: `/crm/v3/objects/companies/${companyId}/associations/2-134825309`,
    },
    { name: "list all", path: `/crm/v3/objects/companies/${companyId}/associations` },
  ]

  for (const approach of approaches) {
    console.log(`📡 Testing: ${approach.name}`)

    const options = {
      hostname: "api.hubapi.com",
      path: approach.path,
      method: "GET",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }

    try {
      const response = await makeRequest(options)
      console.log(`   Status: ${response.status}`)

      if (response.status === 200) {
        if (approach.name === "list all") {
          console.log("   Available associations:")
          Object.keys(response.data).forEach((key) => {
            console.log(`     - ${key}: ${response.data[key]?.results?.length || 0} items`)
          })
        } else {
          console.log(`   Results: ${response.data.results?.length || 0} associations`)
          if (response.data.results?.length > 0) {
            console.log("   ✅ This approach works!")
            return approach
          }
        }
      } else if (response.status !== 404) {
        console.log("   Response:", response.data)
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`)
    }
    console.log("")
  }

  return null
}

async function main() {
  console.log("🧪 HubSpot Association Schema Checker\n")

  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key!")
    process.exit(1)
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...\n`)

  try {
    await checkAssociationSchemas()

    // Test with a real company ID from the logs
    const testCompanyId = "32313879424" // From the logs above
    const workingApproach = await testCompanyAssociation(testCompanyId)

    if (workingApproach) {
      console.log(`\n🎉 Found working approach: ${workingApproach.name}`)
      console.log("💡 Update your code to use this object type identifier")
    } else {
      console.log("\n⚠️  No working approaches found")
      console.log("💡 Check if Summary of Benefits objects are properly associated with companies")
    }
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    process.exit(1)
  }
}

main()
