#!/usr/bin/env node

const https = require('https')
const fs = require('fs')
const { PrismaClient } = require('@prisma/client')

// Initialize Prisma client for database access
const prisma = new PrismaClient()

// Configuration
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY || require('./get-env').getEnvVar("HUBSPOT_API_KEY")
const SOB_OBJECT_ID = "2-45680577" // Summary of Benefits object type ID
const POLICY_OBJECT_ID = "2-45586773" // Policies object type ID

if (!HUBSPOT_API_KEY) {
  console.error("❌ HUBSPOT_API_KEY not found")
  process.exit(1)
}

// COMPLETE LIST OF COMPANY IDs (830+ IDs) - Each company may have multiple transfers
const DWOLLA_TRANSFER_IDS = [
  "32305671263", "32307393129", "32319204360", "36311521655", "36959705213",
  "36380875703", "32313867175", "36727767817", "32317562682", "32315699347",
  "32299595645", "32310380204", "35368429417", "32317529364", "32306868114",
  "32300230913", "32312657710", "32319200831", "32282239571", "32290070917",
  "32308089181", "32317355824", "32319214216", "32300230841", "32317519263",
  "32314037349", "32312657712", "32287240338", "32317553304", "32309106802",
  "32296649354", "32316867614", "32300075305", "32319204367", "32319204358",
  "32317553305", "32317352737", "32317553296", "32313873299", "35369053502",
  "32310380197", "32309106803", "32311325469", "32269831716", "35373248085",
  "32319211408", "32296649357", "32317553298", "32305840654", "32309574970",
  "32313447941", "32317352740", "32317515780", "32319214213", "32299119756",
  "32300230837", "32317522727", "32313447950", "32308089184", "32319211397",
  "32311325478", "32313873297", "32308089180", "35373092532", "32317570118",
  "32317559593", "32317522726", "32317362335", "32299119755", "32317186142",
  "32295613952", "32285371270", "32300230916", "32306868110", "32313876595",
  "32319211411", "32317573471", "32309419679", "32307771712", "32307393121",
  "32317358726", "35376831345", "32295613965", "32317546083", "32313873295",
  "32313447865", "32317136778", "32317355828", "32311325472", "32299595650",
  "32317352736", "32317131101", "32317355825", "32309741887", "32319204363",
  "32290070919", "32310380211", "32308243201", "32317519268", "32313879441",
  "32265342544", "32317362334", "32301564451", "32308089193", "32317553290",
  "32295613959", "32281338467", "32307931250", "32309106808", "32309419691",
  "32299595647", "32309419680", "32306528165", "32306528168", "32301564457",
  "32317131108", "32317542808", "32313658499", "32311325477", "32317362326",
  "32282706809", "32313867157", "35370795400", "32303512888", "32309106810",
  "32312657702", "32317362328", "32280252059", "32313447942", "32317566525",
  "32279666310", "32308089185", "32307393123", "32307931247", "32317362324",
  "32317562685", "32309106798", "32313876602", "32309741874", "35377682275",
  "32281338468", "32316719996", "32301564450", "32317559590", "35432413359",
  "32319211403", "32317358731", "32317529367", "32312902495", "32317355830",
  "32314034719", "32305671258", "32316282270", "32305069740", "32317539230",
  "32309106800", "32308243205", "32317549712", "32309106805", "32317562678",
  "32309106806", "32317515786", "32306528167", "32296649355", "32319214218",
  "32317556747", "32319211396", "32317556743", "32283788387", "32317549720",
  "32295613963", "32319214224", "32317553302", "32317358727", "32317525825",
  "32314034720", "32317525818", "32317362333", "32317556752", "32307931243",
  "32312902490", "35363122055", "32317358734", "32317546076", "32317529376",
  "32295613955", "32309260873", "32282239569", "32317519262", "32307393126",
  "32305671262", "32319200825", "32317131105", "32317546087", "32317522733",
  "32317546075", "32301564452", "32317515787", "32300075300", "32317566520",
  "32317522734", "35366627247", "32299119758", "32317525817", "32312902499",
  "32280252057", "32265342541", "32313873305", "32317536374", "32308243125",
  "32299119763", "32308243203", "32313867162", "32307393124", "32317539232",
  "32302103735", "32300075298", "32317131093", "32317566521", "32296649349",
  "32313867158", "32307393125", "32317539224", "32316867618", "35432413462",
  "32317352731", "32312657717", "32317559586", "32312657708", "32287240339",
  "32306684557", "32313658498", "32309574983", "32302103814", "32317186140",
  "32317546078", "32317542807", "32308243122", "32316282265", "32316867620",
  "32313447936", "32309741876", "32311170649", "32312657716", "32316719992",
  "32317522730", "35369712055", "32317562681", "32313876598", "35432415596",
  "32317553303", "32317358737", "32308089186", "32303512896", "32271612168",
  "32307771708", "32280252054", "32269831717", "32317546080", "32317355822",
  "32283788396", "32309419682", "32317559588", "32317546088", "35642516499",
  "32317556753", "32300075301", "32282239561", "32319208118", "32317536375",
  "32312902496", "32305840647", "32317556746", "32317532763", "32312902487",
  "32281338471", "32319211405", "32287240351", "32317553292", "32279666309",
  "32317522729", "32313867168", "32317542814", "32287240347", "35131606074",
  "32317519261", "32317549713", "35138349908", "35134352249", "32317539227",
  "32309106799", "36350859927", "36370789401", "35432410009", "32271612166",
  "32313879430", "32317556739", "32281338469", "32313876605", "32307931250",
  "32306684558", "32299595647", "32317358738", "32313879434", "32302103814",
  "32315699340", "32309419679", "32299595650", "32319211396", "32317549720",
  "32317362327", "32315699348", "32317522731", "32317570118", "32317186140",
  "32317536371", "32317136778", "32317131108", "32313873295", "32316719996",
  "32307393121", "32317131100", "32281338467", "32311325468", "32319211411",
  "32313873297", "32309419690", "32317553298", "32313876601", "32301564455",
  "32316719992", "32317525821", "32307771715", "32317573471", "32296649354",
  "32311325478", "32317525818", "32315699352", "32305671262", "32311325472",
  "32317522728", "32308243121", "32319204360", "32295613955", "32313447936",
  "32317515789", "32265342544", "32317532762", "32319214213", "32317362324",
  "32305671258", "32309741887", "32317525819", "32319211397", "32315699347",
  "32283788390", "32307931243", "32308243122", "32317362333", "32317542805",
  "32311170649", "32290070919", "32317362335", "32319214228", "32317553297",
  "32317529376", "32309106798", "32300230837", "32309574970", "32319204363",
  "32312902490", "32306528168", "32279666310", "32308243202", "32308243205",
  "32313447942", "32301564452", "32311325474", "32319204362", "32319200825",
  "32317556752", "32302103815", "32307393123", "32313447938", "32282239571",
  "32317566521", "32317358734", "32314037346", "32306684557", "32314037349",
  "32290070913", "32283788387", "32313658495", "32317542807", "32319204367",
  "32296649355", "32303512891", "32313867157", "32296649357", "32317519265",
  "32317515786", "32299119763", "32309106810", "32269831716", "32317525825",
  "32302103735", "32313867163", "32295613965", "32317362328", "32310380197",
  "32319214218", "32317131101", "32306528170", "32317562680", "32313879441",
  "32312902499", "32313879424", "32300075297", "32317358727", "32265342543",
  "32317131093", "32305069733", "32317525817", "32317186142", "32308243203",
  "32317352734", "32306868113", "32311325477", "32317515787", "32307393122",
  "32319211403", "32312657719", "32317553304", "32313658499", "32312657710",
  "32319211402", "32317522730", "35368900025", "32282239570", "32319211405",
  "32317358737", "32317525831", "32290070918", "32287240348", "35376831345",
  "32312657704", "35374330162", "32317519255", "35372335772", "32301564457",
  "32313867158", "35365321602", "32305069740", "35210558810", "32269831711",
  "32283788393", "32271612176", "35375563366", "32317536373", "35375838807",
  "32282706811", "35366582380", "32317358726", "35370795400", "35369712056",
  "35373092533", "32281338471", "32311170636", "32282239569", "35157902761",
  "32317546075", "35374794030", "32300075298", "35370475654", "32319214214",
  "32308243125", "32269831710", "32300075305", "32317553303", "32317546088",
  "32317529357", "32306868116", "32317562678", "35373558298", "35366627247",
  "35376947203", "32317549716", "32279666309", "32280252054", "32309741876",
  "35375642778", "32313658498", "32316282265", "32317573465", "32313876600",
  "32316867616", "32283788399", "32307393126", "32310380211", "32312657712",
  "32285371270", "32269831720", "32313447865", "32317556756", "32299119756",
  "35642516499", "32302103734", "32300230841", "32300075300", "35369511848",
  "32307393125", "32295613963", "35371879307", "32311325469", "35376909159",
  "32317553302", "35373092532", "32271612165", "32307393124", "35377063788",
  "32317559593", "32317573475", "32313876598", "32271612168", "35369822076",
  "32317186145", "32317566520", "32314037340", "32312902496", "32316720002",
  "35369712055", "32312657711", "32305840647", "35389042728", "32281338468",
  "32307931246", "32312902487", "32302103813", "35362776857", "35371214209",
  "32282706808", "32296649349", "32317539224", "35370942002", "32317522726",
  "35375260986", "32319214224", "32317556747", "32317525830", "35377720705",
  "35378182177", "32317553289", "32307931245", "32301564450", "35422766408",
  "32287240339", "32315699346", "35370331827", "32282239565", "32317352737",
  "32317529364", "32313876602", "35369053502", "32283788396", "35374483468",
  "35632005266", "32303512883", "35366473541", "32299119760", "32317355825",
  "32319200826", "35376330116", "35197301011", "32305069736", "32307771708",
  "35165471571", "35371879308", "32308089193", "32317355820", "32303512896",
  "32309419682", "35372501391", "32300230916", "32312902492", "32315699345",
  "32317522733", "32282706810", "32306868110", "32317559588", "32317553286",
  "32317562681", "35372947021", "32317536375", "32282706809", "32309260875",
  "32317539230", "35371098466", "32313873305", "35432413547", "32308243201",
  "32301564451", "35390601105", "32317536374", "32299119758", "32317355828",
  "32319204361", "32317355822", "32308089183", "35163205420", "35160415855",
  "32309419680", "32280403844", "35363122055", "32308089180", "32317553290",
  "35362958947", "32317352746", "32317546078", "35139896459", "32309106800",
  "32317515778", "32313447943", "32317559586", "32313447950", "32317559590",
  "32316867618", "32308089184", "32317562685", "32317553305", "32317556753",
  "32313867162", "32282239573", "32317556746", "32319204358", "32299595648",
  "35196063651", "32305840654", "32306528165", "32309419678", "32317532769",
  "35190938800", "32315699344", "32309106806", "32306528166", "32317546080",
  "32287240341", "32317542813", "32287240338", "35367815222", "32299595645",
  "32309741874", "32317352740", "32317566522", "35194670601", "32271612169",
  "32269831715", "32317522734", "32317352743", "35369712138", "35370795403",
  "32317358731", "32317539232", "35390050435", "32309106802", "32309574972",
  "35371098479", "35362958944", "32303512888", "32271612164", "32265342541",
  "32299119759", "35147351604", "35375102850", "32317519262", "35371991149",
  "32319211408", "32307393128", "32269831717", "32316867620", "32317532757",
  "32295613959", "35393194149", "32302103809", "32312657716", "35374794033",
  "35374020536", "32281338466", "32317519269", "32313658494", "32308243204",
  "32309106808", "35378029070", "32296649356", "32280252057", "32309106803",
  "35376177786", "32317553291", "32307931248", "32299119755", "35198717967",
  "32316282270", "32317522727", "32314034719", "35370795405", "32310380205",
  "32302103733", "32317355824", "32308089192", "32317131097", "32317546081",
  "35201101211", "32313873298", "32300230913", "32306868112", "35371098465",
  "35432413462", "32281338465", "32317553296", "32317532763", "32317556743",
  "32282239561", "32307931247", "32312657708", "32280252059", "35368900098",
  "35372947025", "32307931242", "35377565001", "32308089185", "32311170635",
  "32314034720", "32317352736", "32317553287", "32317539223", "32319214216",
  "32317186151", "35186679935", "35387832583", "32313873299", "32312902495",
  "35364671310", "35393042004", "32317519263", "32317355830", "32316867614",
  "35368429417", "32307771718", "35371098468", "35377682275", "32309419691",
  "32319200831", "32317362334", "32306528167", "32302103816", "32309106805",
  "32319208118", "35388888383", "35199182709", "32317131105", "32308089181",
  "35370594830", "35189343807", "35368900024", "32317553292", "32317136781",
  "32290070920", "32316867621", "35432413359", "35432415596", "35369864791",
  "35655594116", "32287240351", "32295613952", "35199027888", "35369558440",
  "32309574983", "35376791574", "32312657717", "32317525823", "32317362326",
  "35375563364", "32317542808", "32317566525", "32317529367", "32317529371",
  "32317186143", "32283788388", "35184891189", "35390601106", "32317519268",
  "32317515780", "32307771712", "32317546076", "35373248085", "32312902498",
  "32317546087", "32310380204", "32317570120", "32317556751", "35157277547",
  "32290070917", "32282239563", "35164303222", "32317549712", "32317546083",
  "35157585211", "32300075301", "32306868108", "32312657702", "32306868114",
  "32317352731", "32313876595", "35365125724", "32309260873", "32299119761",
  "32311325479", "32303512886", "35371098481", "32313873304", "32280252058",
  "35370594832", "32317352738", "35367614328", "32308089186", "32313867168",
  "35138349908", "32307393125", "32317549713", "32317539227", "35134352249", "35131606074"
]

// These are company IDs that may have multiple transfers - we want to process ALL of them
// For testing, we'll process only the first 20 IDs
const allCompanyIds = DWOLLA_TRANSFER_IDS
const companyIds = allCompanyIds.slice(0, 20) // Process only first 20 for testing
console.log(`📊 Total Company IDs available: ${allCompanyIds.length}`)
console.log(`🧪 TESTING: Processing first ${companyIds.length} Company IDs`)
console.log(`📝 To process all IDs, change 'slice(0, 20)' to 'slice(0)' or remove the slice entirely`)

// Cache for carrier mappings to avoid repeated database queries
const carrierMappingsCache = new Map()

// Function to get carrier mapping for a product
async function getCarrierForProduct(productName) {
  try {
    // Check cache first
    if (carrierMappingsCache.has(productName)) {
      return carrierMappingsCache.get(productName)
    }
    
    const mapping = await prisma.carrierMapping.findUnique({
      where: { productName },
      select: { carrierName: true }
    })
    
    const result = mapping?.carrierName || "Unmapped"
    // Cache the result
    carrierMappingsCache.set(productName, result)
    
    return result
  } catch (error) {
    console.error(`Error fetching carrier mapping for ${productName}:`, error.message)
    return "Unmapped"
  }
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

async function getCompanyDetails(companyId) {
  try {
    const options = {
      hostname: "api.hubapi.com",
      path: `/crm/v3/objects/companies/${companyId}?properties=name,domain,phone,industry,description,createdate`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }

    const response = await makeRequest(options)
    if (response.status === 200) {
      return response.data
    }
    return null
  } catch (error) {
    console.error(`Error getting company details for ${companyId}:`, error.message)
    return null
  }
}

async function getCompanySOBs(companyId) {
  try {
    // Get SOB associations
    const sobAssociations = await getAssociations("companies", companyId, SOB_OBJECT_ID)
    if (!sobAssociations.results?.length) {
      return null
    }

    // Get SOB details with double bill flag
    const sobIds = sobAssociations.results.map(a => a.id)
    const sobs = await batchReadObjects(SOB_OBJECT_ID, sobIds, [
      "amount_to_draft", "fee_amount", "double_bill", "coverage_month", "ach_draft_scheduled"
    ])

    // Get policies for each SOB with carrier information
    const policies = []
    for (const sob of sobs.results || []) {
      const policyAssociations = await getAssociations(SOB_OBJECT_ID, sob.id, POLICY_OBJECT_ID)
      if (policyAssociations.results?.length) {
        const policyIds = policyAssociations.results.map(a => a.id)
        const policyObjects = await batchReadObjects(POLICY_OBJECT_ID, policyIds, [
          "policyholder", "product_name", "cost_per_month", "coverage_level", "plan_name"
        ])
        
        // Add carrier information to each policy
        for (const policy of policyObjects.results || []) {
          const productName = policy.properties?.product_name
          if (productName) {
            const carrier = await getCarrierForProduct(productName)
            policy.properties.carrier = carrier
          }
        }
        
        policies.push(...(policyObjects.results || []))
      }
    }

    return {
      sobs: sobs.results || [],
      policies,
      totalPolicies: policies.length
    }
  } catch (error) {
    console.error(`Error getting SOB data for company ${companyId}:`, error.message)
    return null
  }
}

async function getAssociations(fromObjectType, fromObjectId, toObjectType) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const response = await makeRequest(options)
  return response.status === 200 ? response.data : { results: [] }
}

async function batchReadObjects(objectType, objectIds, properties) {
  const options = {
    hostname: "api.hubapi.com",
    path: `/crm/v3/objects/${objectType}/batch/read`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      "Content-Type": "application/json",
    },
  }

  const requestBody = JSON.stringify({
    inputs: objectIds.map(id => ({ id })),
    properties
  })

  const response = await makeRequest(options, requestBody)
  return response.status === 200 ? response.data : { results: [] }
}

async function generatePoliciesReport() {
  console.log("🔍 Generating COMPLETE Comprehensive Policies Report")
  console.log(`📊 Processing ${companyIds.length} Company IDs (each may have multiple transfers)...`)
  console.log("⏰ This will run in the background and may take 30+ minutes...\n")

  const results = []
  const errors = []
  const doubleBillFlags = []
  let processedCount = 0
  
  // Carrier breakdown tracking
  const carrierBreakdown = {
    policyCounts: {},
    totalPolicies: 0,
    unmappedPolicies: 0
  }

  // Process each company ID (which may have multiple transfers)
  for (let i = 0; i < companyIds.length; i++) {
    const transferId = companyIds[i]
    
    try {
      // Get company details
      const company = await getCompanyDetails(transferId)
      if (!company) {
        errors.push({ transferId, error: "Company not found in HubSpot" })
        continue
      }

      // Get SOB and policies for this company
      const sobData = await getCompanySOBs(transferId)
      if (!sobData) {
        errors.push({ 
          transferId, 
          error: "No SOB found for company", 
          company: company.properties.name 
        })
        continue
      }

      const result = {
        transferId,
        company: company.properties,
        sobData
      }

      results.push(result)

      // Track carrier breakdown statistics
      if (sobData.policies) {
        sobData.policies.forEach(policy => {
          const carrier = policy.properties?.carrier || "Unmapped"
          carrierBreakdown.policyCounts[carrier] = (carrierBreakdown.policyCounts[carrier] || 0) + 1
          carrierBreakdown.totalPolicies++
          
          if (carrier === "Unmapped") {
            carrierBreakdown.unmappedPolicies++
          }
        })
      }

      // Check for double bill flags
      const hasDoubleBill = sobData.sobs.some(sob => sob.properties?.double_bill === "Yes")
      if (hasDoubleBill) {
        doubleBillFlags.push({
          transferId,
          companyName: company.properties.name,
          doubleBillSOBs: sobData.sobs.filter(sob => sob.properties?.double_bill === "Yes"),
          policyCount: sobData.totalPolicies
        })
      }

      processedCount++
      
      // Progress update every 50 companies
      if (processedCount % 50 === 0) {
        console.log(`📊 Progress: ${processedCount}/${companyIds.length} companies processed`)
        console.log(`🚨 Double Bills found so far: ${doubleBillFlags.length}`)
        console.log(`🏛️ Total Policies: ${results.reduce((sum, r) => sum + (r.sobData?.totalPolicies || 0), 0)}`)
        
        // Show carrier mapping progress
        const mappedPolicies = Object.entries(carrierBreakdown.policyCounts)
          .filter(([carrier]) => carrier !== "Unmapped")
          .reduce((sum, [, count]) => sum + count, 0)
        const totalPolicies = carrierBreakdown.totalPolicies
        const mappingPercentage = totalPolicies > 0 ? ((mappedPolicies / totalPolicies) * 100).toFixed(1) : "0.0"
        console.log(`🏢 Carrier Mapping: ${mappedPolicies}/${totalPolicies} policies mapped (${mappingPercentage}%)`)
        console.log("")
      }

      // Rate limiting delay
      if (i < companyIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error) {
      console.error(`❌ Error processing transfer ${transferId}:`, error.message)
      errors.push({ transferId, error: error.message })
    }
  }

  // Generate comprehensive report
  console.log("\n📋 COMPLETE POLICIES REPORT FINISHED")
  console.log("=" * 60)
  console.log(`Total Company IDs Processed: ${companyIds.length}`)
  console.log(`Successful: ${results.length}`)
  console.log(`Errors: ${errors.length}`)
  console.log(`🚨 Double Bill Flags Found: ${doubleBillFlags.length}`)
  console.log(`🏛️ Total Policies: ${results.reduce((sum, r) => sum + (r.sobData?.totalPolicies || 0), 0)}`)
  console.log(`📋 Total SOBs: ${results.reduce((sum, r) => sum + (r.sobData?.sobs?.length || 0), 0)}`)
  
  // Display carrier breakdown
  console.log("\n🏢 CARRIER BREAKDOWN:")
  console.log("-" * 40)
  console.log(`Total Policies: ${carrierBreakdown.totalPolicies}`)
  console.log(`Unmapped Policies: ${carrierBreakdown.unmappedPolicies}`)
  console.log(`Mapped Policies: ${carrierBreakdown.totalPolicies - carrierBreakdown.unmappedPolicies}`)
  console.log("")
  
  // Sort carriers by policy count (descending)
  const sortedCarriers = Object.entries(carrierBreakdown.policyCounts)
    .sort(([,a], [,b]) => b - a)
  
  sortedCarriers.forEach(([carrier, count]) => {
    const percentage = ((count / carrierBreakdown.totalPolicies) * 100).toFixed(1)
    const status = carrier === "Unmapped" ? "⚠️ " : "✅ "
    console.log(`${status}${carrier}: ${count} policies (${percentage}%)`)
  })

  if (doubleBillFlags.length > 0) {
    console.log("\n🚨 DOUBLE BILL FLAGS DETECTED:")
    console.log("-" * 50)
    doubleBillFlags.forEach(flag => {
      console.log(`Transfer ID: ${flag.transferId}`)
      console.log(`Company: ${flag.companyName}`)
      console.log(`Policies: ${flag.policyCount}`)
      console.log(`Double Bill SOBs: ${flag.doubleBillSOBs.length}`)
      flag.doubleBillSOBs.forEach(sob => {
        console.log(`  - SOB ID: ${sob.id}, Amount: $${sob.properties?.amount_to_draft || 0}`)
      })
      console.log("")
    })
  }

  // Export detailed results
  const reportData = {
    summary: {
      totalTransfers: companyIds.length,
      successful: results.length,
      errors: errors.length,
      doubleBillCount: doubleBillFlags.length,
      totalPolicies: results.reduce((sum, r) => sum + (r.sobData?.totalPolicies || 0), 0),
      totalSOBs: results.reduce((sum, r) => sum + (r.sobData?.sobs?.length || 0), 0),
      carrierBreakdown: {
        totalPolicies: carrierBreakdown.totalPolicies,
        unmappedPolicies: carrierBreakdown.unmappedPolicies,
        mappedPolicies: carrierBreakdown.totalPolicies - carrierBreakdown.unmappedPolicies,
        byCarrier: carrierBreakdown.policyCounts
      }
    },
    doubleBillFlags,
    results: results.map(r => ({
      transferId: r.transferId,
      companyName: r.company?.name,
      companyDomain: r.company?.domain,
      companyPhone: r.company?.phone,
      companyIndustry: r.company?.industry,
      sobCount: r.sobData?.sobs?.length || 0,
      policyCount: r.sobData?.totalPolicies || 0,
      hasDoubleBill: r.sobData?.sobs?.some(sob => sob.properties?.double_bill === "Yes") || false,
      doubleBillSOBs: r.sobData?.sobs?.filter(sob => sob.properties?.double_bill === "Yes") || [],
      policies: r.sobData?.policies?.map(policy => ({
        id: policy.id,
        policyholder: policy.properties?.policyholder,
        productName: policy.properties?.product_name,
        planName: policy.properties?.plan_name,
        monthlyCost: policy.properties?.cost_per_month,
        coverageLevel: policy.properties?.coverage_level,
        carrier: policy.properties?.carrier
      })) || [],
      sobs: r.sobData?.sobs?.map(sob => ({
        id: sob.id,
        amountToDraft: sob.properties?.amount_to_draft,
        feeAmount: sob.properties?.fee_amount,
        doubleBill: sob.properties?.double_bill,
        coverageMonth: sob.properties?.coverage_month,
        achDraftScheduled: sob.properties?.ach_draft_scheduled
      })) || []
    })),
    errors
  }

  const filename = `complete-policies-report-${new Date().toISOString().split('T')[0]}.json`
  fs.writeFileSync(filename, JSON.stringify(reportData, null, 2))
  console.log(`\n💾 Complete report saved to: ${filename}`)

  // Generate CSV summary
  const csvFilename = `complete-policies-summary-${new Date().toISOString().split('T')[0]}.csv`
  generateCSVSummary(reportData, csvFilename)
  console.log(`📊 CSV summary saved to: ${csvFilename}`)
  
  // Generate carrier breakdown CSV
  const carrierCsvFilename = `carrier-breakdown-${new Date().toISOString().split('T')[0]}.csv`
  generateCarrierBreakdownCSV(reportData.summary.carrierBreakdown, carrierCsvFilename)
  console.log(`🏢 Carrier breakdown CSV saved to: ${carrierCsvFilename}`)

  return reportData
}

function generateCSVSummary(reportData, filename) {
  const headers = [
    "Transfer ID",
    "Company Name", 
    "Company Domain",
    "Company Phone",
    "Company Industry",
    "SOB Count",
    "Policy Count",
    "Double Bill Flag",
    "Double Bill SOB Count",
    "Policy Details"
  ]

  const rows = reportData.results.map(result => {
    // Create policy details string
    const policyDetails = result.policies?.map(policy => 
      `${policy.productName} (${policy.carrier}): $${policy.monthlyCost || 0}/month`
    ).join("; ") || "No policies"
    
    return [
      result.transferId,
      result.companyName || "Unknown",
      result.companyDomain || "N/A",
      result.companyPhone || "N/A",
      result.companyIndustry || "N/A",
      result.sobCount,
      result.policyCount,
      result.hasDoubleBill ? "YES" : "NO",
      result.doubleBillSOBs.length,
      policyDetails
    ]
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  fs.writeFileSync(filename, csvContent)
}

function generateCarrierBreakdownCSV(carrierBreakdown, filename) {
  const headers = [
    "Carrier",
    "Policy Count",
    "Percentage of Total",
    "Status"
  ]

  // Sort carriers by policy count (descending)
  const sortedCarriers = Object.entries(carrierBreakdown.byCarrier)
    .sort(([,a], [,b]) => b - a)

  const rows = sortedCarriers.map(([carrier, count]) => {
    const percentage = ((count / carrierBreakdown.totalPolicies) * 100).toFixed(1)
    const status = carrier === "Unmapped" ? "Unmapped" : "Mapped"
    
    return [
      carrier,
      count,
      `${percentage}%`,
      status
    ]
  })

  // Add summary row
  rows.push([
    "TOTAL",
    carrierBreakdown.totalPolicies,
    "100%",
    "Summary"
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  fs.writeFileSync(filename, csvContent)
}

// Run the report generation
generatePoliciesReport()
  .then(async () => {
    console.log("\n🔌 Disconnecting from database...")
    await prisma.$disconnect()
    console.log("✅ Database connection closed")
  })
  .catch(async (error) => {
    console.error("❌ Report generation failed:", error)
    await prisma.$disconnect()
    process.exit(1)
  })
