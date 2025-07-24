#!/usr/bin/env tsx

import { DwollaClient } from '../lib/api/dwolla/client'
import { log } from '../lib/logger'
import crypto from 'crypto'
import readline from 'readline/promises'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function setupWebhookSubscription() {
  console.log('=== Dwolla Webhook Subscription Setup ===\n')

  try {
    const client = new DwollaClient()
    
    // Get current subscriptions
    console.log('Checking existing webhook subscriptions...')
    const subscriptions = await client.getWebhookSubscriptions()
    
    // Determine webhook URL
    const webhookUrl = process.env.NEXTAUTH_URL 
      ? `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2`
      : await rl.question('Enter your application URL (e.g., https://app.example.com): ') + '/api/webhooks/dwolla/v2'
    
    console.log(`\nWebhook URL: ${webhookUrl}`)
    
    // Check if subscription already exists
    const existing = subscriptions.find((sub: any) => sub.url === webhookUrl)
    if (existing) {
      console.log('\n✅ Webhook subscription already exists!')
      console.log(`   ID: ${existing.id}`)
      console.log(`   Status: ${existing.paused ? 'Paused' : 'Active'}`)
      
      if (existing.paused) {
        const unpause = await rl.question('\nWould you like to unpause this subscription? (y/n): ')
        if (unpause.toLowerCase() === 'y') {
          await client.updateWebhookSubscription(existing.id, false)
          console.log('✅ Subscription unpaused!')
        }
      }
      
      rl.close()
      return
    }
    
    // Create new subscription
    console.log('\n📝 Creating new webhook subscription...\n')
    
    // Generate or get webhook secret
    let webhookSecret = process.env.DWOLLA_WEBHOOK_SECRET
    if (!webhookSecret) {
      const generateSecret = await rl.question('Generate a random webhook secret? (y/n): ')
      if (generateSecret.toLowerCase() === 'y') {
        webhookSecret = crypto.randomBytes(32).toString('base64')
        console.log(`\n🔐 Generated webhook secret: ${webhookSecret}`)
        console.log('   ⚠️  Save this in your .env file as DWOLLA_WEBHOOK_SECRET')
      } else {
        webhookSecret = await rl.question('Enter webhook secret: ')
      }
    }
    
    // Confirm before creating
    console.log('\n📋 Summary:')
    console.log(`   URL: ${webhookUrl}`)
    console.log(`   Secret: ${webhookSecret?.substring(0, 10)}...`)
    
    const confirm = await rl.question('\nCreate this webhook subscription? (y/n): ')
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled')
      rl.close()
      return
    }
    
    // Create subscription
    console.log('\n⏳ Creating webhook subscription...')
    const newSubscription = await client.createWebhookSubscription(webhookUrl, webhookSecret!)
    
    console.log('\n✅ Webhook subscription created successfully!')
    console.log(`   ID: ${newSubscription.id}`)
    console.log(`   URL: ${newSubscription.url}`)
    
    console.log('\n📝 Next steps:')
    console.log('1. Add DWOLLA_WEBHOOK_SECRET to your .env file')
    console.log('2. Restart your application')
    console.log('3. Test the webhook by triggering an event in Dwolla')
    console.log('4. Monitor events in the Analytics → Webhooks dashboard')
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error)
  } finally {
    rl.close()
  }
}

// Run setup
setupWebhookSubscription()