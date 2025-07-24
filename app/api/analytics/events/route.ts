import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/events - Get event analytics data
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('timeRange') || '24h'
    const eventType = searchParams.get('eventType') || 'all'
    
    // Calculate time range
    let startDate: Date
    const now = new Date()
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '24h':
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    
    // Build where clause
    const whereClause: any = {
      eventTimestamp: { gte: startDate }
    }
    
    if (eventType !== 'all') {
      whereClause.resourceType = eventType
    }
    
    // Get summary statistics
    const [totalEvents, successfulEvents, failedEvents, processingStats] = await Promise.all([
      prisma.webhookEvent.count({ where: whereClause }),
      
      prisma.webhookEvent.count({
        where: {
          ...whereClause,
          processingState: 'completed'
        }
      }),
      
      prisma.webhookEvent.count({
        where: {
          ...whereClause,
          processingState: 'failed'
        }
      }),
      
      prisma.webhookEvent.aggregate({
        where: {
          ...whereClause,
          processingState: 'completed'
        },
        _avg: { processingDurationMs: true }
      })
    ])
    
    const processingRate = totalEvents > 0 
      ? (successfulEvents / totalEvents) * 100 
      : 100
    
    // Get event types breakdown
    const eventTypesData = await prisma.webhookEvent.groupBy({
      by: ['eventType'],
      where: whereClause,
      _count: true
    })
    
    // Get detailed stats for each event type
    const eventTypes = await Promise.all(
      eventTypesData.map(async (type) => {
        const stats = await prisma.webhookEvent.aggregate({
          where: {
            ...whereClause,
            eventType: type.eventType
          },
          _avg: { processingDurationMs: true }
        })
        
        const successCount = await prisma.webhookEvent.count({
          where: {
            ...whereClause,
            eventType: type.eventType,
            processingState: 'completed'
          }
        })
        
        const successRate = type._count > 0 
          ? (successCount / type._count) * 100 
          : 100
        
        // Calculate trend (simplified - comparing to previous period)
        const previousPeriodCount = await prisma.webhookEvent.count({
          where: {
            eventType: type.eventType,
            eventTimestamp: {
              gte: new Date(startDate.getTime() - (now.getTime() - startDate.getTime())),
              lt: startDate
            }
          }
        })
        
        const trend = previousPeriodCount > 0
          ? ((type._count - previousPeriodCount) / previousPeriodCount) * 100
          : 0
        
        return {
          type: type.eventType,
          count: type._count,
          successRate: parseFloat(successRate.toFixed(1)),
          avgProcessingTime: Math.round(stats._avg.processingDurationMs || 0),
          trend: parseFloat(trend.toFixed(1))
        }
      })
    )
    
    // Get recent events
    const recentEvents = await prisma.webhookEvent.findMany({
      where: whereClause,
      orderBy: { eventTimestamp: 'desc' },
      take: 20,
      select: {
        id: true,
        eventType: true,
        resourceType: true,
        resourceId: true,
        processingState: true,
        processingDurationMs: true,
        eventTimestamp: true,
        lastProcessingError: true
      }
    })
    
    // Get hourly volume for chart
    const hourlyData: Record<string, number> = {}
    const events = await prisma.webhookEvent.findMany({
      where: whereClause,
      select: {
        eventTimestamp: true
      }
    })
    
    events.forEach(event => {
      const hour = new Date(event.eventTimestamp)
      hour.setMinutes(0, 0, 0)
      const hourKey = hour.toISOString()
      hourlyData[hourKey] = (hourlyData[hourKey] || 0) + 1
    })
    
    const hourlyVolume = Object.entries(hourlyData)
      .map(([hour, count]) => ({
        hour: new Date(hour).getHours() + ':00',
        count
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
    
    return NextResponse.json({
      summary: {
        totalEvents,
        successfulEvents,
        failedEvents,
        processingRate: parseFloat(processingRate.toFixed(1)),
        avgProcessingTime: Math.round(processingStats._avg.processingDurationMs || 0)
      },
      eventTypes: eventTypes.sort((a, b) => b.count - a.count),
      recentEvents: recentEvents.map(event => ({
        id: event.id,
        eventType: event.eventType,
        resourceType: event.resourceType || 'unknown',
        resourceId: event.resourceId || '',
        status: event.processingState,
        processingTime: event.processingDurationMs || 0,
        timestamp: event.eventTimestamp,
        error: event.lastProcessingError
      })),
      hourlyVolume
    })
    
  } catch (error) {
    log.error('Failed to get event analytics', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get event analytics'
      },
      { status: 500 }
    )
  }
}