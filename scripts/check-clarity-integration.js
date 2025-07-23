#!/usr/bin/env node

/**
 * Script to check for Microsoft Clarity integration in HubSpot
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Read environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key] = valueParts.join('=').replace(/"/g, '')
  }
})

const HUBSPOT_API_KEY = envVars.HUBSPOT_API_KEY
const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

if (!HUBSPOT_API_KEY) {
  console.error('❌ HUBSPOT_API_KEY not found in environment variables')
  process.exit(1)
}

async function checkContactProperties() {
  try {
    console.log('🔍 Checking contact properties for Clarity-related fields...')
    const url = `${HUBSPOT_BASE_URL}/crm/v3/properties/contacts`
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const clarityProps = response.data.results.filter(prop => 
      prop.name.toLowerCase().includes('clarity') ||
      prop.label.toLowerCase().includes('clarity') ||
      prop.description?.toLowerCase().includes('clarity')
    )

    console.log(`📋 Found ${clarityProps.length} Clarity-related contact properties:`)
    clarityProps.forEach(prop => {
      console.log(`  - ${prop.name}: ${prop.label} (${prop.fieldType})`)
    })

    return clarityProps.length > 0
  } catch (error) {
    console.error('❌ Error checking contact properties:', error.response?.data || error.message)
    return false
  }
}

async function checkEngagementProperties() {
  try {
    console.log('\n🔍 Checking engagement properties for Clarity-related fields...')
    const url = `${HUBSPOT_BASE_URL}/crm/v3/properties/engagements`
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const clarityProps = response.data.results.filter(prop => 
      prop.name.toLowerCase().includes('clarity') ||
      prop.label.toLowerCase().includes('clarity') ||
      prop.description?.toLowerCase().includes('clarity')
    )

    console.log(`📋 Found ${clarityProps.length} Clarity-related engagement properties:`)
    clarityProps.forEach(prop => {
      console.log(`  - ${prop.name}: ${prop.label} (${prop.fieldType})`)
    })

    return clarityProps.length > 0
  } catch (error) {
    console.error('❌ Error checking engagement properties:', error.response?.data || error.message)
    return false
  }
}

async function checkInstalledApps() {
  try {
    console.log('\n🔍 Checking installed apps for Microsoft Clarity...')
    // Note: This endpoint might require different scopes
    const url = `${HUBSPOT_BASE_URL}/integrations/v1/me`
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('📱 Current app info:')
    console.log(JSON.stringify(response.data, null, 2))

  } catch (error) {
    console.log('ℹ️  Cannot access app integration endpoint (may require different scopes)')
    console.log('   This is normal - checking properties is more important')
  }
}

async function searchClarityInTimeline() {
  try {
    console.log('\n🔍 Searching for any Clarity mentions in recent timeline entries...')
    
    // Get a sample of recent engagements across all contacts
    const url = `${HUBSPOT_BASE_URL}/crm/v3/objects/engagements/search`
    
    const response = await axios.post(url, {
      filterGroups: [{
        filters: [{
          propertyName: 'hs_engagement_type',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: [
        'hs_timestamp', 
        'hs_engagement_type', 
        'hs_body_preview', 
        'hs_activity_type', 
        'hs_body_preview_html'
      ],
      sorts: [{
        propertyName: 'hs_timestamp',
        direction: 'DESCENDING'
      }],
      limit: 100
    }, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const engagements = response.data.results || []
    console.log(`📋 Checking ${engagements.length} recent engagements...`)

    const clarityMentions = engagements.filter(engagement => {
      const bodyPreview = engagement.properties?.hs_body_preview?.toLowerCase() || ""
      const bodyPreviewHtml = engagement.properties?.hs_body_preview_html?.toLowerCase() || ""
      const activityType = engagement.properties?.hs_activity_type?.toLowerCase() || ""
      
      return bodyPreview.includes('clarity') ||
             bodyPreviewHtml.includes('clarity') ||
             activityType.includes('clarity') ||
             bodyPreview.includes('microsoft') ||
             bodyPreviewHtml.includes('microsoft')
    })

    console.log(`🎯 Found ${clarityMentions.length} engagements mentioning Clarity or Microsoft`)
    if (clarityMentions.length > 0) {
      console.log('\n📝 Sample mentions:')
      clarityMentions.slice(0, 3).forEach((engagement, index) => {
        console.log(`  ${index + 1}. ${engagement.properties?.hs_engagement_type} - ${engagement.properties?.hs_body_preview?.substring(0, 100)}...`)
      })
    }

  } catch (error) {
    console.error('❌ Error searching timeline:', error.response?.data || error.message)
  }
}

async function main() {
  console.log('🚀 Checking Microsoft Clarity integration in HubSpot...')
  console.log('🔍 This will help identify how Clarity data is stored\n')

  try {
    const hasContactProps = await checkContactProperties()
    const hasEngagementProps = await checkEngagementProperties()
    await checkInstalledApps()
    await searchClarityInTimeline()

    console.log('\n📊 Summary:')
    console.log(`  - Clarity contact properties: ${hasContactProps ? '✅ Found' : '❌ None'}`)
    console.log(`  - Clarity engagement properties: ${hasEngagementProps ? '✅ Found' : '❌ None'}`)
    
    if (!hasContactProps && !hasEngagementProps) {
      console.log('\n💡 Next steps:')
      console.log('  1. Install Microsoft Clarity app from HubSpot App Marketplace')
      console.log('  2. Configure the integration to send session data to HubSpot')
      console.log('  3. Ensure proper tracking code is installed on your website')
      console.log('  4. Wait for user sessions to be recorded and sent to HubSpot')
      console.log('\n🔗 HubSpot App Marketplace: https://ecosystem.hubspot.com/marketplace/apps/search?q=clarity')
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message)
  }
}

if (require.main === module) {
  main()
}
