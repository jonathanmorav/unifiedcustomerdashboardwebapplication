import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/metrics-v2 - Fixed metrics endpoint with proper error handling
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    // Initialize metrics with defaults
    const metrics = {
      totalEvents: 0,
      eventsPerMinute: 0,
      processingRate: 100,
      avgLatency: 0,
      errorRate: 0,
      activeJourneys: 0,
      journeySuccessRate: 100,
      avgJourneyDuration: 0,
      stuckJourneys: 0,
      pendingReconciliations: 0,
      discrepancyRate: 0,
      autoResolvedCount: 0,
      activeAnomalies: 0,
      criticalAnomalies: 0,
      eventsByType: {} as Record<string, number>,
      transferVolume: 0,
      customerEvents: 0
    }
    
    // Try to get real-time engine dashboard
    let dashboard = null
    try {
      const { getRealtimeAnalyticsEngine } = await import('@/lib/analytics/realtime-engine')
      const engine = getRealtimeAnalyticsEngine()
      dashboard = engine.getDashboard()
    } catch (e) {
      log.warn('Real-time engine not available', e as Error)
    }
    
    // Get basic counts (these should rarely fail)
    try {
      const [totalEvents, recentEvents, activeJourneys, pendingReconciliations, activeAnomalies] = 
        await Promise.all([
          prisma.webhookEvent.count(),
          prisma.webhookEvent.count({
            where: { eventTimestamp: { gte: oneHourAgo } }
          }),
          prisma.journeyInstance.count({
            where: { status: 'active' }
          }),
          prisma.reconciliationCheck.count({
            where: { status: 'pending' }
          }),
          prisma.webhookAnomaly.count({
            where: { status: 'active' }
          })
        ])
      
      metrics.totalEvents = totalEvents
      metrics.eventsPerMinute = Math.round((recentEvents / 60) * 100) / 100
      metrics.activeJourneys = activeJourneys
      metrics.pendingReconciliations = pendingReconciliations
      metrics.activeAnomalies = activeAnomalies
    } catch (e) {
      log.error('Failed to get basic counts', e as Error)
    }
    
    // Get processing metrics
    try {
      const [successfulEvents, failedEvents] = await Promise.all([
        prisma.webhookEvent.count({
          where: {
            processingState: 'completed',
            eventTimestamp: { gte: oneDayAgo }
          }
        }),
        prisma.webhookEvent.count({
          where: {
            processingState: 'failed',
            eventTimestamp: { gte: oneDayAgo }
          }
        })
      ])
      
      const totalProcessed = successfulEvents + failedEvents
      if (totalProcessed > 0) {
        metrics.processingRate = Math.round((successfulEvents / totalProcessed) * 100 * 100) / 100
        metrics.errorRate = Math.round((failedEvents / totalProcessed) * 100 * 100) / 100
      }
    } catch (e) {
      log.error('Failed to get processing metrics', e as Error)
    }
    
    // Get processing latency
    try {
      const latencyData = await prisma.webhookEvent.aggregate({
        where: {
          processingState: 'completed',
          processingDurationMs: { not: null }
        },
        _avg: { processingDurationMs: true }
      })
      
      if (latencyData._avg.processingDurationMs) {
        metrics.avgLatency = Math.round(latencyData._avg.processingDurationMs)
      }
    } catch (e) {
      log.error('Failed to get latency metrics', e as Error)
    }
    
    // Get journey metrics
    try {
      const [completedJourneys, failedJourneys, stuckJourneys] = await Promise.all([
        prisma.journeyInstance.count({
          where: {
            status: 'completed',
            endTime: { gte: oneDayAgo }
          }
        }),
        prisma.journeyInstance.count({
          where: {
            status: 'failed',
            endTime: { gte: oneDayAgo }
          }
        }),
        prisma.journeyInstance.count({
          where: { status: 'stuck' }
        })
      ])
      
      const totalJourneys = completedJourneys + failedJourneys
      if (totalJourneys > 0) {
        metrics.journeySuccessRate = Math.round((completedJourneys / totalJourneys) * 100 * 100) / 100
      }
      metrics.stuckJourneys = stuckJourneys
    } catch (e) {
      log.error('Failed to get journey metrics', e as Error)
    }
    
    // Get journey duration (handle BigInt)
    try {
      const durationData = await prisma.journeyInstance.findMany({
        where: {
          status: 'completed',
          totalDurationMs: { not: null }
        },
        select: { totalDurationMs: true },
        take: 100
      })
      
      if (durationData.length > 0) {
        const durations = durationData.map(d => Number(d.totalDurationMs))
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
        metrics.avgJourneyDuration = Math.round(avgDuration)
      }
    } catch (e) {
      log.error('Failed to get journey duration', e as Error)
    }
    
    // Get critical anomalies
    try {
      metrics.criticalAnomalies = await prisma.webhookAnomaly.count({
        where: {
          status: 'active',
          severity: 'critical'
        }
      })
    } catch (e) {
      log.error('Failed to get critical anomalies', e as Error)
    }
    
    // Get event breakdown
    try {
      const eventBreakdown = await prisma.webhookEvent.groupBy({
        by: ['eventType'],
        where: { eventTimestamp: { gte: oneDayAgo } },
        _count: true,
        orderBy: {
          _count: {
            eventType: 'desc'
          }
        },
        take: 10
      })
      
      const eventsByType: Record<string, number> = {}
      eventBreakdown.forEach(item => {
        eventsByType[item.eventType] = item._count
      })
      metrics.eventsByType = eventsByType
    } catch (e) {
      log.error('Failed to get event breakdown', e as Error)
    }
    
    // Get customer events
    try {
      metrics.customerEvents = await prisma.webhookEvent.count({
        where: {
          resourceType: 'customer',
          eventTimestamp: { gte: oneDayAgo }
        }
      })
    } catch (e) {
      log.error('Failed to get customer events', e as Error)
    }
    
    // Add dashboard data if available
    if (dashboard) {
      Object.assign(metrics, {
        systemHealth: dashboard.systemHealth,
        journeyStats: dashboard.journeyStats,
        alerts: dashboard.alerts
      })
    }
    
    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date()
    })
    
  } catch (error) {
    log.error('Failed to get analytics metrics', error as Error)
    
    // Return default metrics even on error
    return NextResponse.json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to get metrics',
      metrics: {
        totalEvents: 0,
        eventsPerMinute: 0,
        processingRate: 100,
        avgLatency: 0,
        errorRate: 0,
        activeJourneys: 0,
        journeySuccessRate: 100,
        avgJourneyDuration: 0,
        stuckJourneys: 0,
        pendingReconciliations: 0,
        discrepancyRate: 0,
        autoResolvedCount: 0,
        activeAnomalies: 0,
        criticalAnomalies: 0,
        eventsByType: {},
        transferVolume: 0,
        customerEvents: 0
      },
      timestamp: new Date()
    })
  }
}