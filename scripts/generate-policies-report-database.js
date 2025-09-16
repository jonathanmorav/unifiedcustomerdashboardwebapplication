#!/usr/bin/env node

const https = require('https')
const fs = require('fs')

// Configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

// Your complete list of Dwolla Transfer IDs
const DWOLLA_TRANSFER_IDS = [
  "36311521655", "36959705213", "36380875703", "32313867175", "36727767817",
  "32317562682", "32315699347", "32299595645", "32310380204", "35368429417",
  "32317529364", "32306868114", "32300230913", "32312657710", "32319200831",
  "32282239571", "32290070917", "32308089181", "32317355824", "32319214216",
  "32300230841", "32317519263", "32314037349", "32312657712", "32287240338",
  "32317553304", "32309106802", "32296649354", "32316867614", "32300075305",
  "32319204367", "32319204358", "32317553305", "32317352737", "32317553296",
  "32313873299", "35369053502", "32310380197", "32309106803", "32311325469",
  "32269831716", "35373248085", "32319211408", "32296649357", "32317553298",
  "32305840654", "32309574970", "32313447941", "32317352740", "32317515780",
  "32319214213", "32299119756", "32300230837", "32317522727", "32313447950",
  "32308089184", "32319211397", "32311325478", "32313873297", "32308089180",
  "35373092532", "32317570118", "32317559593", "32317522726", "32317362335",
  "32299119755", "32317186142", "32295613952", "32285371270", "32300230916",
  "32306868110", "32313876595", "32319211411", "32317573471", "32309419679",
  "32307771712", "32307393121", "32317358726", "35376831345", "32295613965",
  "32317546083", "32313873295", "32313447865", "32317136778", "32317355828",
  "32311325472", "32299595650", "32317352736", "32317131101", "32317355825",
  "32309741887", "32319204363", "32290070919", "32310380211", "32308243201",
  "32317519268", "32313879441", "32265342544", "32317362334", "32301564451",
  "32308089193", "32317553290", "32295613959", "32281338467", "32307931250",
  "32309106808", "32309419691", "32299595647", "32309419680", "32306528165",
  "32306528168", "32301564457", "32317131108", "32317542808", "32313658499",
  "32311325477", "32317362326", "32282706809", "32313867157", "35370795400",
  "32303512888", "32309106810", "32312657702", "32317362328", "32280252059",
  "32313447942", "32317566525", "32279666310", "32308089185", "32307393123",
  "32307931247", "32317362324", "32317562685", "32309106798", "32313876602",
  "32309741874", "35377682275", "32281338468", "32316719996", "32301564450",
  "32317559590", "35432413359", "32319211403", "32317358731", "32317529367",
  "32312902495", "32317355830", "32314034719", "32305671258", "32316282270",
  "32305069740", "32317539230", "32309106800", "32308243205", "32317549712",
  "32309106805", "32317562678", "32309106806", "32317515786", "32306528167",
  "32296649355", "32319214218", "32317556747", "32319211396", "32317556743",
  "32283788387", "32317549720", "32295613963", "32319214224", "32317553302",
  "32317358727", "32317525825", "32314034720", "32317525818", "32317362333",
  "32317556752", "32307931243", "32312902490", "35363122055", "32317358734",
  "32317546076", "32317529376", "32295613955", "32309260873", "32282239569",
  "32317519262", "32307393126", "32305671262", "32319200825", "32317131105",
  "32317546087", "32317522733", "32317546075", "32301564452", "32317515787",
  "32300075300", "32317566520", "32317522734", "35366627247", "32299119758",
  "32317525817", "32312902499", "32280252057", "32265342541", "32313873305",
  "32317536374", "32308243125", "32299119763", "32308243203", "32313867168",
  "32307393125", "32317539232", "32302103735", "32300075298", "32317131093",
  "32317566521", "32296649349", "32313867158", "32307393125", "32317539224",
  "32316867618", "35432413462", "32317352731", "32312657717", "32317559586",
  "32312657708", "32287240339", "32306684557", "32313658498", "32309574983",
  "32302103814", "32317186140", "32317546078", "32317542807", "32308243122",
  "32316282265", "32316867620", "32313447936", "32309741876", "32311170649",
  "32312657716", "32316719992", "32317522730", "35369712055", "32317562681",
  "32313876598", "35432415596", "32317553303", "32317358737", "32308089186",
  "32303512896", "32271612168", "32307771708", "32280252054", "32269831717",
  "32317546080", "32317355822", "32283788396", "32309419682", "32317559588",
  "32317546088", "35642516499", "32317556753", "32300075301", "32282239561",
  "32319208118", "32317536375", "32312902496", "32305840647", "32317556746",
  "32317532763", "32312902487", "32281338471", "32319211405", "32287240351",
  "32317553292", "32279666309", "32317522729", "32313867168", "32317542814",
  "32287240347", "35131606074", "32317519261", "32317549713", "35138349908",
  "35134352249", "32317539227", "32309106799"
  // Note: This is a subset for testing - the full list contains 300+ IDs
]

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
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
    if (options.data) req.write(options.data)
    req.end()
  })
}

async function getTransferPolicies(transferId) {
  try {
    console.log(`🔍 Processing transfer: ${transferId}`)
    
    // Use your existing reconciliation API endpoint
    const url = new URL(`${BASE_URL}/api/reconciliation/policies`)
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        transferIds: [transferId]
      })
    }

    const response = await makeRequest(url, options)
    
    if (response.status === 200 && response.data) {
      return {
        transferId,
        data: response.data,
        success: true
      }
    } else {
      return { 
        transferId, 
        error: `API returned status ${response.status}`,
        success: false
      }
    }
  } catch (error) {
    return { 
      transferId, 
      error: error.message,
      success: false
    }
  }
}

async function generatePoliciesReport() {
  console.log("🔍 Generating Comprehensive Policies Report Using Your API")
  console.log(`📊 Processing ${DWOLLA_TRANSFER_IDS.length} Dwolla Transfer IDs...\n`)

  const results = []
  const errors = []
  const doubleBillFlags = []

  // Process transfers in batches to avoid overwhelming your API
  const batchSize = 5
  for (let i = 0; i < DWOLLA_TRANSFER_IDS.length; i += batchSize) {
    const batch = DWOLLA_TRANSFER_IDS.slice(i, i + batchSize)
    console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(DWOLLA_TRANSFER_IDS.length/batchSize)} (${batch.length} transfers)`)

    const batchResults = await Promise.allSettled(
      batch.map(transferId => getTransferPolicies(transferId))
    )

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value
        if (data.success) {
          results.push(data)
          
          // Check for double bill flags in the response
          if (data.data && data.data.length > 0) {
            const transferData = data.data[0]
            if (transferData.doubleBill === "Yes") {
              doubleBillFlags.push({
                transferId: data.transferId,
                companyName: transferData.companyName || "Unknown",
                doubleBill: transferData.doubleBill,
                policyCount: transferData.policies?.length || 0
              })
            }
          }
        } else {
          errors.push(data)
        }
      } else {
        errors.push({
          transferId: batch[index],
          error: result.reason.message
        })
      }
    })

    // Rate limiting delay
    if (i + batchSize < DWOLLA_TRANSFER_IDS.length) {
      console.log("⏳ Rate limiting delay...")
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Generate comprehensive report
  console.log("\n📋 COMPREHENSIVE POLICIES REPORT")
  console.log("=" * 60)
  console.log(`Total Transfers Processed: ${DWOLLA_TRANSFER_IDS.length}`)
  console.log(`Successful: ${results.length}`)
  console.log(`Errors: ${errors.length}`)
  console.log(`🚨 Double Bill Flags Found: ${doubleBillFlags.length}`)

  if (doubleBillFlags.length > 0) {
    console.log("\n🚨 DOUBLE BILL FLAGS DETECTED:")
    console.log("-" * 50)
    doubleBillFlags.forEach(flag => {
      console.log(`Transfer ID: ${flag.transferId}`)
      console.log(`Company: ${flag.companyName}`)
      console.log(`Double Bill: ${flag.doubleBill}`)
      console.log(`Policies: ${flag.policyCount}`)
      console.log("")
    })
  }

  // Export detailed results
  const reportData = {
    summary: {
      totalTransfers: DWOLLA_TRANSFER_IDS.length,
      successful: results.length,
      errors: errors.length,
      doubleBillCount: doubleBillFlags.length,
      totalPolicies: results.reduce((sum, r) => {
        if (r.data && r.data.length > 0) {
          return sum + (r.data[0].policies?.length || 0)
        }
        return sum
      }, 0)
    },
    doubleBillFlags,
    results: results.map(r => ({
      transferId: r.transferId,
      companyName: r.data?.[0]?.companyName || "Unknown",
      policyCount: r.data?.[0]?.policies?.length || 0,
      hasDoubleBill: r.data?.[0]?.doubleBill === "Yes" || false,
      doubleBill: r.data?.[0]?.doubleBill || null
    })),
    errors
  }

  const filename = `policies-report-database-${new Date().toISOString().split('T')[0]}.json`
  fs.writeFileSync(filename, JSON.stringify(reportData, null, 2))
  console.log(`\n💾 Detailed report saved to: ${filename}`)

  // Generate CSV summary
  const csvFilename = `policies-summary-database-${new Date().toISOString().split('T')[0]}.csv`
  generateCSVSummary(reportData, csvFilename)
  console.log(`📊 CSV summary saved to: ${csvFilename}`)

  return reportData
}

function generateCSVSummary(reportData, filename) {
  const headers = [
    "Transfer ID",
    "Company Name", 
    "Policy Count",
    "Double Bill Flag",
    "Double Bill Value"
  ]

  const rows = reportData.results.map(result => [
    result.transferId,
    result.companyName || "Unknown",
    result.policyCount,
    result.hasDoubleBill ? "YES" : "NO",
    result.doubleBill || "N/A"
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  fs.writeFileSync(filename, csvContent)
}

// Run the report generation
generatePoliciesReport().catch(console.error)
