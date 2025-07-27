#!/usr/bin/env tsx

import { DwollaClient } from '../lib/api/dwolla/client'
import { log } from '../lib/logger'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import readline from 'readline/promises'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

interface WebhookConfig {
  webhookUrl: string
  webhookSecret: string
  subscriptionId?: string
}

async function checkEnvironmentVariables(): Promise<{ hasSecret: boolean; hasUrl: boolean }> {
  const hasSecret = !!process.env.DWOLLA_WEBHOOK_SECRET
  const hasUrl = !!process.env.NEXTAUTH_URL
  
  console.log('\n📋 Environment Check:')
  console.log(`   DWOLLA_WEBHOOK_SECRET: ${hasSecret ? '✅ Set' : '❌ Missing'}`)
  console.log(`   NEXTAUTH_URL: ${hasUrl ? '✅ Set' : '❌ Missing'}`)
  
  return { hasSecret, hasUrl }
}

async function generateWebhookSecret(): Promise<string> {
  const secret = crypto.randomBytes(32).toString('base64')
  console.log(`\n🔐 Generated webhook secret: ${secret}`)
  return secret
}

async function updateEnvFile(webhookSecret: string): Promise<void> {
  const envPath = path.join(process.cwd(), '.env.local')
  const envContent = `
# Dwolla Webhook Configuration
DWOLLA_WEBHOOK_SECRET=${webhookSecret}
AUTO_START_QUEUE_PROCESSOR=true

# Add this to your existing .env.local file
`
  
  try {
    await fs.writeFile(envPath, envContent, { flag: 'a' })
    console.log(`\n✅ Added webhook configuration to ${envPath}`)
  } catch (error) {
    console.log(`\n⚠️  Could not write to ${envPath}. Please add manually:`)
    console.log(envContent)
  }
}

async function checkWebhookSubscription(client: DwollaClient, webhookUrl: string): Promise<any | null> {
  try {
    const subscriptions = await client.getWebhookSubscriptions()
    return subscriptions.find((sub: any) => sub.url === webhookUrl)
  } catch (error) {
    console.log('⚠️  Could not check existing subscriptions:', (error as Error).message)
    return null
  }
}

async function createWebhookSubscription(
  client: DwollaClient, 
  webhookUrl: string, 
  webhookSecret: string
): Promise<any> {
  try {
    console.log('\n⏳ Creating webhook subscription...')
    const subscription = await client.createWebhookSubscription(webhookUrl, webhookSecret)
    console.log(`✅ Webhook subscription created: ${subscription.id}`)
    return subscription
  } catch (error) {
    console.log('❌ Failed to create webhook subscription:', (error as Error).message)
    throw error
  }
}

async function testWebhookEndpoint(webhookUrl: string): Promise<boolean> {
  try {
    console.log(`\n🔍 Testing webhook endpoint: ${webhookUrl}`)
    const response = await fetch(webhookUrl, { method: 'GET' })
    
    if (response.ok) {
      console.log('✅ Webhook endpoint is accessible')
      return true
    } else {
      console.log(`⚠️  Webhook endpoint returned status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.log('❌ Webhook endpoint is not accessible:', (error as Error).message)
    return false
  }
}

async function main() {
  console.log('🔧 Dwolla Webhook Environment Setup')
  console.log('=====================================\n')

  try {
    // Check current environment
    const envCheck = await checkEnvironmentVariables()
    
    // Get or generate webhook secret
    let webhookSecret = process.env.DWOLLA_WEBHOOK_SECRET
    if (!webhookSecret) {
      const generate = await rl.question('\nGenerate a new webhook secret? (y/n): ')
      if (generate.toLowerCase() === 'y') {
        webhookSecret = await generateWebhookSecret()
        await updateEnvFile(webhookSecret)
        
        console.log('\n🔄 Please restart your application to load the new environment variables.')
        const continueSetup = await rl.question('Continue with webhook subscription setup? (y/n): ')
        if (continueSetup.toLowerCase() !== 'y') {
          console.log('Setup paused. Run this script again after restarting your application.')
          rl.close()
          return
        }
      } else {
        webhookSecret = await rl.question('Enter your webhook secret: ')
      }
    }
    
    // Determine webhook URL
    let webhookUrl = process.env.NEXTAUTH_URL 
      ? `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2`
      : null
      
    if (!webhookUrl) {
      const baseUrl = await rl.question('Enter your application URL (e.g., https://app.example.com): ')
      webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/dwolla/v2`
    }
    
    console.log(`\n📡 Webhook URL: ${webhookUrl}`)
    
    // Test webhook endpoint
    await testWebhookEndpoint(webhookUrl)
    
    // Check/create webhook subscription
    const client = new DwollaClient()
    const existingSubscription = await checkWebhookSubscription(client, webhookUrl)
    
    if (existingSubscription) {
      console.log(`\n✅ Webhook subscription already exists: ${existingSubscription.id}`)
      console.log(`   Status: ${existingSubscription.paused ? 'Paused' : 'Active'}`)
      
      if (existingSubscription.paused) {
        const unpause = await rl.question('Unpause this subscription? (y/n): ')
        if (unpause.toLowerCase() === 'y') {
          await client.updateWebhookSubscription(existingSubscription.id, false)
          console.log('✅ Subscription unpaused!')
        }
      }
    } else {
      const create = await rl.question('\nCreate new webhook subscription? (y/n): ')
      if (create.toLowerCase() === 'y') {
        await createWebhookSubscription(client, webhookUrl, webhookSecret)
      }
    }
    
    // Final instructions
    console.log('\n📝 Next Steps:')
    console.log('1. Ensure your application is running and accessible at the webhook URL')
    console.log('2. Test webhook functionality by triggering events in Dwolla')
    console.log('3. Monitor webhook events in your application logs')
    console.log('4. Monitor webhook events in application logs')
    
    console.log('\n✅ Webhook setup completed!')
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  } finally {
    rl.close()
  }
}

if (require.main === module) {
  main()
} 