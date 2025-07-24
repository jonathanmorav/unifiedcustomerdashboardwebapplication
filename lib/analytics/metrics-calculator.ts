import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import { WebhookEvent, EventMetric, Prisma } from '@/lib/generated/prisma'

interface MetricDefinition {
  name: string
  description: string
  aggregationType: 'count' | 'rate' | 'average' | 'sum' | 'max' | 'min'
  windowSizeMinutes: number
  dimensions: string[]
  filters?: Record<string, any>
}

// Define all real-time metrics
export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Event volume metrics
  {
    name: 'webhook_events_per_minute',
    description: 'Number of webhook events received per minute',
    aggregationType: 'count',
    windowSizeMinutes: 1,
    dimensions: ['eventType', 'resourceType']
  },
  {
    name: 'webhook_events_per_hour',
    description: 'Number of webhook events received per hour',
    aggregationType: 'count',
    windowSizeMinutes: 60,
    dimensions: ['eventType', 'resourceType']
  },
  
  // Transfer metrics
  {
    name: 'transfer_success_rate',
    description: 'Percentage of successful transfers',
    aggregationType: 'rate',
    windowSizeMinutes: 60,
    dimensions: ['direction'],
    filters: { resourceType: 'transfer' }
  },
  {
    name: 'transfer_failure_rate',
    description: 'Percentage of failed transfers',
    aggregationType: 'rate',
    windowSizeMinutes: 60,
    dimensions: ['failureCategory'],
    filters: { resourceType: 'transfer' }
  },
  {
    name: 'average_transfer_amount',
    description: 'Average transfer amount',
    aggregationType: 'average',
    windowSizeMinutes: 60,
    dimensions: ['direction'],
    filters: { resourceType: 'transfer' }
  },
  {
    name: 'total_transfer_volume',
    description: 'Total transfer volume',
    aggregationType: 'sum',
    windowSizeMinutes: 60,
    dimensions: ['direction'],
    filters: { resourceType: 'transfer' }
  },
  
  // Customer metrics
  {
    name: 'customer_activation_rate',
    description: 'Rate of customer activations',
    aggregationType: 'count',
    windowSizeMinutes: 1440, // 24 hours
    dimensions: ['verificationStatus'],
    filters: { eventType: 'customer_activated' }
  },
  {
    name: 'customer_verification_time',
    description: 'Average time to verify customers',
    aggregationType: 'average',
    windowSizeMinutes: 1440,
    dimensions: ['verificationType'],
    filters: { resourceType: 'customer' }
  },
  
  // Journey metrics
  {
    name: 'journey_completion_rate',
    description: 'Percentage of completed journeys',
    aggregationType: 'rate',
    windowSizeMinutes: 1440,
    dimensions: ['journeyType']
  },
  {
    name: 'journey_abandonment_rate',
    description: 'Percentage of abandoned journeys',
    aggregationType: 'rate',
    windowSizeMinutes: 1440,
    dimensions: ['journeyType', 'abandonmentReason']
  },
  
  // Return metrics
  {
    name: 'ach_return_rate',
    description: 'ACH return rate by return code',
    aggregationType: 'rate',
    windowSizeMinutes: 1440,
    dimensions: ['returnCode'],
    filters: { eventType: 'transfer_returned' }
  },
  {
    name: 'return_volume_by_code',
    description: 'Volume of returns by return code',
    aggregationType: 'sum',
    windowSizeMinutes: 1440,
    dimensions: ['returnCode'],
    filters: { eventType: 'transfer_returned' }
  }
]

export class MetricsCalculator {
  async calculateMetrics(event: WebhookEvent): Promise<void> {
    try {
      // Calculate metrics for applicable definitions
      const applicableMetrics = METRIC_DEFINITIONS.filter(def => 
        this.isMetricApplicable(def, event)
      )
      
      for (const definition of applicableMetrics) {
        await this.calculateMetric(definition, event)
      }
      
    } catch (error) {
      log.error('Metrics calculation error', error as Error, {
        eventId: event.id,
        eventType: event.eventType
      })
    }
  }
  
  private isMetricApplicable(definition: MetricDefinition, event: WebhookEvent): boolean {
    if (!definition.filters) return true
    
    // Check all filter conditions
    for (const [key, value] of Object.entries(definition.filters)) {
      const eventValue = (event as any)[key] || (event.payload as any)[key]
      if (eventValue !== value) return false
    }
    
    return true
  }
  
  private async calculateMetric(
    definition: MetricDefinition,
    event: WebhookEvent
  ): Promise<void> {
    const windowStart = new Date(
      Date.now() - definition.windowSizeMinutes * 60 * 1000
    )
    
    // Get dimension values for this event
    const dimensions = this.extractDimensions(definition, event)
    
    // Calculate the metric value
    const value = await this.calculateValue(
      definition,
      event,
      windowStart,
      dimensions
    )
    
    if (value === null) return
    
    // Store the metric
    await this.storeMetric(definition, value, dimensions, event.eventTimestamp)
  }
  
  private extractDimensions(
    definition: MetricDefinition,
    event: WebhookEvent
  ): Record<string, string> {
    const dimensions: Record<string, string> = {}
    
    for (const dim of definition.dimensions) {
      // Try event properties first
      let value = (event as any)[dim]
      
      // Then try payload
      if (!value && event.payload) {
        value = (event.payload as any)[dim]
      }
      
      // Special dimension extractors
      if (!value) {
        value = this.extractSpecialDimension(dim, event)
      }
      
      if (value) {
        dimensions[dim] = String(value)
      }
    }
    
    return dimensions
  }
  
  private extractSpecialDimension(dimension: string, event: WebhookEvent): string | null {
    const payload = event.payload as any
    
    switch (dimension) {
      case 'direction':
        // Infer from event type or payload
        if (event.eventType.includes('debit')) return 'debit'
        if (event.eventType.includes('credit')) return 'credit'
        if (payload.direction) return payload.direction
        return 'unknown'
        
      case 'failureCategory':
        // Categorize failure reasons
        if (payload.code?.startsWith('R01')) return 'insufficient_funds'
        if (payload.code?.startsWith('R02')) return 'account_closed'
        if (payload.code?.startsWith('R03')) return 'no_account'
        if (payload.code?.startsWith('R')) return 'ach_return'
        return 'other'
        
      case 'verificationStatus':
        if (event.eventType.includes('verified')) return 'verified'
        if (event.eventType.includes('suspended')) return 'suspended'
        if (event.eventType.includes('retry')) return 'retry'
        return 'unverified'
        
      case 'journeyType':
        // This would come from journey context
        return 'unknown'
        
      case 'returnCode':
        return payload.code || payload.returnCode || 'unknown'
        
      default:
        return null
    }
  }
  
  private async calculateValue(
    definition: MetricDefinition,
    event: WebhookEvent,
    windowStart: Date,
    dimensions: Record<string, string>
  ): Promise<number | null> {
    switch (definition.aggregationType) {
      case 'count':
        return 1 // Each event contributes 1
        
      case 'rate':
        return await this.calculateRate(definition, windowStart, dimensions)
        
      case 'average':
        return this.extractNumericValue(event)
        
      case 'sum':
        return this.extractNumericValue(event) || 0
        
      case 'max':
      case 'min':
        return this.extractNumericValue(event)
        
      default:
        return null
    }
  }
  
  private async calculateRate(
    definition: MetricDefinition,
    windowStart: Date,
    dimensions: Record<string, string>
  ): Promise<number> {
    // For rates, we need to look at success vs total
    const whereClause: any = {
      createdAt: { gte: windowStart }
    }
    
    // Add dimension filters
    for (const [key, value] of Object.entries(dimensions)) {
      whereClause[`payload.${key}`] = value
    }
    
    // Count success events
    const successCount = await prisma.webhookEvent.count({
      where: {
        ...whereClause,
        eventType: { contains: 'completed' }
      }
    })
    
    // Count total events
    const totalCount = await prisma.webhookEvent.count({
      where: whereClause
    })
    
    return totalCount > 0 ? (successCount / totalCount) * 100 : 0
  }
  
  private extractNumericValue(event: WebhookEvent): number | null {
    const payload = event.payload as any
    
    // Try common numeric fields
    const value = payload.amount || payload.value || payload.total
    
    if (value && typeof value === 'object' && value.value) {
      // Handle Dwolla amount objects
      return parseFloat(value.value)
    }
    
    return value ? parseFloat(value) : null
  }
  
  private async storeMetric(
    definition: MetricDefinition,
    value: number,
    dimensions: Record<string, string>,
    timestamp: Date
  ): Promise<void> {
    try {
      await prisma.eventMetric.create({
        data: {
          name: definition.name,
          value,
          aggregationType: definition.aggregationType,
          dimensions,
          windowSizeMinutes: definition.windowSizeMinutes,
          timestamp,
          metadata: {
            description: definition.description,
            calculatedAt: new Date()
          }
        }
      })
    } catch (error) {
      // Handle unique constraint violations gracefully
      if ((error as any).code === 'P2002') {
        // Metric already exists for this time window
        log.debug('Metric already exists', {
          metric: definition.name,
          dimensions
        })
      } else {
        throw error
      }
    }
  }
  
  // Aggregation methods for dashboard queries
  async getMetricTimeSeries(
    metricName: string,
    startTime: Date,
    endTime: Date,
    dimensions?: Record<string, string>
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const where: Prisma.EventMetricWhereInput = {
      name: metricName,
      timestamp: { gte: startTime, lte: endTime }
    }
    
    if (dimensions) {
      where.dimensions = { equals: dimensions }
    }
    
    const metrics = await prisma.eventMetric.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        value: true
      }
    })
    
    return metrics
  }
  
  async getMetricSummary(
    metricName: string,
    timeRange: number // minutes
  ): Promise<{
    current: number
    previous: number
    change: number
    trend: 'up' | 'down' | 'stable'
  }> {
    const now = new Date()
    const currentStart = new Date(now.getTime() - timeRange * 60 * 1000)
    const previousStart = new Date(currentStart.getTime() - timeRange * 60 * 1000)
    
    // Get current period metrics
    const currentMetrics = await prisma.eventMetric.aggregate({
      where: {
        name: metricName,
        timestamp: { gte: currentStart, lte: now }
      },
      _avg: { value: true }
    })
    
    // Get previous period metrics
    const previousMetrics = await prisma.eventMetric.aggregate({
      where: {
        name: metricName,
        timestamp: { gte: previousStart, lt: currentStart }
      },
      _avg: { value: true }
    })
    
    const current = currentMetrics._avg.value || 0
    const previous = previousMetrics._avg.value || 0
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0
    
    return {
      current,
      previous,
      change,
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
    }
  }
}

// Singleton instance
let calculator: MetricsCalculator | null = null

export function getMetricsCalculator(): MetricsCalculator {
  if (!calculator) {
    calculator = new MetricsCalculator()
  }
  return calculator
}