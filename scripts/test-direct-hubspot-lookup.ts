/**
 * Test the direct HubSpot lookup logic that we added to the export
 */

async function testDirectHubSpotLookup() {
  console.log("🧪 Testing Direct HubSpot Lookup Logic")
  console.log("=====================================")

  const hubspotApiKey = process.env.HUBSPOT_API_KEY
  if (!hubspotApiKey) {
    console.log("❌ HUBSPOT_API_KEY not found. Run:")
    console.log("   export HUBSPOT_API_KEY=your_key_here")
    return
  }

  console.log("✅ HUBSPOT_API_KEY found")

  // Test with some sample Dwolla IDs from the CSV
  const testDwollaIds = [
    "9bb5b9bc-fc88-f011-ac7e-0a27ad48efdb",
    "b7459b9f-f688-f011-ac7e-0a27ad48efdb", 
    "a1a140ff-3288-f011-ac7e-0a27ad48efdb"
  ]

  const baseUrl = "https://api.hubapi.com"

  for (let i = 0; i < testDwollaIds.length; i++) {
    const dwollaId = testDwollaIds[i]
    console.log(`\n${i + 1}. Testing Dwolla ID: ${dwollaId}`)

    try {
      // Use the same logic as in the export route
      const transferResponse = await fetch(`${baseUrl}/crm/v3/objects/2-45680577/${dwollaId}?properties=coverage_month,amount,transfer_status`, {
        headers: {
          'Authorization': `Bearer ${hubspotApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      console.log(`   Response status: ${transferResponse.status}`)

      if (transferResponse.ok) {
        const transferData = await transferResponse.json()
        const coverageMonth = transferData.properties?.coverage_month
        const amount = transferData.properties?.amount
        const status = transferData.properties?.transfer_status

        console.log(`   ✅ SUCCESS!`)
        console.log(`   - Coverage Month: ${coverageMonth || 'NOT SET'}`)
        console.log(`   - Amount: $${amount || 'NOT SET'}`)
        console.log(`   - Status: ${status || 'NOT SET'}`)

        if (coverageMonth && coverageMonth !== 'Unknown') {
          console.log(`   🎯 This should fix the export for this transaction!`)
        } else {
          console.log(`   ⚠️  Coverage month still not set or 'Unknown'`)
        }

      } else {
        const errorText = await transferResponse.text()
        console.log(`   ❌ FAILED: ${transferResponse.status} ${transferResponse.statusText}`)
        console.log(`   Error: ${errorText}`)
      }

    } catch (error) {
      console.log(`   ❌ ERROR:`, error instanceof Error ? error.message : String(error))
    }
  }

  console.log("\n🎯 SUMMARY")
  console.log("=========")
  console.log("If the above lookups succeeded and returned coverage months,")
  console.log("then the export should now show proper coverage months instead of 'Unknown'!")
  console.log("")
  console.log("Next step: Test the actual export to verify the fix works.")
}

// Run the test
testDirectHubSpotLookup().catch(console.error)


