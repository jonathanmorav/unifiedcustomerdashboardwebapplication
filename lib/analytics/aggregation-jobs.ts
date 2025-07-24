import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import { Prisma } from '@/lib/generated/prisma'

interface AggregationConfig {
  name: string
  sourceTable: 'webhookEvent' | 'eventMetric' | 'journeyInstance'
  aggregationType: 'hourly' | 'daily' | 'weekly' | 'monthly'
  dimensions: string[]
  metrics: Array<{
    name: string
    calculation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'rate'
    field?: string
  }>
}

const AGGREGATION_CONFIGS: AggregationConfig[] = [
  // Hourly event aggregations
  {
    name: 'hourly_event_summary',
    sourceTable: 'webhookEvent',
    aggregationType: 'hourly',
    dimensions: ['eventType', 'resourceType'],
    metrics: [
      { name: 'event_count', calculation: 'count' },
      { name: 'avg_processing_time', calculation: 'avg', field: 'processingDurationMs' },
      { name: 'error_count', calculation: 'count' }
    ]
  },
  
  // Daily transfer aggregations
  {
    name: 'daily_transfer_summary',
    sourceTable: 'webhookEvent',
    aggregationType: 'daily',
    dimensions: ['direction', 'status'],
    metrics: [
      { name: 'transfer_count', calculation: 'count' },
      { name: 'total_volume', calculation: 'sum', field: 'amount' },
      { name: 'avg_amount', calculation: 'avg', field: 'amount' },
      { name: 'failure_rate', calculation: 'rate' }
    ]
  },
  
  // Daily journey aggregations
  {
    name: 'daily_journey_summary',
    sourceTable: 'journeyInstance',
    aggregationType: 'daily',
    dimensions: ['definitionId', 'status'],
    metrics: [
      { name: 'journey_count', calculation: 'count' },
      { name: 'avg_duration', calculation: 'avg', field: 'totalDurationMs' },
      { name: 'completion_rate', calculation: 'rate' }
    ]
  },
  
  // Weekly return aggregations
  {
    name: 'weekly_return_summary',
    sourceTable: 'webhookEvent',
    aggregationType: 'weekly',
    dimensions: ['returnCode', 'failureCategory'],
    metrics: [
      { name: 'return_count', calculation: 'count' },
      { name: 'return_volume', calculation: 'sum', field: 'amount' },
      { name: 'avg_return_amount', calculation: 'avg', field: 'amount' }
    ]
  }
]

export class AggregationService {
  async runAggregations(forceAll: boolean = false): Promise<void> {
    log.info('Starting aggregation jobs', { forceAll })
    
    for (const config of AGGREGATION_CONFIGS) {
      try {
        await this.runAggregation(config, forceAll)
      } catch (error) {
        log.error('Aggregation failed', error as Error, {
          aggregation: config.name
        })
      }
    }
    
    log.info('Aggregation jobs completed')
  }
  
  private async runAggregation(
    config: AggregationConfig,
    forceAll: boolean
  ): Promise<void> {
    // Determine time range
    const { startTime, endTime } = this.getTimeRange(config, forceAll)
    
    // Get raw data
    const rawData = await this.getRawData(config, startTime, endTime)
    
    if (rawData.length === 0) {
      log.debug('No data to aggregate', {
        aggregation: config.name,
        startTime,
        endTime
      })
      return
    }
    
    // Group and aggregate data
    const aggregatedData = this.aggregateData(config, rawData)
    
    // Store aggregated results
    await this.storeAggregations(config, aggregatedData, startTime, endTime)
    
    log.info('Aggregation completed', {
      aggregation: config.name,
      recordsProcessed: rawData.length,
      aggregatesCreated: aggregatedData.length
    })
  }
  
  private getTimeRange(
    config: AggregationConfig,
    forceAll: boolean
  ): { startTime: Date; endTime: Date } {
    const now = new Date()
    let startTime: Date
    let endTime: Date
    
    if (forceAll) {
      // Process all historical data
      startTime = new Date('2024-01-01')
      endTime = now
    } else {
      // Process only recent data
      switch (config.aggregationType) {
        case 'hourly':
          // Last 2 hours
          startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000)
          endTime = now
          break
          
        case 'daily':
          // Last 2 days
          startTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
          endTime = now
          break
          
        case 'weekly':
          // Last 2 weeks
          startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
          endTime = now
          break
          
        case 'monthly':
          // Last 2 months
          startTime = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
          endTime = now
          break
      }
    }
    
    return { startTime, endTime }
  }
  
  private async getRawData(
    config: AggregationConfig,
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    switch (config.sourceTable) {
      case 'webhookEvent':
        return prisma.webhookEvent.findMany({
          where: {
            eventTimestamp: { gte: startTime, lt: endTime },
            processingState: 'completed'
          },
          select: {
            id: true,
            eventType: true,
            resourceType: true,
            eventTimestamp: true,
            processingDurationMs: true,
            payload: true,
            metadata: true
          }
        })
        
      case 'journeyInstance':
        return prisma.journeyInstance.findMany({
          where: {
            startTime: { gte: startTime, lt: endTime }
          },
          select: {
            id: true,
            definitionId: true,
            status: true,
            startTime: true,
            endTime: true,
            totalDurationMs: true,
            resourceMetadata: true
          }
        })
        
      default:
        return []
    }
  }
  
  private aggregateData(
    config: AggregationConfig,
    rawData: any[]
  ): any[] {
    // Group by time bucket and dimensions
    const groups = new Map<string, any[]>()
    
    for (const record of rawData) {
      const bucket = this.getTimeBucket(record.eventTimestamp || record.startTime, config.aggregationType)
      const dimensionKey = this.getDimensionKey(config.dimensions, record)
      const groupKey = `${bucket}|${dimensionKey}`
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      
      groups.get(groupKey)!.push(record)
    }
    
    // Calculate metrics for each group
    const aggregatedData: any[] = []
    
    for (const [groupKey, records] of groups) {
      const [bucket, dimensionKey] = groupKey.split('|')
      const dimensions = this.parseDimensionKey(config.dimensions, dimensionKey)
      
      const metrics: Record<string, number> = {}
      
      for (const metricConfig of config.metrics) {
        metrics[metricConfig.name] = this.calculateMetric(
          metricConfig,
          records
        )
      }
      
      aggregatedData.push({
        bucket: new Date(bucket),
        dimensions,
        metrics,
        recordCount: records.length
      })
    }
    
    return aggregatedData
  }
  
  private getTimeBucket(timestamp: Date, aggregationType: string): string {
    const date = new Date(timestamp)
    
    switch (aggregationType) {
      case 'hourly':
        date.setMinutes(0, 0, 0)
        break
        
      case 'daily':
        date.setHours(0, 0, 0, 0)
        break
        
      case 'weekly':
        // Start of week (Monday)
        const day = date.getDay()
        const diff = date.getDate() - day + (day === 0 ? -6 : 1)
        date.setDate(diff)
        date.setHours(0, 0, 0, 0)
        break
        
      case 'monthly':
        date.setDate(1)
        date.setHours(0, 0, 0, 0)
        break
    }
    
    return date.toISOString()
  }
  
  private getDimensionKey(dimensions: string[], record: any): string {
    const values: string[] = []
    
    for (const dim of dimensions) {
      let value = record[dim]
      
      if (!value && record.payload) {
        value = record.payload[dim]
      }
      
      if (!value && record.metadata?.analytics) {
        value = record.metadata.analytics[dim]
      }
      
      values.push(value || 'unknown')
    }
    
    return values.join(':')
  }
  
  private parseDimensionKey(
    dimensions: string[],
    key: string
  ): Record<string, string> {
    const values = key.split(':')
    const result: Record<string, string> = {}
    
    dimensions.forEach((dim, index) => {
      result[dim] = values[index] || 'unknown'
    })
    
    return result
  }
  
  private calculateMetric(
    metricConfig: { calculation: string; field?: string },
    records: any[]
  ): number {
    switch (metricConfig.calculation) {
      case 'count':
        return records.length
        
      case 'sum':
        return records.reduce((sum, record) => {
          const value = this.getFieldValue(record, metricConfig.field!)
          return sum + (value || 0)
        }, 0)
        
      case 'avg':
        const values = records
          .map(record => this.getFieldValue(record, metricConfig.field!))
          .filter(v => v !== null)
        
        return values.length > 0
          ? values.reduce((sum, val) => sum + val, 0) / values.length
          : 0
          
      case 'min':
        const minValues = records
          .map(record => this.getFieldValue(record, metricConfig.field!))
          .filter(v => v !== null)
        
        return minValues.length > 0 ? Math.min(...minValues) : 0
        
      case 'max':
        const maxValues = records
          .map(record => this.getFieldValue(record, metricConfig.field!))
          .filter(v => v !== null)
        
        return maxValues.length > 0 ? Math.max(...maxValues) : 0
        
      case 'rate':
        // Calculate success rate
        const successCount = records.filter(r => 
          r.status === 'completed' || 
          r.eventType?.includes('completed') ||
          r.eventType?.includes('verified')
        ).length
        
        return records.length > 0 ? (successCount / records.length) * 100 : 0
        
      default:
        return 0
    }
  }
  
  private getFieldValue(record: any, field: string): number | null {
    // Direct field
    if (record[field] !== undefined) {
      return Number(record[field])
    }
    
    // Nested in payload
    if (record.payload?.[field] !== undefined) {
      return Number(record.payload[field])
    }
    
    // Special handling for amount
    if (field === 'amount' && record.payload?.amount?.value) {
      return Number(record.payload.amount.value)
    }
    
    // Analytics metadata
    if (record.metadata?.analytics?.[field] !== undefined) {
      return Number(record.metadata.analytics[field])
    }
    
    return null
  }
  
  private async storeAggregations(
    config: AggregationConfig,
    aggregatedData: any[],
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    // Store in EventAggregate table
    const aggregates = aggregatedData.map(data => ({
      name: config.name,
      aggregationType: config.aggregationType,
      timeBucket: data.bucket,
      dimensions: data.dimensions,
      metrics: data.metrics,
      recordCount: data.recordCount,
      metadata: {
        config: config.name,
        startTime,
        endTime,
        createdAt: new Date()
      }
    }))
    
    // Batch insert with upsert
    for (const aggregate of aggregates) {
      await prisma.eventAggregate.upsert({
        where: {
          name_timeBucket_dimensions: {
            name: aggregate.name,
            timeBucket: aggregate.timeBucket,
            dimensions: aggregate.dimensions
          }
        },
        update: {
          metrics: aggregate.metrics,
          recordCount: aggregate.recordCount,
          metadata: aggregate.metadata
        },
        create: aggregate
      })
    }
  }
  
  // Schedule aggregation jobs
  scheduleJobs(): void {
    // Hourly aggregations - run every hour at 5 minutes past
    setInterval(() => {
      this.runAggregations(false).catch(error => {
        log.error('Scheduled aggregation failed', error)
      })
    }, 60 * 60 * 1000) // 1 hour
    
    log.info('Aggregation jobs scheduled')
  }
}

// Singleton instance
let service: AggregationService | null = null

export function getAggregationService(): AggregationService {
  if (!service) {
    service = new AggregationService()
  }
  return service
}