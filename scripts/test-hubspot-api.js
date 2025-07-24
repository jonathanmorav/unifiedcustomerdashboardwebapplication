#!/usr/bin/env node

/**
 * HubSpot API Test Script
 * Tests the HubSpot API connection and permissions
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

async function testHubSpotAPI() {
  console.log("🧪 Testing HubSpot API Connection\n")

  // Check if API key is provided
  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key!")
    console.error("Make sure HUBSPOT_API_KEY is set in .env.local")
    process.exit(1)
  }

  if (HUBSPOT_API_KEY.includes("[REPLACE")) {
    console.error("❌ Placeholder API key detected!")
    console.error(
      "Please replace [REPLACE_WITH_YOUR_HUBSPOT_API_KEY] with your actual HubSpot API key"
    )
    process.exit(1)
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...`)
  console.log(`🌐 API URL: https://api.hubapi.com\n`)

  // Test 1: Basic API access
  console.log("📡 Testing basic API access...")
  await testAPIAccess()

  // Test 2: Companies endpoint
  console.log("\n📡 Testing companies endpoint...")
  await testCompaniesEndpoint()

  // Test 3: Custom objects
  console.log("\n📡 Testing custom objects...")
  await testCustomObjects()
}

async function testAPIAccess() {
  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/objects/companies?limit=1",
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ""

      res.on("data", (chunk) => {
        data += chunk
      })

      res.on("end", () => {
        console.log(`📊 Response Status: ${res.statusCode}`)

        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data)
            console.log("✅ Basic API access successful!")
            console.log(`📋 Found ${response.results?.length || 0} companies`)
            resolve(response)
          } catch (error) {
            console.error("❌ Error parsing response:", error.message)
            reject(error)
          }
        } else {
          console.error(`❌ API call failed (${res.statusCode})`)
          console.error("Response:", data)

          switch (res.statusCode) {
            case 401:
              console.error("\n🔍 Possible issues:")
              console.error("- Invalid API key")
              console.error("- API key expired or revoked")
              break
            case 403:
              console.error("\n🔍 Possible issues:")
              console.error("- Missing required scopes")
              console.error("- Need: crm.objects.companies.read")
              break
            case 429:
              console.error("\n🔍 Possible issues:")
              console.error("- Rate limit exceeded")
              console.error("- Too many requests")
              break
            default:
              console.error("\n🔍 Check HubSpot API status")
          }

          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on("error", (error) => {
      console.error("❌ Network Error:", error.message)
      reject(error)
    })

    req.end()
  })
}

async function testCompaniesEndpoint() {
  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/objects/companies/search",
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

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
    properties: ["name", "domain", "hs_object_id"],
    limit: 5,
  })

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ""

      res.on("data", (chunk) => {
        data += chunk
      })

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data)
            console.log("✅ Companies search successful!")
            console.log(`📋 Found ${response.results?.length || 0} companies`)

            if (response.results?.length > 0) {
              console.log("📝 Sample company:")
              const company = response.results[0]
              console.log(`   - ID: ${company.id}`)
              console.log(`   - Name: ${company.properties?.name || "N/A"}`)
              console.log(`   - Domain: ${company.properties?.domain || "N/A"}`)
            }

            resolve(response)
          } catch (error) {
            console.error("❌ Error parsing response:", error.message)
            reject(error)
          }
        } else {
          console.error(`❌ Companies search failed (${res.statusCode})`)
          console.error("Response:", data)
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on("error", (error) => {
      console.error("❌ Network Error:", error.message)
      reject(error)
    })

    req.write(searchData)
    req.end()
  })
}

async function testCustomObjects() {
  // First, try to list schemas
  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/schemas",
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ""

      res.on("data", (chunk) => {
        data += chunk
      })

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data)
            console.log("✅ Custom objects schema access successful!")

            const customObjects =
              response.results?.filter(
                (schema) => !["companies", "contacts", "deals", "tickets"].includes(schema.name)
              ) || []

            console.log(`📋 Found ${customObjects.length} custom objects:`)
            customObjects.forEach((obj) => {
              console.log(`   - ${obj.name} (${obj.labels?.singular || "N/A"})`)
            })

            // Check for Summary of Benefits
            const sobObject = customObjects.find(
              (obj) =>
                obj.name.toLowerCase().includes("summary") ||
                obj.name.toLowerCase().includes("benefit")
            )

            if (sobObject) {
              console.log(`✅ Found potential Summary of Benefits object: ${sobObject.name}`)
            } else {
              console.log('⚠️  No "Summary of Benefits" custom object found')
              console.log("   You may need to create this in HubSpot or check the name")
            }

            resolve(response)
          } catch (error) {
            console.error("❌ Error parsing response:", error.message)
            reject(error)
          }
        } else {
          console.error(`❌ Custom objects access failed (${res.statusCode})`)
          console.error("Response:", data)

          if (res.statusCode === 403) {
            console.error("\n🔍 Missing scope: crm.schemas.custom.read")
            console.error("   Add this scope to your HubSpot Private App")
          }

          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on("error", (error) => {
      console.error("❌ Network Error:", error.message)
      reject(error)
    })

    req.end()
  })
}

// Run the test
testHubSpotAPI()
  .then(() => {
    console.log("\n🎉 HubSpot API tests completed!")
    console.log("\n📝 Next steps:")
    console.log("1. If all tests passed, your HubSpot integration should work")
    console.log("2. Try searching again in your dashboard")
    console.log("3. Check for any missing custom objects or scopes")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n💥 HubSpot API test failed:", error.message)
    console.log("\n🔧 Troubleshooting:")
    console.log("1. Double-check your HubSpot API key")
    console.log("2. Verify scopes in your Private App:")
    console.log("   - crm.objects.companies.read")
    console.log("   - crm.objects.custom.read")
    console.log("   - crm.schemas.custom.read")
    console.log("3. Check if your HubSpot app is active")
    process.exit(1)
  })
