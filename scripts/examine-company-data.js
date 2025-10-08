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

async function examineCompanyData() {
  console.log("🔍 Examining Company Data in HubSpot...")
  
  // Get a sample of companies to examine their actual properties
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/companies?properties=name,domain,phone,industry,description,createdate&limit=20`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  try {
    const response = await makeRequest(options)
    if (response.status === 200 && response.data.results?.length > 0) {
      console.log(`✅ Found ${response.data.results.length} companies to examine`)
      
      // Examine the first few companies in detail
      for (let i = 0; i < Math.min(5, response.data.results.length); i++) {
        const company = response.data.results[i]
        console.log(`\n📋 Company ${i + 1}: ${company.properties.name || 'Unnamed'}`)
        console.log(`ID: ${company.id}`)
        console.log(`Created: ${company.properties.createdate || 'Unknown'}`)
        console.log(`Domain: ${company.properties.domain || 'N/A'}`)
        console.log(`Phone: ${company.properties.phone || 'N/A'}`)
        console.log(`Industry: ${company.properties.industry || 'N/A'}`)
        console.log(`Description: ${company.properties.description || 'N/A'}`)
        
        // Get all properties for this company
        console.log("\n🔍 Getting all properties for this company...")
        const propertiesResponse = await makeRequest({
          hostname: "api.hubapi.com",
          path: `/crm/v3/objects/companies/${company.id}`,
          method: "GET",
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
        })
        
        if (propertiesResponse.status === 200) {
          const allProperties = propertiesResponse.data.properties
          console.log(`📊 Company has ${Object.keys(allProperties).length} properties:`)
          
          // Look for any properties that might contain transfer IDs or payment information
          const relevantProps = Object.entries(allProperties).filter(([key, value]) => {
            if (!value) return false
            const strValue = String(value).toLowerCase()
            return strValue.includes('transfer') || 
                   strValue.includes('payment') || 
                   strValue.includes('ach') || 
                   strValue.includes('bank') ||
                   strValue.includes('account') ||
                   strValue.includes('customer') ||
                   strValue.includes('id') ||
                   strValue.includes('number')
          })
          
          if (relevantProps.length > 0) {
            console.log("🎯 Potentially relevant properties:")
            relevantProps.forEach(([key, value]) => {
              console.log(`  - ${key}: ${value}`)
            })
          }
          
          // Show a few random properties to get a sense of what's available
          const randomProps = Object.entries(allProperties)
            .filter(([key, value]) => value && key !== 'name' && key !== 'createdate')
            .slice(0, 10)
          
          console.log("\n📋 Sample of other properties:")
          randomProps.forEach(([key, value]) => {
            console.log(`  - ${key}: ${value}`)
          })
        }
        
        console.log("\n" + "=".repeat(60))
        
        // Rate limiting delay
        if (i < Math.min(5, response.data.results.length) - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      // Now let's check if there are any custom properties that might contain transfer IDs
      console.log("\n🔍 Checking for custom properties that might contain transfer IDs...")
      const customPropsResponse = await makeRequest({
        hostname: "api.hubapi.com",
        path: `/crm/v3/properties/companies`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      })
      
      if (customPropsResponse.status === 200) {
        const customProps = customPropsResponse.data.results || []
        const transferRelatedProps = customProps.filter(prop => 
          prop.name.toLowerCase().includes('transfer') || 
          prop.name.toLowerCase().includes('payment') || 
          prop.name.toLowerCase().includes('ach') || 
          prop.name.toLowerCase().includes('bank') ||
          prop.name.toLowerCase().includes('account') ||
          prop.name.toLowerCase().includes('customer') ||
          prop.name.toLowerCase().includes('id') ||
          prop.name.toLowerCase().includes('number') ||
          prop.name.toLowerCase().includes('dwolla')
        )
        
        if (transferRelatedProps.length > 0) {
          console.log("\n🎯 Transfer/Payment related custom properties:")
          transferRelatedProps.forEach(prop => {
            console.log(`  - ${prop.name} (${prop.type}) - ${prop.label}`)
            console.log(`    Group: ${prop.groupName}, Field Type: ${prop.fieldType}`)
          })
        } else {
          console.log("\n❌ No transfer/payment related custom properties found")
        }
      }
      
    } else {
      console.log("❌ No companies found or error in response")
    }
  } catch (error) {
    console.error("Error examining company data:", error.message)
  }
}

// Run the examination
examineCompanyData().catch(console.error)
