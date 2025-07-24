#!/usr/bin/env tsx

import { DwollaClient } from '../lib/api/dwolla/client'
import { log } from '../lib/logger'

async function testWebhookSync() {
  console.log('Testing Dwolla webhook sync...\n')

  try {
    const client = new DwollaClient()
    
    // Test 1: Get webhook subscriptions
    console.log('1. Fetching webhook subscriptions...')
    const subscriptions = await client.getWebhookSubscriptions()
    console.log(`Found ${subscriptions.length} webhook subscriptions`)
    subscriptions.forEach((sub: any) => {
      console.log(`  - ${sub.url} (${sub.paused ? 'paused' : 'active'})`)
    })
    
    // Test 2: Get recent webhook events
    console.log('\n2. Fetching recent webhook events...')
    const events = await client.getWebhookEvents({
      limit: 10,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    })
    console.log(`Found ${events.length} webhook events in the last 24 hours`)
    
    if (events.length > 0) {
      console.log('\nFirst 5 events:')
      events.slice(0, 5).forEach((event: any) => {
        console.log(`  - ${event.topic} (${event.id})`)
        console.log(`    Created: ${event.created}`)
        if (event._links?.resource?.href) {
          console.log(`    Resource: ${event._links.resource.href}`)
        }
      })
    }
    
    // Test 3: Check if we need to create a webhook subscription
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2`
    console.log(`\n3. Checking for subscription to: ${webhookUrl}`)
    
    const existingSubscription = subscriptions.find(
      (sub: any) => sub.url === webhookUrl
    )
    
    if (existingSubscription) {
      console.log('✅ Webhook subscription already exists')
      if (existingSubscription.paused) {
        console.log('⚠️  Subscription is paused - you may want to unpause it')
      }
    } else {
      console.log('❌ No webhook subscription found for this URL')
      console.log('   To create one, use the Dwolla dashboard or API')
    }
    
    console.log('\n✅ All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testWebhookSync()