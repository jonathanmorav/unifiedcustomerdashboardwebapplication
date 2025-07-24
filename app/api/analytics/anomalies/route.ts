import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/anomalies - Get webhook anomalies data
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'active'
    const severity = searchParams.get('severity') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')
    
    // Build where clause
    const whereClause: any = {}
    
    if (status !== 'all') {
      whereClause.status = status
    }
    
    if (severity !== 'all') {
      whereClause.severity = severity
    }
    
    // Get anomalies
    const anomalies = await prisma.webhookAnomaly.findMany({
      where: whereClause,
      orderBy: { detectedAt: 'desc' },
      take: limit,
      include: {
        affectedEvents: {
          take: 5,
          select: {
            id: true,
            eventType: true,
            eventTimestamp: true
          }
        }
      }
    })
    
    // Get summary statistics
    const [activeCount, criticalCount, resolvedToday] = await Promise.all([
      prisma.webhookAnomaly.count({
        where: { status: 'active' }
      }),
      
      prisma.webhookAnomaly.count({
        where: { 
          status: 'active',
          severity: 'critical'
        }
      }),
      
      prisma.webhookAnomaly.count({
        where: {
          status: 'resolved',
          resolvedAt: { 
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ])
    
    // Get anomaly type breakdown
    const typeBreakdown = await prisma.webhookAnomaly.groupBy({
      by: ['anomalyType'],
      where: { status: 'active' },
      _count: true
    })
    
    const anomalyTypes: Record<string, number> = {}
    typeBreakdown.forEach(item => {
      anomalyTypes[item.anomalyType] = item._count
    })
    
    return NextResponse.json({
      success: true,
      summary: {
        activeCount,
        criticalCount,
        resolvedToday,
        anomalyTypes
      },
      anomalies: anomalies.map(anomaly => ({
        id: anomaly.id,
        type: anomaly.anomalyType,
        severity: anomaly.severity,
        status: anomaly.status,
        description: anomaly.description,
        detectedAt: anomaly.detectedAt,
        resolvedAt: anomaly.resolvedAt,
        confidence: anomaly.confidence,
        affectedEventCount: anomaly.affectedEventCount,
        metadata: anomaly.metadata,
        affectedEvents: anomaly.affectedEvents
      }))
    })
    
  } catch (error) {
    log.error('Failed to get anomalies', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get anomalies',
        summary: {
          activeCount: 0,
          criticalCount: 0,
          resolvedToday: 0,
          anomalyTypes: {}
        },
        anomalies: []
      },
      { status: 500 }
    )
  }
}