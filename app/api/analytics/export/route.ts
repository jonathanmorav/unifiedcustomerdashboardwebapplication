import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { formatISO } from 'date-fns'

/**
 * GET /api/analytics/export - Export analytics data
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const type = searchParams.get('type') || 'overview'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Default to last 7 days if no date range specified
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    
    let data: any
    let filename: string
    
    switch (type) {
      case 'events':
        data = await exportEventData(start, end)
        filename = `webhook-events-${formatISO(start, { representation: 'date' })}-to-${formatISO(end, { representation: 'date' })}`
        break
        
      case 'journeys':
        data = await exportJourneyData(start, end)
        filename = `journey-analytics-${formatISO(start, { representation: 'date' })}-to-${formatISO(end, { representation: 'date' })}`
        break
        
      case 'reconciliation':
        data = await exportReconciliationData(start, end)
        filename = `reconciliation-report-${formatISO(start, { representation: 'date' })}-to-${formatISO(end, { representation: 'date' })}`
        break
        
      case 'overview':
      default:
        data = await exportOverviewData(start, end)
        filename = `webhook-analytics-overview-${formatISO(start, { representation: 'date' })}-to-${formatISO(end, { representation: 'date' })}`
        break
    }
    
    if (format === 'json') {
      return NextResponse.json(data, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      })
    }
    
    // Convert to CSV
    const csv = convertToCSV(data, type)
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`
      }
    })
    
  } catch (error) {
    log.error('Export failed', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Export failed'
      },
      { status: 500 }
    )
  }
}

async function exportEventData(startDate: Date, endDate: Date) {
  const events = await prisma.webhookEvent.findMany({
    where: {
      eventTimestamp: { gte: startDate, lte: endDate }
    },
    orderBy: { eventTimestamp: 'desc' },
    take: 10000 // Limit to prevent memory issues
  })
  
  return events.map(event => ({
    id: event.id,
    eventId: event.eventId,
    eventType: event.eventType,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    timestamp: event.eventTimestamp,
    processingState: event.processingState,
    processingDuration: event.processingDurationMs,
    error: event.lastProcessingError
  }))
}

async function exportJourneyData(startDate: Date, endDate: Date) {
  const journeys = await prisma.journeyInstance.findMany({
    where: {
      startTime: { gte: startDate, lte: endDate }
    },
    include: {
      definition: true,
      steps: true
    },
    orderBy: { startTime: 'desc' },
    take: 5000
  })
  
  return journeys.map(journey => ({
    id: journey.id,
    journeyType: journey.definition.name,
    resourceType: journey.resourceType,
    resourceId: journey.resourceId,
    status: journey.status,
    startTime: journey.startTime,
    endTime: journey.endTime,
    duration: journey.totalDurationMs,
    progress: journey.progressPercentage,
    steps: journey.steps.length,
    completedSteps: journey.completedSteps.length
  }))
}

async function exportReconciliationData(startDate: Date, endDate: Date) {
  const runs = await prisma.reconciliationRun.findMany({
    where: {
      startTime: { gte: startDate, lte: endDate }
    },
    include: {
      discrepancies: true
    },
    orderBy: { startTime: 'desc' }
  })
  
  const flatData: any[] = []
  
  for (const run of runs) {
    const metrics = run.metrics as any
    
    // Add run summary
    flatData.push({
      type: 'run_summary',
      runId: run.id,
      startTime: run.startTime,
      endTime: run.endTime,
      status: run.status,
      totalChecks: metrics?.totalChecks || 0,
      discrepanciesFound: metrics?.discrepanciesFound || 0,
      discrepanciesResolved: metrics?.discrepanciesResolved || 0
    })
    
    // Add discrepancies
    for (const discrepancy of run.discrepancies) {
      flatData.push({
        type: 'discrepancy',
        runId: run.id,
        discrepancyId: discrepancy.id,
        resourceType: discrepancy.resourceType,
        resourceId: discrepancy.resourceId,
        checkName: discrepancy.checkName,
        severity: discrepancy.severity,
        resolved: discrepancy.resolved,
        detectedAt: discrepancy.detectedAt,
        resolvedAt: discrepancy.resolvedAt
      })
    }
  }
  
  return flatData
}

async function exportOverviewData(startDate: Date, endDate: Date) {
  // Get aggregated metrics
  const [
    eventStats,
    journeyStats,
    reconciliationStats,
    anomalyStats
  ] = await Promise.all([
    // Event statistics
    prisma.webhookEvent.groupBy({
      by: ['eventType', 'processingState'],
      where: {
        eventTimestamp: { gte: startDate, lte: endDate }
      },
      _count: true
    }),
    
    // Journey statistics
    prisma.journeyInstance.groupBy({
      by: ['status'],
      where: {
        startTime: { gte: startDate, lte: endDate }
      },
      _count: true,
      _avg: { totalDurationMs: true }
    }),
    
    // Reconciliation statistics
    prisma.reconciliationRun.aggregate({
      where: {
        startTime: { gte: startDate, lte: endDate }
      },
      _count: true
    }),
    
    // Anomaly statistics
    prisma.eventAnomaly.groupBy({
      by: ['severity', 'resolved'],
      where: {
        detectedAt: { gte: startDate, lte: endDate }
      },
      _count: true
    })
  ])
  
  return {
    dateRange: {
      start: startDate,
      end: endDate
    },
    eventStatistics: eventStats,
    journeyStatistics: journeyStats,
    reconciliationCount: reconciliationStats._count,
    anomalyStatistics: anomalyStats
  }
}

function convertToCSV(data: any, type: string): string {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return 'No data available for export'
  }
  
  if (type === 'overview') {
    // Special handling for overview data
    const lines: string[] = ['Webhook Analytics Overview Report']
    lines.push('')
    lines.push(`Date Range: ${data.dateRange.start} to ${data.dateRange.end}`)
    lines.push('')
    
    // Event statistics
    lines.push('Event Statistics')
    lines.push('Event Type,Processing State,Count')
    data.eventStatistics.forEach((stat: any) => {
      lines.push(`${stat.eventType},${stat.processingState},${stat._count}`)
    })
    lines.push('')
    
    // Journey statistics
    lines.push('Journey Statistics')
    lines.push('Status,Count,Average Duration (ms)')
    data.journeyStatistics.forEach((stat: any) => {
      lines.push(`${stat.status},${stat._count},${stat._avg.totalDurationMs || 0}`)
    })
    lines.push('')
    
    // Anomaly statistics
    lines.push('Anomaly Statistics')
    lines.push('Severity,Resolved,Count')
    data.anomalyStatistics.forEach((stat: any) => {
      lines.push(`${stat.severity},${stat.resolved},${stat._count}`)
    })
    
    return lines.join('\n')
  }
  
  // Standard array to CSV conversion
  if (!Array.isArray(data)) {
    data = [data]
  }
  
  if (data.length === 0) {
    return 'No data available'
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0])
  const lines = [headers.join(',')]
  
  // Add data rows
  data.forEach((row: any) => {
    const values = headers.map(header => {
      const value = row[header]
      // Handle special values
      if (value === null || value === undefined) return ''
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'object') return JSON.stringify(value)
      // Escape values containing commas
      if (String(value).includes(',')) return `"${value}"`
      return value
    })
    lines.push(values.join(','))
  })
  
  return lines.join('\n')
}