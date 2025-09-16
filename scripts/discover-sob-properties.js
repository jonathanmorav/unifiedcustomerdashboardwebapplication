#!/usr/bin/env node

const https = require('https')
const fs = require('fs')
const path = require('path')

// Configuration
const SOB_OBJECT_ID = "2-45680577" // Summary of Benefits object type ID

// Read environment variables from .env.local
function getEnvVar(name) {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
      console.error("❌ .env.local file not found")
      console.error("Please create .env.local with your HubSpot API key:")
      console.error("HUBSPOT_API_KEY=your-api-key-here")
      process.exit(1)
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
    return match ? match[1] : null
  } catch (error) {
    console.error("❌ Error reading .env.local:", error.message)
    process.exit(1)
  }
}

const HUBSPOT_API_KEY = getEnvVar("HUBSPOT_API_KEY")

if (!HUBSPOT_API_KEY) {
  console.error("❌ HUBSPOT_API_KEY not found in .env.local")
  console.error("Please add HUBSPOT_API_KEY=your-api-key-here to .env.local")
  process.exit(1)
}

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = ''
      
      res.on('data', (chunk) => {
        responseData += chunk
      })
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData)
          resolve({
            status: res.statusCode,
            data: parsed
          })
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: responseData
          })
        }
      })
    })

    req.on("error", reject)
    if (data) req.write(data)
    req.end()
  })
}

async function getSOBSchema() {
  console.log("🔍 Getting SOB object schema to discover all properties...\n")

  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/schemas/${SOB_OBJECT_ID}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)
    
    if (response.status === 200) {
      const schema = response.data
      console.log("✅ SOB Object Schema Retrieved:")
      console.log(`   Object Type: ${schema.name}`)
      console.log(`   Object ID: ${schema.objectTypeId}`)
      console.log(`   Labels: ${schema.labels?.singular} / ${schema.labels?.plural}`)
      console.log("")
      
      // Display all properties
      if (schema.properties) {
        console.log("📋 All Available Properties:")
        console.log("   " + "=".repeat(80))
        
        Object.entries(schema.properties).forEach(([propertyName, property]) => {
          const type = property.type || "unknown"
          const label = property.label || "No Label"
          const group = property.groupName || "No Group"
          const required = property.required ? "REQUIRED" : "optional"
          const readOnly = property.readOnlyValue ? "READ-ONLY" : "editable"
          
          console.log(`   ${propertyName.padEnd(30)} | ${type.padEnd(15)} | ${label.padEnd(25)} | ${group.padEnd(20)} | ${required.padEnd(10)} | ${readOnly}`)
        })
        
        console.log("   " + "=".repeat(80))
        console.log("")
        
        // Look for double draft related properties
        console.log("🔍 Searching for Double Draft Related Properties:")
        const doubleDraftProps = Object.entries(schema.properties).filter(([name, prop]) => {
          const nameLower = name.toLowerCase()
          const labelLower = (prop.label || "").toLowerCase()
          return nameLower.includes("double") || 
                 nameLower.includes("draft") || 
                 nameLower.includes("flag") ||
                 labelLower.includes("double") || 
                 labelLower.includes("draft") || 
                 labelLower.includes("flag")
        })
        
        if (doubleDraftProps.length > 0) {
          console.log("   ✅ Found potential double draft properties:")
          doubleDraftProps.forEach(([name, prop]) => {
            console.log(`      - ${name}: ${prop.label} (${prop.type})`)
          })
        } else {
          console.log("   ❌ No obvious double draft properties found")
        }
        
        // Look for boolean/flag properties
        console.log("\n🔍 Boolean/Flag Properties (potential flags):")
        const booleanProps = Object.entries(schema.properties).filter(([name, prop]) => {
          return prop.type === "bool" || prop.type === "boolean" || prop.type === "enumeration"
        })
        
        if (booleanProps.length > 0) {
          booleanProps.forEach(([name, prop]) => {
            console.log(`      - ${name}: ${prop.label} (${prop.type})`)
            if (prop.type === "enumeration" && prop.options) {
              console.log(`        Options: ${prop.options.map(opt => opt.label).join(", ")}`)
            }
          })
        } else {
          console.log("   ❌ No boolean/flag properties found")
        }
        
      } else {
        console.log("❌ No properties found in schema")
      }
      
    } else {
      console.error(`❌ Failed to get SOB schema (${response.status})`)
      console.error("Response:", response.data)
    }
  } catch (error) {
    console.error("❌ Error getting SOB schema:", error.message)
  }
}

async function getSampleSOBData() {
  console.log("\n📊 Getting sample SOB data to see actual property values...\n")
  
  // First get a sample SOB ID
  const searchOptions = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${SOB_OBJECT_ID}/search`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }
  
  const searchBody = JSON.stringify({
    filterGroups: [],
    properties: ["hs_object_id"], // Just get ID first
    limit: 1,
  })
  
  try {
    const searchResponse = await makeRequest(searchOptions, searchBody)
    
    if (searchResponse.status === 200 && searchResponse.data.results?.length > 0) {
      const sampleSOBId = searchResponse.data.results[0].id
      console.log(`✅ Found sample SOB ID: ${sampleSOBId}`)
      
      // Now get all properties for this SOB
      const getOptions = {
        hostname: "api.hubapi.com",
        path: `/crm/v3/objects/${SOB_OBJECT_ID}/${sampleSOBId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
      
      const getResponse = await makeRequest(getOptions)
      
      if (getResponse.status === 200) {
        const sob = getResponse.data
        console.log("\n📝 Sample SOB Data:")
        console.log(`   ID: ${sob.id}`)
        console.log(`   Created: ${sob.createdAt}`)
        console.log(`   Updated: ${sob.updatedAt}`)
        console.log("")
        
        if (sob.properties) {
          console.log("   Property Values:")
          Object.entries(sob.properties).forEach(([name, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              console.log(`      ${name}: ${value}`)
            }
          })
        }
      } else {
        console.error(`❌ Failed to get SOB data (${getResponse.status})`)
      }
    } else {
      console.log("❌ No SOBs found to sample")
    }
  } catch (error) {
    console.error("❌ Error getting sample SOB data:", error.message)
  }
}

async function main() {
  console.log("🔍 HubSpot SOB Properties Discovery Tool\n")
  console.log("This tool will discover all available properties in the SOB custom object")
  console.log("to help identify if there are double draft flags or related properties.\n")
  
  await getSOBSchema()
  await getSampleSOBData()
  
  console.log("\n✨ Discovery complete!")
  console.log("Check the output above for any properties that might indicate double draft scenarios.")
}

main().catch(console.error)
