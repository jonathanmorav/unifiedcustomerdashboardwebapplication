#!/usr/bin/env node

const https = require('https')

// Configuration
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY || require('./get-env').getEnvVar("HUBSPOT_API_KEY")

if (!HUBSPOT_API_KEY) {
  console.error("❌ HUBSPOT_API_KEY not found")
  process.exit(1)
}

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => responseData += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData)
          resolve({ status: res.statusCode, data: parsed })
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

async function exploreCompanyProperties() {
  console.log("🔍 Exploring HubSpot Company Properties...")
  
  // First, get a few companies to see what properties are available
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/companies?properties=name&limit=5`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)
    if (response.status === 200 && response.data.results?.length > 0) {
      console.log(`✅ Found ${response.data.results.length} companies`)
      
      // Get the first company to explore its properties
      const firstCompany = response.data.results[0]
      console.log("\n📋 First Company Details:")
      console.log(`ID: ${firstCompany.id}`)
      console.log(`Name: ${firstCompany.properties.name}`)
      console.log(`Properties:`, JSON.stringify(firstCompany.properties, null, 2))
      
      // Now get all available properties for companies
      console.log("\n🔍 Getting all available company properties...")
      const propertiesResponse = await makeRequest({
        hostname: "api.hubapi.com",
        path: `/crm/v3/properties/companies`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      })
      
      if (propertiesResponse.status === 200) {
        console.log(`\n📊 Found ${propertiesResponse.data.results?.length || 0} company properties:`)
        propertiesResponse.data.results?.forEach(prop => {
          console.log(`- ${prop.name} (${prop.type}) - ${prop.label}`)
        })
        
        // Look for properties that might contain Dwolla information
        const dwollaRelatedProps = propertiesResponse.data.results?.filter(prop => 
          prop.name.toLowerCase().includes('dwolla') || 
          prop.name.toLowerCase().includes('transfer') ||
          prop.name.toLowerCase().includes('ach') ||
          prop.name.toLowerCase().includes('payment')
        )
        
        if (dwollaRelatedProps?.length > 0) {
          console.log("\n🎯 Potential Dwolla-related properties:")
          dwollaRelatedProps.forEach(prop => {
            console.log(`- ${prop.name} (${prop.type}) - ${prop.label}`)
          })
        }
      }
    }
  } catch (error) {
    console.error("Error exploring companies:", error.message)
  }
}

// Run the exploration
exploreCompanyProperties().catch(console.error)
