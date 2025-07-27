#!/usr/bin/env tsx

import crypto from 'crypto'
import { log } from '../lib/logger'

interface TestWebhookEvent {
  id: string
  topic: string
  timestamp: string
  resourceId: string
  _links: {
    self: { href: string }
    resource: { href: string }
  }
  correlationId?: string
  [key: string]: any
}

class WebhookTester {
  private baseUrl: string
  private webhookSecret: string
  private webhookEndpoint: string

  constructor() {
    this.baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    this.webhookSecret = process.env.DWOLLA_WEBHOOK_SECRET || ''
    this.webhookEndpoint = `${this.baseUrl}/api/webhooks/dwolla/v2`

    if (!this.webhookSecret) {
      throw new Error('DWOLLA_WEBHOOK_SECRET is required for testing')
    }
  }

  private generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex')
  }

  private createTestEvent(eventType: string, resourceId?: string): TestWebhookEvent {
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const testResourceId = resourceId || crypto.randomUUID()

    const baseEvent = {
      id,
      topic: eventType,
      timestamp,
      resourceId: testResourceId,
      _links: {
        self: {
          href: `https://api-sandbox.dwolla.com/events/${id}`
        },
        resource: {
          href: `https://api-sandbox.dwolla.com/transfers/${testResourceId}`
        }
      },
      correlationId: crypto.randomUUID()
    }

    // Add event-specific data
    switch (eventType) {
      case 'customer_transfer_completed':
      case 'transfer_completed':
        return {
          ...baseEvent,
          amount: { value: '100.00', currency: 'USD' },
          status: 'processed',
          clearing: {
            source: 'standard',
            destination: 'standard'
          }
        }

      case 'customer_transfer_failed':
      case 'transfer_failed':
        return {
          ...baseEvent,
          code: 'R01',
          description: 'Insufficient Funds',
          failure: {
            code: 'R01',
            description: 'Insufficient Funds'
          }
        }

      case 'customer_transfer_cancelled':
      case 'transfer_cancelled':
        return {
          ...baseEvent,
          status: 'cancelled'
        }

      case 'transfer_returned':
        return {
          ...baseEvent,
          returnCode: 'R01',
          description: 'Insufficient Funds',
          failure: {
            code: 'R01',
            description: 'Insufficient Funds'
          }
        }

      case 'customer_bank_transfer_completed':
      case 'bank_transfer_completed':
        return {
          ...baseEvent,
          amount: { value: '50.00', currency: 'USD' },
          clearing: {
            source: 'next-available',
            destination: 'next-available'
          }
        }

      default:
        return baseEvent
    }
  }

  async sendTestWebhook(event: TestWebhookEvent): Promise<{
    success: boolean
    status: number
    response: any
    duration: number
  }> {
    const payload = JSON.stringify(event)
    const signature = this.generateSignature(payload)
    const startTime = Date.now()

    try {
      console.log(`📤 Sending ${event.topic} webhook...`)
      
      const response = await fetch(this.webhookEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dwolla-Signature': signature,
          'User-Agent': 'Dwolla/1.0'
        },
        body: payload
      })

      const duration = Date.now() - startTime
      const responseBody = await response.text()
      let parsedResponse

      try {
        parsedResponse = JSON.parse(responseBody)
      } catch {
        parsedResponse = responseBody
      }

      const result = {
        success: response.ok,
        status: response.status,
        response: parsedResponse,
        duration
      }

      if (response.ok) {
        console.log(`✅ Webhook sent successfully (${duration}ms)`)
      } else {
        console.log(`❌ Webhook failed: ${response.status} (${duration}ms)`)
        console.log(`   Response: ${responseBody}`)
      }

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      console.log(`❌ Webhook request failed: ${(error as Error).message}`)
      
      return {
        success: false,
        status: 0,
        response: { error: (error as Error).message },
        duration
      }
    }
  }

  async runTestSuite(): Promise<void> {
    console.log('🧪 Webhook Test Suite')
    console.log('====================\n')
    console.log(`Endpoint: ${this.webhookEndpoint}`)
    console.log(`Secret: ${this.webhookSecret.substring(0, 8)}...\n`)

    const testEvents = [
      'customer_transfer_completed',
      'customer_transfer_failed',
      'customer_transfer_cancelled',
      'transfer_returned',
      'customer_bank_transfer_completed'
    ]

    const results: Array<{
      eventType: string
      success: boolean
      duration: number
      status: number
    }> = []

    for (const eventType of testEvents) {
      const event = this.createTestEvent(eventType)
      const result = await this.sendTestWebhook(event)
      
      results.push({
        eventType,
        success: result.success,
        duration: result.duration,
        status: result.status
      })

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Summary
    console.log('\n📊 Test Results Summary')
    console.log('========================')
    
    const successful = results.filter(r => r.success).length
    const total = results.length
    
    // Defensive check to prevent division by zero
    if (total === 0) {
      console.log('⚠️  No test results to analyze')
      console.log('Success Rate: 0/0 (0.0%)')
      console.log('Average Duration: 0ms')
    } else {
      const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / total
      console.log(`Success Rate: ${successful}/${total} (${((successful/total) * 100).toFixed(1)}%)`)
      console.log(`Average Duration: ${Math.round(averageDuration)}ms`)
    }
    
    console.log('\nDetailed Results:')
    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`  ${status} ${result.eventType} - ${result.status} (${result.duration}ms)`)
    })

    if (successful === total) {
      console.log('\n🎉 All tests passed! Webhook system is functioning correctly.')
    } else {
      console.log('\n⚠️  Some tests failed. Check the webhook configuration and logs.')
    }
  }

  async testSpecificEvent(eventType: string, resourceId?: string): Promise<void> {
    console.log(`🧪 Testing specific event: ${eventType}`)
    
    const event = this.createTestEvent(eventType, resourceId)
    const result = await this.sendTestWebhook(event)
    
    console.log('\nEvent Details:')
    console.log(JSON.stringify(event, null, 2))
    
    console.log('\nResponse:')
    console.log(JSON.stringify(result, null, 2))
  }

  async testInvalidSignature(): Promise<void> {
    console.log('🧪 Testing invalid signature handling...')
    
    const event = this.createTestEvent('customer_transfer_completed')
    const payload = JSON.stringify(event)
    const invalidSignature = 'invalid-signature'

    try {
      const response = await fetch(this.webhookEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dwolla-Signature': invalidSignature,
          'User-Agent': 'Dwolla/1.0'
        },
        body: payload
      })

      if (response.status === 401) {
        console.log('✅ Invalid signature correctly rejected')
      } else {
        console.log(`⚠️  Expected 401 for invalid signature, got ${response.status}`)
      }

    } catch (error) {
      console.log(`❌ Error testing invalid signature: ${(error as Error).message}`)
    }
  }

  async testDuplicateEvents(): Promise<void> {
    console.log('🧪 Testing duplicate event handling...')
    
    const event = this.createTestEvent('customer_transfer_completed')
    
    // Send the same event twice
    const result1 = await this.sendTestWebhook(event)
    await new Promise(resolve => setTimeout(resolve, 100))
    const result2 = await this.sendTestWebhook(event)
    
    console.log(`First request: ${result1.success ? 'Success' : 'Failed'}`)
    console.log(`Second request: ${result2.success ? 'Success' : 'Failed'}`)
    
    if (result1.success && result2.success) {
      console.log('✅ Both requests accepted (duplicate handling should occur in processing)')
    } else {
      console.log('⚠️  One or both requests failed')
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  
  try {
    const tester = new WebhookTester()
    
    switch (command) {
      case 'suite':
        await tester.runTestSuite()
        break
        
      case 'event':
        const eventType = args[1]
        const resourceId = args[2]
        if (!eventType) {
          console.log('Usage: npm run test:webhook event <event-type> [resource-id]')
          process.exit(1)
        }
        await tester.testSpecificEvent(eventType, resourceId)
        break
        
      case 'signature':
        await tester.testInvalidSignature()
        break
        
      case 'duplicates':
        await tester.testDuplicateEvents()
        break
        
      default:
        console.log('Webhook Test Commands:')
        console.log('  suite      - Run complete test suite')
        console.log('  event      - Test specific event type')
        console.log('  signature  - Test invalid signature handling')
        console.log('  duplicates - Test duplicate event handling')
        console.log('')
        console.log('Examples:')
        console.log('  tsx scripts/test-webhook-comprehensive.ts suite')
        console.log('  tsx scripts/test-webhook-comprehensive.ts event customer_transfer_completed')
        console.log('  tsx scripts/test-webhook-comprehensive.ts signature')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
} 