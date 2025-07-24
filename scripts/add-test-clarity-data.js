#!/usr/bin/env node

/**
 * Script to add test Microsoft Clarity session data to HubSpot
 * This will help test the Clarity sessions display in the UI
 */

const axios = require("axios")

// Read from environment - make sure to run this from the project root
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY
const HUBSPOT_BASE_URL = "https://api.hubapi.com"

if (!HUBSPOT_API_KEY) {
  console.error("❌ HUBSPOT_API_KEY not found in environment variables")
  process.exit(1)
}

async function findOrCreateContact(email) {
  try {
    // First, try to find existing contact using POST for search
    const searchResponse = await axios.post(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: email,
              },
            ],
          },
        ],
        properties: ["email", "firstname", "lastname"],
        limit: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (searchResponse.data.results && searchResponse.data.results.length > 0) {
      console.log(`✅ Found existing contact: ${email}`)
      return searchResponse.data.results[0]
    }

    // Create new contact if not found
    const createResponse = await axios.post(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`,
      {
        properties: {
          email: email,
          firstname: "Test",
          lastname: "User",
          lifecyclestage: "customer",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    console.log(`✅ Created new contact: ${email}`)
    return createResponse.data
  } catch (error) {
    console.error("❌ Error finding/creating contact:", error.response?.data || error.message)
    throw error
  }
}

async function addClarityEngagements(contactId) {
  const engagements = [
    {
      properties: {
        hs_engagement_type: "NOTE",
        hs_body_preview:
          "Microsoft Clarity Session Recording Available\n\nSession ID: clarity_session_001\nRecording URL: https://clarity.microsoft.com/projects/view/abc123/session/def456\nDuration: 3 minutes\nDevice: Desktop\nBrowser: Chrome 120\n\nSmart Events:\n- Event: Login, Type: Auto, Start Time: 00:41\n- Event: Submit form, Type: Auto, Start Time: 00:41",
        hs_body_preview_html:
          '<p>Microsoft Clarity Session Recording Available</p><p>Session ID: clarity_session_001<br>Recording URL: <a href="https://clarity.microsoft.com/projects/view/abc123/session/def456">https://clarity.microsoft.com/projects/view/abc123/session/def456</a><br>Duration: 3 minutes<br>Device: Desktop<br>Browser: Chrome 120</p><p>Smart Events:<br>- Event: Login, Type: Auto, Start Time: 00:41<br>- Event: Submit form, Type: Auto, Start Time: 00:41</p>',
        hs_timestamp: Date.now(),
        hs_activity_type: "Clarity Session Recording",
        clarity_session_id: "clarity_session_001",
        clarity_recording_url: "https://clarity.microsoft.com/projects/view/abc123/session/def456",
        clarity_duration: 180,
        clarity_device_type: "desktop",
        clarity_browser: "Chrome 120",
      },
      associations: [
        {
          to: {
            id: contactId,
          },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
      ],
    },
    {
      properties: {
        hs_engagement_type: "NOTE",
        hs_body_preview:
          "Microsoft Clarity Session Recording Available\n\nSession ID: clarity_session_002\nRecording URL: https://clarity.microsoft.com/projects/view/abc123/session/ghi789\nDuration: 7 minutes\nDevice: Mobile\nBrowser: Safari 17\n\nSmart Events:\n- Event: Page view, Type: Auto, Start Time: 00:05\n- Event: Click button, Type: Manual, Start Time: 01:23\n- Event: Form error, Type: Auto, Start Time: 02:45",
        hs_body_preview_html:
          '<p>Microsoft Clarity Session Recording Available</p><p>Session ID: clarity_session_002<br>Recording URL: <a href="https://clarity.microsoft.com/projects/view/abc123/session/ghi789">https://clarity.microsoft.com/projects/view/abc123/session/ghi789</a><br>Duration: 7 minutes<br>Device: Mobile<br>Browser: Safari 17</p><p>Smart Events:<br>- Event: Page view, Type: Auto, Start Time: 00:05<br>- Event: Click button, Type: Manual, Start Time: 01:23<br>- Event: Form error, Type: Auto, Start Time: 02:45</p>',
        hs_timestamp: Date.now() - 86400000, // 1 day ago
        hs_activity_type: "Clarity Session Recording",
        clarity_session_id: "clarity_session_002",
        clarity_recording_url: "https://clarity.microsoft.com/projects/view/abc123/session/ghi789",
        clarity_duration: 420,
        clarity_device_type: "mobile",
        clarity_browser: "Safari 17",
      },
      associations: [
        {
          to: {
            id: contactId,
          },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
      ],
    },
  ]

  for (const engagement of engagements) {
    try {
      const response = await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/engagements`,
        engagement,
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
      console.log(`✅ Created Clarity engagement: ${engagement.properties.clarity_session_id}`)
    } catch (error) {
      console.error("❌ Error creating engagement:", error.response?.data || error.message)
    }
  }
}

async function main() {
  const testEmail = "john.doe@example.com" // Change this to match your test searches

  console.log("🚀 Adding test Microsoft Clarity session data to HubSpot...")
  console.log(`📧 Using test email: ${testEmail}`)

  try {
    // Find or create contact
    const contact = await findOrCreateContact(testEmail)

    // Add Clarity engagements
    await addClarityEngagements(contact.id)

    console.log("✅ Test Clarity session data added successfully!")
    console.log("🎯 Now you can search for:", testEmail)
    console.log("📹 You should see 2 recording sessions in the UI")
  } catch (error) {
    console.error("❌ Script failed:", error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
