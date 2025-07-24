#!/usr/bin/env node

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

async function makeRequest(options, data = null) {
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
    if (data) req.write(data)
    req.end()
  })
}

async function getSOBObjectInfo() {
  console.log("🔍 Getting Summary of Benefits object information...\n")

  // First get all custom objects
  const options = {
    hostname: "api.hubapi.com",
    path: "/crm/v3/schemas",
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)

    if (response.status === 200) {
      const sobObject = response.data.results.find(
        (schema) =>
          schema.name === "summary_of_benefits" ||
          schema.labels?.singular?.toLowerCase().includes("benefit")
      )

      if (sobObject) {
        console.log("✅ Found Summary of Benefits object:")
        console.log(`   Name: ${sobObject.name}`)
        console.log(`   Object Type ID: ${sobObject.objectTypeId}`)
        console.log(`   Labels: ${sobObject.labels?.singular} / ${sobObject.labels?.plural}`)
        console.log(`   ID: ${sobObject.id}`)
        console.log("")

        // Now test associations with the correct object type ID
        await testAssociationWithObjectTypeId("32313879424", sobObject.objectTypeId)
        await testAssociationWithObjectTypeId("32313879424", sobObject.name)
        await testAssociationWithObjectTypeId("32313879424", sobObject.id)
      } else {
        console.log("❌ Summary of Benefits object not found")

        console.log("\n📋 Available custom objects:")
        response.data.results
          .filter((schema) => !["companies", "contacts", "deals", "tickets"].includes(schema.name))
          .forEach((schema) => {
            console.log(
              `   - ${schema.name} (${schema.labels?.singular}) - ID: ${schema.objectTypeId || schema.id}`
            )
          })
      }
    } else {
      console.error(`❌ Failed to get schemas (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Error:", error.message)
  }
}

async function testAssociationWithObjectTypeId(companyId, objectTypeId) {
  console.log(`🧪 Testing association with object type: ${objectTypeId}`)

  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/companies/${companyId}/associations/${objectTypeId}`,
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
      console.log(`   ✅ SUCCESS! Found ${response.data.results?.length || 0} associations`)
      if (response.data.results?.length > 0) {
        console.log(
          "   Sample association IDs:",
          response.data.results.slice(0, 3).map((r) => r.id)
        )
        return objectTypeId
      }
    } else if (response.status !== 404) {
      console.log("   Response:", response.data)
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`)
  }
  console.log("")
  return null
}

async function main() {
  console.log("🧪 HubSpot SOB Object Type Finder\n")

  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key!")
    process.exit(1)
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...\n`)

  try {
    await getSOBObjectInfo()
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    process.exit(1)
  }
}

main()
