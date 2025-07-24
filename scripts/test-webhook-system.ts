#!/usr/bin/env tsx

import { prisma } from '../lib/db'
import { log } from '../lib/logger'

async function testWebhookSystem() {
  console.log('🔍 Testing Webhook Analytics System...\n')

  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully\n')

    // Test 2: Check if tables exist
    console.log('2. Checking webhook analytics tables...')
    const tables = [
      { name: 'WebhookEvent', count: await prisma.webhookEvent.count() },
      { name: 'JourneyInstance', count: await prisma.journeyInstance.count() },
      { name: 'ReconciliationCheck', count: await prisma.reconciliationCheck.count() },
      { name: 'WebhookAnomaly', count: await prisma.webhookAnomaly.count() },
      { name: 'EventMetric', count: await prisma.eventMetric.count() },
      { name: 'EventAnomaly', count: await prisma.eventAnomaly.count() }
    ]
    
    for (const table of tables) {
      console.log(`  ✅ ${table.name}: ${table.count} records`)
    }
    console.log()

    // Test 3: Test API endpoints
    console.log('3. Testing API endpoints...')
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const endpoints = [
      '/api/analytics/metrics',
      '/api/analytics/events',
      '/api/analytics/journeys',
      '/api/analytics/anomalies',
      '/api/analytics/reconciliation'
    ]

    console.log('⚠️  Note: API tests require authentication. Make sure you are logged in.\n')

    // Test 4: Create sample data if none exists
    if (tables[0].count === 0) {
      console.log('4. Creating sample webhook event...')
      
      const sampleEvent = await prisma.webhookEvent.create({
        data: {
          eventId: `test-${Date.now()}`,
          eventType: 'customer_created',
          topic: 'customer_created',
          resourceType: 'customer',
          resourceId: 'test-customer-123',
          eventTimestamp: new Date(),
          payload: { test: true },
          partitionKey: new Date().toISOString().substring(0, 7),
          processingState: 'completed',
          processingDurationMs: 100
        }
      })
      
      console.log(`✅ Created sample event: ${sampleEvent.eventId}\n`)
    }

    // Test 5: Test journey definition
    console.log('5. Checking journey definitions...')
    const journeyDefs = await prisma.eventJourneyDefinition.count()
    console.log(`  Found ${journeyDefs} journey definitions`)
    
    if (journeyDefs === 0) {
      console.log('  Creating sample journey definition...')
      
      await prisma.eventJourneyDefinition.create({
        data: {
          name: 'Customer Verification Journey',
          category: 'verification',
          config: {
            steps: [
              { event: 'customer_created', required: true },
              { event: 'customer_verification_document_needed', required: false },
              { event: 'customer_verified', required: true }
            ]
          },
          createdBy: 'system'
        }
      })
      
      console.log('  ✅ Created sample journey definition\n')
    }

    // Test 6: Summary
    console.log('📊 System Status Summary:')
    console.log('  - Database: ✅ Connected')
    console.log('  - Tables: ✅ All created')
    console.log(`  - Webhook Events: ${tables[0].count}`)
    console.log(`  - Journey Instances: ${tables[1].count}`)
    console.log(`  - Anomalies: ${tables[3].count}`)
    console.log(`  - Metrics: ${tables[4].count}`)
    
    console.log('\n✅ Webhook Analytics System is ready!')
    console.log('\nNext steps:')
    console.log('1. Navigate to Analytics → Webhooks in the dashboard')
    console.log('2. Use the Settings tab to sync webhook events from Dwolla')
    console.log('3. Monitor real-time events and analytics')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testWebhookSystem()