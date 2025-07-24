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

async function testSOBBatchRead() {
  console.log("🧪 Testing SOB batch read with different object type identifiers...\n")

  // First get a sample SOB ID from associations
  const companyId = "32302103813" // From the logs
  console.log(`📡 Getting SOB associations for company ${companyId}...`)

  const assocOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/companies/${companyId}/associations/2-45680577`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const assocResponse = await makeRequest(assocOptions)

    if (assocResponse.status !== 200 || !assocResponse.data.results?.length) {
      console.log("❌ No SOB associations found, cannot test batch read")
      return
    }

    const sobId = assocResponse.data.results[0].id
    console.log(`✅ Found SOB ID: ${sobId}\n`)

    // Now test batch read with different object type identifiers
    const objectTypes = ["summary_of_benefits", "2-45680577", "45680577"]

    for (const objectType of objectTypes) {
      console.log(`🧪 Testing batch read with object type: ${objectType}`)

      const requestData = JSON.stringify({
        inputs: [{ id: sobId }],
        properties: ["amount_to_draft", "fee_amount", "pdf_document_url", "hs_object_id"],
      })

      const options = {
        hostname: "api.hubapi.com",
        path: `/crm/v3/objects/${objectType}/batch/read`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }

      try {
        const response = await makeRequest(options, requestData)
        console.log(`   Status: ${response.status}`)

        if (response.status === 200) {
          console.log(`   ✅ SUCCESS! Retrieved ${response.data.results?.length || 0} SOB records`)
          if (response.data.results?.length > 0) {
            const firstSOB = response.data.results[0]
            console.log(`   📝 Sample data:`)
            console.log(`      - ID: ${firstSOB.id}`)
            console.log(`      - Amount to Draft: ${firstSOB.properties?.amount_to_draft || "N/A"}`)
            console.log(`      - Fee Amount: ${firstSOB.properties?.fee_amount || "N/A"}`)
            console.log(
              `      - PDF URL: ${firstSOB.properties?.pdf_document_url ? "Present" : "N/A"}`
            )
          }
          console.log(`   🎯 WORKING OBJECT TYPE: ${objectType}`)
        } else {
          console.log(`   Response:`, response.data)
        }
      } catch (error) {
        console.log(`   Error: ${error.message}`)
      }
      console.log("")
    }
  } catch (error) {
    console.error("❌ Error:", error.message)
  }
}

async function main() {
  console.log("🧪 SOB Batch Read Tester\n")

  if (!HUBSPOT_API_KEY) {
    console.error("❌ Missing HubSpot API key!")
    process.exit(1)
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...\n`)

  try {
    await testSOBBatchRead()
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    process.exit(1)
  }
}

main()
