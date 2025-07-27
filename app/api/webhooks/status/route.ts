import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { prisma } from '@/lib/db'
import { DwollaClient } from '@/lib/api/dwolla/client'
import { getQueueProcessor } from '@/lib/webhooks/queue-processor'
import { log } from '@/lib/logger'

interface WebhookStatusResponse {
  environment: {
    hasWebhookSecret: boolean
    hasBaseUrl: boolean
    webhookUrl: string | null
    queueProcessorRunning: boolean
  }
  subscription: {
    exists: boolean
    id?: string
    url?: string
    paused?: boolean
    created?: string
  } | null
  recentActivity: {
    last24Hours: number
    last7Days: number
    successRate: number
    averageProcessingTime: number
  }
  queueStatus: {
    pending: number
    processing: number
    failed: number
    quarantined: number
  }
  eventTypes: Array<{
    eventType: string
    count: number
    lastReceived: string | null
  }>
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const webhookUrl = process.env.NEXTAUTH_URL 
      ? `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2` 
      : null
    
    // Check environment configuration
    const environment = {
      hasWebhookSecret: !!process.env.DWOLLA_WEBHOOK_SECRET,
      hasBaseUrl: !!process.env.NEXTAUTH_URL,
      webhookUrl,
      queueProcessorRunning: getQueueProcessor().isActive()
    }
    
    // Check webhook subscription
    let subscription = null
    try {
      const dwollaClient = new DwollaClient()
      const subscriptions = await dwollaClient.getWebhookSubscriptions()
      
      if (webhookUrl) {
        const existingSubscription = subscriptions.find((sub: any) => sub.url === webhookUrl)
        if (existingSubscription) {
          subscription = {
            exists: true,
            id: existingSubscription.id,
            url: existingSubscription.url,
            paused: existingSubscription.paused,
            created: existingSubscription.created
          }
        }
      }
      
      if (!subscription) {
        subscription = { exists: false }
      }
    } catch (error) {
      log.error('Failed to check webhook subscription', error as Error)
      subscription = null
    }
    
    // Get recent activity metrics
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const [
      events24h,
      events7d,
      successfulEvents,
      processingTimes,
      queueCounts,
      eventTypeCounts
    ] = await Promise.all([
      // Events in last 24 hours
      prisma.webhookEvent.count({
        where: { createdAt: { gte: last24Hours } }
      }),
      
      // Events in last 7 days
      prisma.webhookEvent.count({
        where: { createdAt: { gte: last7Days } }
      }),
      
      // Successful events for success rate
      prisma.webhookEvent.count({
        where: {
          createdAt: { gte: last24Hours },
          processingState: 'completed'
        }
      }),
      
      // Processing times for average
      prisma.webhookEvent.findMany({
        where: {
          createdAt: { gte: last24Hours },
          processingDurationMs: { not: null }
        },
        select: { processingDurationMs: true }
      }),
      
      // Queue status
      prisma.webhookEvent.groupBy({
        by: ['processingState'],
        _count: true,
        where: {
          processingState: { in: ['queued', 'processing', 'failed', 'quarantined'] }
        }
      }),
      
      // Event type breakdown
      prisma.webhookEvent.groupBy({
        by: ['eventType'],
        _count: true,
        _max: { createdAt: true },
        where: { createdAt: { gte: last7Days } },
        orderBy: { _count: { eventType: 'desc' } },
        take: 10
      })
    ])
    
    // Calculate metrics
    const successRate = events24h > 0 ? (successfulEvents / events24h) * 100 : 100
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, event) => sum + (event.processingDurationMs || 0), 0) / processingTimes.length
      : 0
    
    const queueStatus = {
      pending: 0,
      processing: 0,
      failed: 0,
      quarantined: 0
    }
    
    queueCounts.forEach(item => {
      queueStatus[item.processingState as keyof typeof queueStatus] = item._count
    })
    
    const eventTypes = eventTypeCounts.map(item => ({
      eventType: item.eventType,
      count: item._count,
      lastReceived: item._max.createdAt?.toISOString() || null
    }))
    
    const recentActivity = {
      last24Hours: events24h,
      last7Days: events7d,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime)
    }
    
    const response: WebhookStatusResponse = {
      environment,
      subscription,
      recentActivity,
      queueStatus,
      eventTypes
    }
    
    return NextResponse.json({
      success: true,
      data: response
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

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const body = await request.json()
    const { action } = body
    
    switch (action) {
      case 'start_queue_processor':
        getQueueProcessor().start()
        return NextResponse.json({ success: true, message: 'Queue processor started' })
        
      case 'stop_queue_processor':
        getQueueProcessor().stop()
        return NextResponse.json({ success: true, message: 'Queue processor stopped' })
        
      case 'test_webhook_endpoint':
        const webhookUrl = process.env.NEXTAUTH_URL 
          ? `${process.env.NEXTAUTH_URL}/api/webhooks/dwolla/v2` 
          : null
          
        if (!webhookUrl) {
          return NextResponse.json(
            { success: false, error: 'Webhook URL not configured' },
            { status: 400 }
          )
        }
        
        try {
          const response = await fetch(webhookUrl, { method: 'HEAD' })
          return NextResponse.json({
            success: true,
            accessible: response.ok,
            status: response.status
          })
        } catch (error) {
          return NextResponse.json({
            success: true,
            accessible: false,
            error: (error as Error).message
          })
        }
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    log.error('Failed to execute webhook action', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute action'
      },
      { status: 500 }
    )
  }
} 