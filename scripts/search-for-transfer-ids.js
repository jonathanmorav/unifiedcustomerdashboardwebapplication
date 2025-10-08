#!/usr/bin/env node

const https = require('https')

// Configuration
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY || require('./get-env').getEnvVar("HUBSPOT_API_KEY")

if (!HUBSPOT_API_KEY) {
  console.error("❌ HUBSPOT_API_KEY not found")
  process.exit(1)
}

// Sample of your Dwolla Transfer IDs to search for
const SAMPLE_TRANSFER_IDS = [
  "36311521655", "36959705213", "36380875703", "32313867175", "36727767817"
]

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

async function searchForTransferIds() {
  console.log("🔍 Searching for Dwolla Transfer IDs in HubSpot objects...")
  
  // First, let's check what custom objects exist
  console.log("\n📋 Checking available custom objects...")
  const customObjectsResponse = await makeRequest({
    hostname: "api.hubapi.com",
    path: `/crm/v3/schemas`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  })
  
  if (customObjectsResponse.status === 200) {
    const schemas = customObjectsResponse.data.results || []
    console.log(`✅ Found ${schemas.length} custom objects:`)
    
    schemas.forEach(schema => {
      console.log(`- ${schema.name} (${schema.objectTypeId})`)
    })
    
    // Look for objects that might contain transfer information
    const transferRelatedObjects = schemas.filter(schema => 
      schema.name.toLowerCase().includes('transfer') || 
      schema.name.toLowerCase().includes('payment') || 
      schema.name.toLowerCase().includes('ach') || 
      schema.name.toLowerCase().includes('bank') ||
      schema.name.toLowerCase().includes('account') ||
      schema.name.toLowerCase().includes('transaction') ||
      schema.name.toLowerCase().includes('dwolla')
    )
    
    if (transferRelatedObjects.length > 0) {
      console.log("\n🎯 Potentially transfer-related objects:")
      transferRelatedObjects.forEach(obj => {
        console.log(`- ${obj.name} (${obj.objectTypeId})`)
      })
    }
  }
  
  // Now let's search for the transfer IDs in different object types
  console.log("\n🔍 Searching for transfer IDs in different object types...")
  
  for (const transferId of SAMPLE_TRANSFER_IDS) {
    console.log(`\n🔍 Searching for transfer ID: ${transferId}`)
    
    // Search in companies
    console.log("  - Searching in companies...")
    const companySearch = await searchObjects("companies", transferId)
    if (companySearch.length > 0) {
      console.log(`    ✅ Found in companies: ${companySearch.length} matches`)
      companySearch.forEach(company => {
        console.log(`      - ${company.properties.name || 'Unnamed'} (ID: ${company.id})`)
      })
    }
    
    // Search in SOB objects
    console.log("  - Searching in Summary of Benefits...")
    const sobSearch = await searchObjects("2-45680577", transferId)
    if (sobSearch.length > 0) {
      console.log(`    ✅ Found in SOBs: ${sobSearch.length} matches`)
      sobSearch.forEach(sob => {
        console.log(`      - SOB ID: ${sob.id}, Amount: $${sob.properties?.amount_to_draft || 0}`)
      })
    }
    
    // Search in policies
    console.log("  - Searching in policies...")
    const policySearch = await searchObjects("2-45586773", transferId)
    if (policySearch.length > 0) {
      console.log(`    ✅ Found in policies: ${policySearch.length} matches`)
      policySearch.forEach(policy => {
        console.log(`      - Policy ID: ${policy.id}, Holder: ${policy.properties?.policyholder || 'Unknown'}`)
      })
    }
    
    // Search in contacts
    console.log("  - Searching in contacts...")
    const contactSearch = await searchObjects("contacts", transferId)
    if (contactSearch.length > 0) {
      console.log(`    ✅ Found in contacts: ${contactSearch.length} matches`)
      contactSearch.forEach(contact => {
        console.log(`      - ${contact.properties.firstname || ''} ${contact.properties.lastname || ''} (ID: ${contact.id})`)
      })
    }
    
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Let's also check if there are any properties in SOB objects that might contain transfer IDs
  console.log("\n🔍 Checking SOB properties for transfer-related fields...")
  const sobPropertiesResponse = await makeRequest({
    hostname: "api.hubapi.com",
    path: `/crm/v3/properties/2-45680577`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  })
  
  if (sobPropertiesResponse.status === 200) {
    const sobProps = sobPropertiesResponse.data.results || []
    const transferRelatedProps = sobProps.filter(prop => 
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
      console.log("\n🎯 Transfer-related properties in SOB objects:")
      transferRelatedProps.forEach(prop => {
        console.log(`  - ${prop.name} (${prop.type}) - ${prop.label}`)
        console.log(`    Group: ${prop.groupName}, Field Type: ${prop.fieldType}`)
      })
    } else {
      console.log("\n❌ No transfer-related properties found in SOB objects")
    }
  }
}

async function searchObjects(objectType, searchTerm) {
  try {
    const options = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/${objectType}/search`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }

    const searchBody = JSON.stringify({
      filterGroups: [{
        filters: [{
          propertyName: "hs_object_id", // Search in all properties by using object ID
          operator: "CONTAINS_TOKEN",
          value: searchTerm
        }]
      }],
      properties: ["name", "firstname", "lastname", "amount_to_draft", "policyholder"],
      limit: 5
    })

    const response = await makeRequest(options, searchBody)
    if (response.status === 200 && response.data.results?.length > 0) {
      return response.data.results
    }
    return []
  } catch (error) {
    console.error(`    ❌ Error searching ${objectType}:`, error.message)
    return []
  }
}

// Run the search
searchForTransferIds().catch(console.error)
