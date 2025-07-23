#!/usr/bin/env node

/**
 * Script to test Microsoft Clarity data access from HubSpot timeline
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
    envVars[key] = valueParts.join('=').replace(/\"/g, '')
  }
})

const HUBSPOT_API_KEY = envVars.HUBSPOT_API_KEY
const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

if (!HUBSPOT_API_KEY) {
  console.error('❌ HUBSPOT_API_KEY not found in environment variables')
  process.exit(1)
}

async function searchCompanies(searchTerm, searchType = 'email') {
  const url = `${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`
  
  const filterProperty = searchType === 'email' ? 'email___owner' : 
                        searchType === 'name' ? 'name' : 
                        searchType === 'dwolla_id' ? 'dwolla_customer_id' : 'name'

  const response = await axios.post(url, {
    filterGroups: [{
      filters: [{
        propertyName: filterProperty,
        operator: 'CONTAINS_TOKEN',
        value: searchTerm
      }]
    }],
    properties: ['name', 'domain', 'email___owner', 'dwolla_customer_id', 'hs_object_id'],
    limit: 10
  }, {
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  return response.data.results || []
}

async function getAssociations(objectType, objectId, toObjectType) {
  const url = `${HUBSPOT_BASE_URL}/crm/v4/objects/${objectType}/${objectId}/associations/${toObjectType}`
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  return response.data
}

async function getContactEngagements(contactId) {
  try {
    // First, get engagement associations for the contact
    const associationsUrl = `${HUBSPOT_BASE_URL}/crm/v4/objects/contacts/${contactId}/associations/engagements`
    
    const associationsResponse = await axios.get(associationsUrl, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const engagementIds = associationsResponse.data.results?.map(r => r.toObjectId) || []
    console.log(`📋 Found ${engagementIds.length} engagement associations`)

    if (engagementIds.length === 0) {
      return []
    }

    // Batch read engagements
    const batchUrl = `${HUBSPOT_BASE_URL}/crm/v3/objects/engagements/batch/read`
    
    const batchResponse = await axios.post(batchUrl, {
      inputs: engagementIds.map(id => ({ id })),
      properties: [
        'hs_timestamp', 
        'hs_engagement_type', 
        'hs_body_preview', 
        'hs_activity_type', 
        'hs_body_preview_html',
        'hs_body_preview_is_truncated',
        'clarity_session_id',
        'clarity_recording_url',
        'clarity_duration',
        'clarity_device_type',
        'clarity_browser'
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    return batchResponse.data.results || []

  } catch (error) {
    console.error('❌ Error fetching engagements:', error.response?.data || error.message)
    return []
  }
}

function parseClaritySessionsFromEngagements(engagements) {
  const sessions = []

  console.log(`🔍 Parsing ${engagements.length} engagements for Clarity sessions...`)

  for (const engagement of engagements) {
    console.log(`\n📋 Checking engagement ${engagement.id}:`)
    console.log(`  - Type: ${engagement.properties?.hs_engagement_type}`)
    console.log(`  - Activity Type: ${engagement.properties?.hs_activity_type}`)
    console.log(`  - Body Preview: ${engagement.properties?.hs_body_preview?.substring(0, 100)}...`)
    
    // Check if this is a Clarity session engagement
    const bodyPreview = engagement.properties?.hs_body_preview || ""
    const bodyPreviewHtml = engagement.properties?.hs_body_preview_html || ""
    const activityType = engagement.properties?.hs_activity_type || ""
    const engagementType = engagement.properties?.hs_engagement_type || ""
    
    const isClarity = (
      bodyPreview.includes("clarity.microsoft.com") ||
      bodyPreviewHtml.includes("clarity.microsoft.com") ||
      activityType.toLowerCase().includes("clarity") ||
      engagement.properties?.clarity_session_id ||
      engagement.properties?.clarity_recording_url ||
      engagementType === "CLARITY_SESSION" ||
      bodyPreview.toLowerCase().includes("session recording") ||
      bodyPreview.toLowerCase().includes("user session") ||
      bodyPreview.toLowerCase().includes("recording") ||
      // Check for Microsoft Clarity integration timeline entries
      bodyPreview.toLowerCase().includes("microsoft clarity") ||
      activityType.toLowerCase().includes("microsoft clarity")
    )
    
    console.log(`  - Is Clarity: ${isClarity}`)
    
    if (isClarity) {
      const recordingUrl = engagement.properties?.clarity_recording_url ||
                         extractUrlFromBody(bodyPreview) ||
                         extractUrlFromBody(bodyPreviewHtml) ||
                         ""
      
      const session = {
        id: engagement.id,
        recordingUrl,
        timestamp: new Date(engagement.properties?.hs_timestamp || engagement.createdAt),
        duration: engagement.properties?.clarity_duration,
        deviceType: engagement.properties?.clarity_device_type,
        browser: engagement.properties?.clarity_browser,
        sessionId: engagement.properties?.clarity_session_id
      }

      sessions.push(session)
      console.log(`  ✅ Added Clarity session: ${session.sessionId || session.id}`)
    }
  }

  return sessions
}

function extractUrlFromBody(body) {
  if (!body) return ""
  
  const patterns = [
    /https:\/\/clarity\.microsoft\.com[^\s"'<>]*/g,
    /clarity\.microsoft\.com[^\s"'<>]*/g
  ]
  
  for (const pattern of patterns) {
    const matches = body.match(pattern)
    if (matches && matches.length > 0) {
      let url = matches[0].trim()
      if (!url.startsWith('http')) {
        url = 'https://' + url
      }
      url = url.replace(/[<>"'\s]*$/, '')
      if (url.includes('clarity.microsoft.com')) {
        return url
      }
    }
  }
  
  return ""
}

async function main() {
  const testEmail = 'jonathan@cakewalkbenefits.com'

  console.log('🚀 Testing Microsoft Clarity data from HubSpot timeline...')
  console.log(`📧 Using email: ${testEmail}`)

  try {
    // Search for companies
    console.log('\n🔍 Searching for companies...')
    const companies = await searchCompanies(testEmail, 'email')
    console.log(`📊 Found ${companies.length} companies`)
    
    if (companies.length === 0) {
      console.log('❌ No companies found')
      return
    }

    const company = companies[0]
    console.log(`🏢 Using company: ${company.properties.name} (ID: ${company.id})`)

    // Get contacts for this company
    console.log('\n👥 Getting contacts for company...')
    const contacts = await getAssociations('companies', company.id, 'contacts')
    console.log(`👤 Found ${contacts.results?.length || 0} contacts`)

    if (!contacts.results || contacts.results.length === 0) {
      console.log('❌ No contacts found for company')
      return
    }

    const contactId = contacts.results[0].toObjectId
    console.log(`👤 Using contact ID: ${contactId}`)

    // Get engagements for this contact
    console.log('\n📅 Getting engagements for contact...')
    const engagements = await getContactEngagements(contactId)
    console.log(`📋 Found ${engagements.length} total engagements`)

    if (engagements.length === 0) {
      console.log('❌ No engagements found')
      return
    }

    // Show sample engagement
    console.log('\n📄 Sample engagement structure:')
    console.log(JSON.stringify(engagements[0], null, 2))

    // Parse Clarity sessions
    console.log('\n🎥 Parsing Clarity sessions...')
    const claritySessions = parseClaritySessionsFromEngagements(engagements)
    
    console.log(`\n✅ Summary:`)
    console.log(`  - Total engagements: ${engagements.length}`)
    console.log(`  - Clarity sessions found: ${claritySessions.length}`)
    
    if (claritySessions.length > 0) {
      console.log('\n🎬 Clarity Sessions:')
      claritySessions.forEach((session, index) => {
        console.log(`  ${index + 1}. Session ${session.sessionId || session.id}`)
        console.log(`     URL: ${session.recordingUrl}`)
        console.log(`     Timestamp: ${session.timestamp}`)
        console.log(`     Duration: ${session.duration || 'N/A'}`)
        console.log(`     Device: ${session.deviceType || 'N/A'}`)
        console.log(`     Browser: ${session.browser || 'N/A'}`)
      })
    } else {
      console.log('\n🤔 No Clarity sessions found. This could mean:')
      console.log('  1. No Microsoft Clarity integration is active')
      console.log('  2. No recordings have been captured yet')
      console.log('  3. The integration stores data in a different format')
      console.log('  4. Additional scopes or configuration needed')
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message)
    if (error.response?.data) {
      console.error('📋 Response details:', JSON.stringify(error.response.data, null, 2))
    }
  }
}

if (require.main === module) {
  main()
}
