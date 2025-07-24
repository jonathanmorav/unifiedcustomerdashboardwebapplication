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
    
    const engine = getRealtimeAnalyticsEngine()
    const dashboard = engine.getDashboard()
    
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
      prisma.reconciliationDiscrepancy.count({
        where: { resolved: false }
      }),
      
      // Active anomalies
      prisma.eventAnomaly.count({
        where: { 
          resolved: false,
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
    
    const totalProcessed = processingMetrics._count + failedCount
    const processingRate = totalProcessed > 0 
      ? ((processingMetrics._count / totalProcessed) * 100).toFixed(1)
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
    
    const metrics = {
      totalEvents,
      eventsPerMinute,
      processingRate: parseFloat(processingRate),
      avgLatency: Math.round(processingMetrics._avg.processingDurationMs || 0),
      errorRate: parseFloat(errorRate),
      activeJourneys,
      journeySuccessRate: parseFloat(journeySuccessRate),
      pendingReconciliations,
      activeAnomalies,
      
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
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get metrics'
      },
      { status: 500 }
    )
  }
}