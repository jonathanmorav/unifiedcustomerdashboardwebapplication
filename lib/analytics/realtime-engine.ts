import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import { getMetricsCalculator } from './metrics-calculator'
import { getAnomalyDetector } from './anomaly-detector'
import { ProcessingContext } from '@/lib/webhooks/processing-context'
import type { WebhookEvent } from '@prisma/client'

interface RealtimeMetric {
  name: string
  value: number
  change: number
  trend: 'up' | 'down' | 'stable'
  lastUpdated: Date
}

interface RealtimeDashboard {
  metrics: RealtimeMetric[]
  alerts: Array<{
    severity: string
    message: string
    timestamp: Date
  }>
  journeyStats: {
    activeJourneys: number
    completionRate: number
    averageDuration: number
  }
  systemHealth: {
    eventsPerMinute: number
    processingLatency: number
    errorRate: number
  }
}

export class RealtimeAnalyticsEngine {
  private metricsCalculator = getMetricsCalculator()
  private anomalyDetector = getAnomalyDetector()
  private dashboardCache: Map<string, RealtimeDashboard> = new Map()
  private updateInterval: NodeJS.Timeout | null = null
  
  async processEvent(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    try {
      // Calculate metrics for this event
      await this.metricsCalculator.calculateMetrics(event)
      
      // Check for anomalies
      const recentMetrics = await prisma.eventMetric.findMany({
        where: {
          timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      })
      
      for (const metric of recentMetrics) {
        await this.anomalyDetector.detectAnomalies(metric)
      }
      
      // Update real-time dashboard cache
      await this.updateDashboard()
      
      // Store event analytics
      await this.storeEventAnalytics(event, context)
      
    } catch (error) {
      log.error('Real-time analytics error', error as Error, {
        eventId: event.id
      })
    }
  }
  
  private async storeEventAnalytics(
    event: WebhookEvent,
    context: ProcessingContext
  ): Promise<void> {
    const payload = event.payload as any
    
    // Extract analytics data based on event type
    const analyticsData: any = {
      eventType: event.eventType,
      resourceType: event.resourceType,
      timestamp: event.eventTimestamp
    }
    
    // Add transfer-specific analytics
    if (event.resourceType === 'transfer') {
      analyticsData.amount = payload.amount?.value || 0
      analyticsData.currency = payload.amount?.currency || 'USD'
      analyticsData.direction = this.inferTransferDirection(event)
      analyticsData.status = this.mapEventToStatus(event.eventType)
      
      if (event.eventType === 'transfer_failed' || event.eventType === 'transfer_returned') {
        analyticsData.failureReason = payload.reason
        analyticsData.failureCode = payload.code || payload.returnCode
      }
    }
    
    // Add customer-specific analytics
    if (event.resourceType === 'customer') {
      analyticsData.customerStatus = this.inferCustomerStatus(event)
      analyticsData.verificationType = payload.verificationType
    }
    
    // Add journey context if available
    const journeyData = context.get('journeyData')
    if (journeyData) {
      analyticsData.journeyId = journeyData.id
      analyticsData.journeyType = journeyData.type
      analyticsData.journeyStep = journeyData.currentStep
    }
    
    // Store in a dedicated analytics table (if exists) or as metadata
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        metadata: {
          ...event.metadata,
          analytics: analyticsData
        }
      }
    })
  }
  
  private inferTransferDirection(event: WebhookEvent): string {
    const eventType = event.eventType
    const payload = event.payload as any
    
    if (eventType.includes('debit')) return 'debit'
    if (eventType.includes('credit')) return 'credit'
    if (payload.direction) return payload.direction
    
    // Infer from source/destination
    if (payload.source?.includes('bank')) return 'debit'
    if (payload.destination?.includes('bank')) return 'credit'
    
    return 'unknown'
  }
  
  private mapEventToStatus(eventType: string): string {
    const statusMap: Record<string, string> = {
      'transfer_created': 'pending',
      'transfer_completed': 'completed',
      'transfer_failed': 'failed',
      'transfer_cancelled': 'cancelled',
      'transfer_returned': 'returned'
    }
    
    return statusMap[eventType] || 'unknown'
  }
  
  private inferCustomerStatus(event: WebhookEvent): string {
    const eventType = event.eventType
    
    if (eventType === 'customer_created') return 'created'
    if (eventType === 'customer_activated') return 'activated'
    if (eventType === 'customer_verified') return 'verified'
    if (eventType === 'customer_suspended') return 'suspended'
    if (eventType === 'customer_deactivated') return 'deactivated'
    
    return 'unknown'
  }
  
  async updateDashboard(): Promise<void> {
    try {
      const dashboard: RealtimeDashboard = {
        metrics: await this.getRealtimeMetrics(),
        alerts: await this.getActiveAlerts(),
        journeyStats: await this.getJourneyStats(),
        systemHealth: await this.getSystemHealth()
      }
      
      // Update cache
      this.dashboardCache.set('main', dashboard)
      
      // Emit update event (for WebSocket/SSE)
      this.emitDashboardUpdate(dashboard)
      
    } catch (error) {
      log.error('Dashboard update error', error as Error)
    }
  }
  
  private async getRealtimeMetrics(): Promise<RealtimeMetric[]> {
    const metrics: RealtimeMetric[] = []
    
    // Define key metrics to track
    const keyMetrics = [
      'webhook_events_per_minute',
      'transfer_success_rate',
      'transfer_failure_rate',
      'average_transfer_amount',
      'ach_return_rate'
    ]
    
    for (const metricName of keyMetrics) {
      const summary = await this.metricsCalculator.getMetricSummary(metricName, 60)
      
      metrics.push({
        name: metricName,
        value: summary.current,
        change: summary.change,
        trend: summary.trend,
        lastUpdated: new Date()
      })
    }
    
    return metrics
  }
  
  private async getActiveAlerts(): Promise<Array<{
    severity: string
    message: string
    timestamp: Date
  }>> {
    const anomalies = await prisma.eventAnomaly.findMany({
      where: {
        resolved: false,
        detectedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      },
      orderBy: { severity: 'desc' },
      take: 10
    })
    
    return anomalies.map(anomaly => ({
      severity: anomaly.severity,
      message: anomaly.description,
      timestamp: anomaly.detectedAt
    }))
  }
  
  private async getJourneyStats(): Promise<{
    activeJourneys: number
    completionRate: number
    averageDuration: number
  }> {
    const [activeCount, completedStats] = await Promise.all([
      prisma.journeyInstance.count({
        where: { status: 'active' }
      }),
      prisma.journeyInstance.aggregate({
        where: {
          status: 'completed',
          completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        _count: true,
        _avg: { totalDurationMs: true }
      })
    ])
    
    const totalJourneys = await prisma.journeyInstance.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    
    return {
      activeJourneys: activeCount,
      completionRate: totalJourneys > 0 ? (completedStats._count / totalJourneys) * 100 : 0,
      averageDuration: completedStats._avg.totalDurationMs 
        ? Number(completedStats._avg.totalDurationMs) / (1000 * 60) // Convert to minutes
        : 0
    }
  }
  
  private async getSystemHealth(): Promise<{
    eventsPerMinute: number
    processingLatency: number
    errorRate: number
  }> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    
    const [eventCount, processingStats, errorCount] = await Promise.all([
      prisma.webhookEvent.count({
        where: { createdAt: { gte: oneMinuteAgo } }
      }),
      prisma.webhookEvent.aggregate({
        where: {
          processingState: 'completed',
          processedAt: { gte: oneMinuteAgo }
        },
        _avg: { processingDurationMs: true }
      }),
      prisma.webhookEvent.count({
        where: {
          processingState: 'failed',
          createdAt: { gte: oneMinuteAgo }
        }
      })
    ])
    
    return {
      eventsPerMinute: eventCount,
      processingLatency: processingStats._avg.processingDurationMs || 0,
      errorRate: eventCount > 0 ? (errorCount / eventCount) * 100 : 0
    }
  }
  
  private emitDashboardUpdate(dashboard: RealtimeDashboard): void {
    // In a real implementation, this would emit via WebSocket or SSE
    // For now, just log the update
    log.debug('Dashboard updated', {
      metricsCount: dashboard.metrics.length,
      alertsCount: dashboard.alerts.length,
      activeJourneys: dashboard.journeyStats.activeJourneys
    })
  }
  
  // Public methods for dashboard access
  getDashboard(): RealtimeDashboard | null {
    return this.dashboardCache.get('main') || null
  }
  
  async getMetricHistory(
    metricName: string,
    hours: number = 24
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    const endTime = new Date()
    
    return this.metricsCalculator.getMetricTimeSeries(
      metricName,
      startTime,
      endTime
    )
  }
  
  async getAnomalyHistory(
    hours: number = 24
  ): Promise<Array<{
    id: string
    severity: string
    description: string
    timestamp: Date
    resolved: boolean
  }>> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const anomalies = await prisma.eventAnomaly.findMany({
      where: {
        detectedAt: { gte: startTime }
      },
      orderBy: { detectedAt: 'desc' },
      select: {
        id: true,
        severity: true,
        description: true,
        detectedAt: true,
        resolved: true
      }
    })
    
    return anomalies.map(a => ({
      id: a.id,
      severity: a.severity,
      description: a.description,
      timestamp: a.detectedAt,
      resolved: a.resolved
    }))
  }
  
  // Start periodic updates
  startPeriodicUpdates(intervalMs: number = 30000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
    
    // Initial update
    this.updateDashboard()
    
    // Schedule periodic updates
    this.updateInterval = setInterval(() => {
      this.updateDashboard()
    }, intervalMs)
    
    log.info('Started real-time analytics updates', { intervalMs })
  }
  
  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
      log.info('Stopped real-time analytics updates')
    }
  }
  
  // Cleanup old metrics and anomalies
  async cleanupOldData(retentionDays: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const [metricsDeleted, anomaliesDeleted] = await Promise.all([
      prisma.eventMetric.deleteMany({
        where: { timestamp: { lt: cutoffDate } }
      }),
      prisma.eventAnomaly.deleteMany({
        where: {
          detectedAt: { lt: cutoffDate },
          resolved: true
        }
      })
    ])
    
    log.info('Cleaned up old analytics data', {
      metricsDeleted: metricsDeleted.count,
      anomaliesDeleted: anomaliesDeleted.count,
      cutoffDate
    })
  }
}

// Singleton instance
let engine: RealtimeAnalyticsEngine | null = null

export function getRealtimeAnalyticsEngine(): RealtimeAnalyticsEngine {
  if (!engine) {
    engine = new RealtimeAnalyticsEngine()
  }
  return engine
}