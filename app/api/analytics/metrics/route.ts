import { NextRequest, NextResponse } from 'next/server'
import { getRealtimeAnalyticsEngine } from '@/lib/analytics/realtime-engine'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/metrics - Get webhook analytics metrics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    let engine = null
    let dashboard = null
    
    try {
      engine = getRealtimeAnalyticsEngine()
      dashboard = engine.getDashboard()
    } catch (engineError) {
      log.error('Failed to get realtime engine', engineError as Error)
    }
    
    // Get additional metrics from database
    const [
      totalEvents,
      eventsPerMinute,
      activeJourneys,
      pendingReconciliations,
      activeAnomalies,
    ] = await Promise.all([
      // Total events in last 24 hours
      prisma.webhookEvent.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      
      // Events in last minute
      prisma.webhookEvent.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 1000) }
        }
      }),
      
      // Active journeys
      prisma.journeyInstance.count({
        where: { status: 'active' }
      }),
      
      // Pending reconciliations
      prisma.reconciliationCheck.count({
        where: { status: 'pending' }
      }),
      
      // Active anomalies
      prisma.webhookAnomaly.count({
        where: { 
          status: 'active',
          detectedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
        }
      }),
    ])
    
    // Calculate processing metrics
    const processingMetrics = await prisma.webhookEvent.aggregate({
      where: {
        processingState: 'completed',
        processedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      },
      _avg: { processingDurationMs: true },
      _count: true
    })
    
    const failedCount = await prisma.webhookEvent.count({
      where: {
        processingState: 'failed',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    })
    
    const totalProcessed = (processingMetrics._count?._all || 0) + failedCount
    const processingRate = totalProcessed > 0 
      ? (((processingMetrics._count?._all || 0) / totalProcessed) * 100).toFixed(1)
      : 100
    
    const errorRate = totalProcessed > 0
      ? ((failedCount / totalProcessed) * 100).toFixed(1)
      : 0
      
    // Calculate journey success rate
    const completedJourneys = await prisma.journeyInstance.count({
      where: {
        status: 'completed',
        endTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    
    const totalJourneys = await prisma.journeyInstance.count({
      where: {
        startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    
    const journeySuccessRate = totalJourneys > 0
      ? ((completedJourneys / totalJourneys) * 100).toFixed(1)
      : 0
    
    // Get stuck journeys
    let stuckJourneys = 0
    try {
      stuckJourneys = await prisma.journeyInstance.count({
        where: { status: 'stuck' }
      })
    } catch (e) {
      log.error('Failed to count stuck journeys', e as Error)
    }
    
    // Get journey duration
    let avgJourneyDuration = 0
    try {
      const journeyDuration = await prisma.journeyInstance.aggregate({
        where: {
          status: 'completed',
          totalDurationMs: { not: null }
        },
        _avg: { totalDurationMs: true }
      })
      // Convert BigInt to number safely
      avgJourneyDuration = journeyDuration._avg.totalDurationMs 
        ? Number(journeyDuration._avg.totalDurationMs) 
        : 0
    } catch (e) {
      log.error('Failed to get journey duration', e as Error)
    }
    
    // Get critical anomalies
    const criticalAnomalies = await prisma.webhookAnomaly.count({
      where: { 
        status: 'active',
        severity: 'critical'
      }
    })
    
    // Get event type breakdown
    const eventTypeBreakdown = await prisma.webhookEvent.groupBy({
      by: ['eventType'],
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      _count: true
    })
    
    const eventsByType: Record<string, number> = {}
    eventTypeBreakdown.forEach(item => {
      eventsByType[item.eventType] = item._count
    })
    
    // Get customer and transfer event counts
    const customerEvents = await prisma.webhookEvent.count({
      where: {
        resourceType: 'customer',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    
    const transferEvents = await prisma.webhookEvent.count({
      where: {
        resourceType: 'transfer',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })

    const metrics = {
      totalEvents,
      eventsPerMinute,
      processingRate: parseFloat(processingRate),
      avgLatency: Math.round(processingMetrics._avg.processingDurationMs || 0),
      errorRate: parseFloat(errorRate),
      activeJourneys,
      journeySuccessRate: parseFloat(journeySuccessRate),
      avgJourneyDuration: Math.round(avgJourneyDuration),
      stuckJourneys,
      pendingReconciliations,
      discrepancyRate: 0, // Would need reconciliation stats
      autoResolvedCount: 0, // Would need reconciliation stats
      activeAnomalies,
      criticalAnomalies,
      eventsByType,
      transferVolume: 0, // Would need to calculate from transfer payloads
      customerEvents,
      
      // From real-time dashboard if available
      ...(dashboard && {
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
    
    // Return a more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? (error as Error).message 
      : 'Failed to get metrics'
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      },
      { status: 500 }
    )
  }
}