import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/metrics-simple - Simplified metrics endpoint for testing
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    // Basic counts only - no aggregations
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
      eventsByType: {},
      transferVolume: 0,
      customerEvents: 0
    }
    
    try {
      // Simple counts that shouldn't fail
      metrics.totalEvents = await prisma.webhookEvent.count()
      metrics.activeJourneys = await prisma.journeyInstance.count({
        where: { status: 'active' }
      })
      metrics.pendingReconciliations = await prisma.reconciliationCheck.count({
        where: { status: 'pending' }
      })
      metrics.activeAnomalies = await prisma.webhookAnomaly.count({
        where: { status: 'active' }
      })
    } catch (dbError) {
      log.error('Database query error', dbError as Error)
    }
    
    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date()
    })
    
  } catch (error) {
    log.error('Failed to get simple metrics', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
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
        }
      },
      { status: 200 } // Return 200 with error in body so UI doesn't break
    )
  }
}