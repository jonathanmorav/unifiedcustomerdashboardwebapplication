import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { DwollaClient } from '@/lib/api/dwolla/client'
import { getWebhookReceiver } from '@/lib/webhooks/receiver'

/**
 * POST /api/webhooks/dwolla/sync - Sync historical webhooks from Dwolla
 * GET /api/webhooks/dwolla/sync - Get webhook subscription status
 */

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const body = await request.json()
    const { startDate, endDate, limit = 100 } = body
    
    // Initialize Dwolla client
    const dwollaClient = new DwollaClient()
    const receiver = getWebhookReceiver()
    
    // Get webhook subscriptions
    const subscriptions = await dwollaClient.getWebhookSubscriptions()
    
    log.info('Fetching Dwolla webhooks', {
      startDate,
      endDate,
      limit,
      subscriptions: subscriptions.length
    })
    
    // Get webhook events from Dwolla
    const webhookEvents = await dwollaClient.getWebhookEvents({
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    })
    
    log.info(`Found ${webhookEvents.length} webhook events to sync`)
    
    // Process each webhook event
    let processed = 0
    let errors = 0
    const results = []
    
    for (const webhookEvent of webhookEvents) {
      try {
        // Check if event already exists
        const existing = await prisma.webhookEvent.findUnique({
          where: { eventId: webhookEvent.id }
        })
        
        if (existing) {
          log.debug('Webhook event already exists', { eventId: webhookEvent.id })
          continue
        }
        
        // Create webhook event record
        const event = await prisma.webhookEvent.create({
          data: {
            eventId: webhookEvent.id,
            eventType: webhookEvent.topic,
            topic: webhookEvent.topic,
            partitionKey: webhookEvent.id,
            resourceType: extractResourceType(webhookEvent.topic),
            resourceId: extractResourceId(webhookEvent._links?.resource?.href),
            eventTimestamp: new Date(webhookEvent.created),
            payload: webhookEvent,
            signature: 'historical-sync', // Mark as historical
            processingState: 'queued'
          }
        })
        
        results.push({
          eventId: event.eventId,
          eventType: event.eventType,
          status: 'synced'
        })
        
        processed++
      } catch (error) {
        log.error('Failed to sync webhook event', error as Error, {
          eventId: webhookEvent.id
        })
        errors++
        
        results.push({
          eventId: webhookEvent.id,
          eventType: webhookEvent.topic,
          status: 'error',
          error: (error as Error).message
        })
      }
    }
    
    // Trigger processing of queued events
    if (processed > 0) {
      // Process in background
      setTimeout(() => {
        processQueuedEvents().catch(err => {
          log.error('Failed to process queued events', err)
        })
      }, 1000)
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        total: webhookEvents.length,
        processed,
        errors,
        subscriptions: subscriptions.length
      },
      results: results.slice(0, 20), // Return first 20 for UI
      message: `Successfully synced ${processed} webhook events`
    })
    
  } catch (error) {
    log.error('Webhook sync failed', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync webhooks'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const dwollaClient = new DwollaClient()
    
    // Get webhook subscriptions
    const subscriptions = await dwollaClient.getWebhookSubscriptions()
    
    // Get recent webhook stats
    const recentWebhooks = await prisma.webhookEvent.groupBy({
      by: ['eventType'],
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      _count: true
    })
    
    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        url: sub.url,
        created: sub.created,
        paused: sub.paused
      })),
      recentActivity: recentWebhooks,
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2`
    })
    
  } catch (error) {
    log.error('Failed to get webhook status', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get webhook status'
      },
      { status: 500 }
    )
  }
}

function extractResourceType(topic: string): string {
  if (topic.includes('customer')) return 'customer'
  if (topic.includes('transfer')) return 'transfer'
  if (topic.includes('funding')) return 'funding_source'
  if (topic.includes('micro-deposits')) return 'micro_deposits'
  if (topic.includes('bank')) return 'bank_transfer'
  return 'unknown'
}

function extractResourceId(resourceUrl?: string): string | null {
  if (!resourceUrl) return null
  
  const patterns = [
    /customers\/([a-zA-Z0-9-]+)/,
    /transfers\/([a-zA-Z0-9-]+)/,
    /funding-sources\/([a-zA-Z0-9-]+)/,
    /bank-transfers\/([a-zA-Z0-9-]+)/
  ]
  
  for (const pattern of patterns) {
    const match = resourceUrl.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

async function processQueuedEvents(): Promise<void> {
  const { getQueueProcessor } = await import('@/lib/webhooks/queue-processor')
  const processor = getQueueProcessor()
  processor.start(5000) // Process every 5 seconds
  
  // Stop after 1 minute
  setTimeout(() => {
    processor.stop()
  }, 60000)
}