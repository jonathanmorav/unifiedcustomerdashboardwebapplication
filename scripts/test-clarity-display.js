#!/usr/bin/env node

/**
 * Simple script to test clarity session display
 * This creates a basic engagement note with Clarity data
 */

const axios = require('axios')
const fs = require('fs')

// Read API key from .env.local manually
let HUBSPOT_API_KEY
try {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/HUBSPOT_API_KEY="([^"]+)"/)
  HUBSPOT_API_KEY = match ? match[1] : null
} catch (error) {
  console.log('Could not read .env.local:', error.message)
}
const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

if (!HUBSPOT_API_KEY) {
  console.error('❌ HUBSPOT_API_KEY not found in environment variables')
  process.exit(1)
}

async function findExistingContact() {
  try {
    // Search for existing contact with the email we know exists
    const searchResponse = await axios.post(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: 'john.eliason@fbfs.com' // Use existing contact
          }]
        }],
        properties: ['email', 'firstname', 'lastname'],
        limit: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (searchResponse.data.results && searchResponse.data.results.length > 0) {
      console.log(`✅ Found existing contact: john.eliason@fbfs.com`)
      return searchResponse.data.results[0]
    }

    console.log('❌ Contact not found')
    return null
  } catch (error) {
    console.error('❌ Error finding contact:', error.response?.data || error.message)
    return null
  }
}

async function addTestClarityNote(contactId) {
  try {
    const engagementData = {
      properties: {
        hs_engagement_type: 'NOTE',
        hs_body_preview: `Microsoft Clarity Session Recording

Session ID: test_session_001
Recording URL: https://clarity.microsoft.com/projects/view/test123/session/abc456
Duration: 5 minutes
Device: Desktop
Browser: Chrome 120

Smart Events:
- Event: Login, Type: Auto, Start Time: 00:30
- Event: Submit form, Type: Auto, Start Time: 01:15
- Event: Page navigation, Type: Auto, Start Time: 02:30`,
        hs_body_preview_html: `<p>Microsoft Clarity Session Recording</p>
<p>Session ID: test_session_001<br>
Recording URL: <a href="https://clarity.microsoft.com/projects/view/test123/session/abc456">https://clarity.microsoft.com/projects/view/test123/session/abc456</a><br>
Duration: 5 minutes<br>
Device: Desktop<br>
Browser: Chrome 120</p>
<p>Smart Events:<br>
- Event: Login, Type: Auto, Start Time: 00:30<br>
- Event: Submit form, Type: Auto, Start Time: 01:15<br>
- Event: Page navigation, Type: Auto, Start Time: 02:30</p>`,
        hs_timestamp: Date.now(),
        hs_activity_type: 'Clarity Session Recording',
        clarity_session_id: 'test_session_001',
        clarity_recording_url: 'https://clarity.microsoft.com/projects/view/test123/session/abc456',
        clarity_duration: 300,
        clarity_device_type: 'desktop',
        clarity_browser: 'Chrome 120',
        clarity_smart_events: JSON.stringify([
          { event: 'Login', type: 'Auto', startTime: '00:30' },
          { event: 'Submit form', type: 'Auto', startTime: '01:15' },
          { event: 'Page navigation', type: 'Auto', startTime: '02:30' }
        ])
      },
      associations: [{
        to: { id: contactId },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 202 // Contact to Engagement
        }]
      }]
    }

    console.log('🚀 Creating test Clarity engagement...')
    const response = await axios.post(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/engagements`,
      engagementData,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('✅ Test Clarity engagement created successfully!')
    console.log('📋 Engagement ID:', response.data.id)
    return response.data
  } catch (error) {
    console.error('❌ Error creating engagement:', error.response?.status, error.response?.data || error.message)
    
    if (error.response?.status === 403) {
      console.log('\n💡 Tip: The HubSpot API key may not have the required scopes.')
      console.log('   This is expected in some environments.')
      console.log('   You can still test the UI with existing data.')
    }
    
    return null
  }
}

async function main() {
  console.log('🔍 Testing Clarity session display...')
  
  try {
    // Find existing contact
    const contact = await findExistingContact()
    
    if (!contact) {
      console.log('❌ Cannot proceed without a contact to associate the engagement to')
      return
    }
    
    // Try to add test engagement
    await addTestClarityNote(contact.id)
    
    console.log('\n🎯 Now you can:')
    console.log('1. Search for: john.eliason@fbfs.com')
    console.log('2. Check the Session Recordings section')
    console.log('3. Look at browser console for [CLARITY DEBUG] logs')
    
  } catch (error) {
    console.error('❌ Script failed:', error.message)
  }
}

if (require.main === module) {
  main()
}
