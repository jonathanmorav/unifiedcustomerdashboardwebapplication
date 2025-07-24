import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import { EventMetric, EventAnomaly } from '@/lib/generated/prisma'

interface AnomalyRule {
  metricName: string
  type: 'threshold' | 'deviation' | 'pattern' | 'volume'
  config: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Define anomaly detection rules
export const ANOMALY_RULES: AnomalyRule[] = [
  // Volume anomalies
  {
    metricName: 'webhook_events_per_minute',
    type: 'threshold',
    config: {
      maxValue: 1000,
      minValue: 0
    },
    severity: 'high'
  },
  {
    metricName: 'webhook_events_per_minute',
    type: 'deviation',
    config: {
      deviationMultiplier: 3, // 3 standard deviations
      lookbackMinutes: 60
    },
    severity: 'medium'
  },
  
  // Transfer anomalies
  {
    metricName: 'transfer_failure_rate',
    type: 'threshold',
    config: {
      maxValue: 10 // 10% failure rate
    },
    severity: 'high'
  },
  {
    metricName: 'transfer_failure_rate',
    type: 'pattern',
    config: {
      pattern: 'increasing',
      windowMinutes: 30,
      minIncreaseRate: 0.5 // 50% increase
    },
    severity: 'critical'
  },
  {
    metricName: 'average_transfer_amount',
    type: 'deviation',
    config: {
      deviationMultiplier: 4,
      lookbackMinutes: 1440 // 24 hours
    },
    severity: 'medium'
  },
  
  // Return anomalies
  {
    metricName: 'ach_return_rate',
    type: 'threshold',
    config: {
      maxValue: 5 // 5% return rate
    },
    severity: 'high'
  },
  {
    metricName: 'return_volume_by_code',
    type: 'pattern',
    config: {
      pattern: 'spike',
      spikeMultiplier: 5,
      windowMinutes: 60
    },
    severity: 'critical'
  },
  
  // Journey anomalies
  {
    metricName: 'journey_abandonment_rate',
    type: 'threshold',
    config: {
      maxValue: 30 // 30% abandonment
    },
    severity: 'medium'
  },
  {
    metricName: 'journey_completion_rate',
    type: 'threshold',
    config: {
      minValue: 70 // Less than 70% completion
    },
    severity: 'high'
  }
]

export class AnomalyDetector {
  async detectAnomalies(metric: EventMetric): Promise<void> {
    try {
      // Find applicable rules for this metric
      const applicableRules = ANOMALY_RULES.filter(rule => 
        rule.metricName === metric.name
      )
      
      for (const rule of applicableRules) {
        const isAnomalous = await this.checkRule(rule, metric)
        
        if (isAnomalous) {
          await this.createAnomaly(rule, metric)
        }
      }
      
    } catch (error) {
      log.error('Anomaly detection error', error as Error, {
        metricId: metric.id,
        metricName: metric.name
      })
    }
  }
  
  private async checkRule(rule: AnomalyRule, metric: EventMetric): boolean {
    switch (rule.type) {
      case 'threshold':
        return this.checkThreshold(rule, metric)
        
      case 'deviation':
        return await this.checkDeviation(rule, metric)
        
      case 'pattern':
        return await this.checkPattern(rule, metric)
        
      case 'volume':
        return await this.checkVolume(rule, metric)
        
      default:
        return false
    }
  }
  
  private checkThreshold(rule: AnomalyRule, metric: EventMetric): boolean {
    const { maxValue, minValue } = rule.config
    
    if (maxValue !== undefined && metric.value > maxValue) {
      return true
    }
    
    if (minValue !== undefined && metric.value < minValue) {
      return true
    }
    
    return false
  }
  
  private async checkDeviation(rule: AnomalyRule, metric: EventMetric): Promise<boolean> {
    const { deviationMultiplier, lookbackMinutes } = rule.config
    const lookbackTime = new Date(metric.timestamp.getTime() - lookbackMinutes * 60 * 1000)
    
    // Get historical metrics
    const historicalMetrics = await prisma.eventMetric.findMany({
      where: {
        name: metric.name,
        timestamp: { gte: lookbackTime, lt: metric.timestamp },
        dimensions: { equals: metric.dimensions }
      },
      select: { value: true }
    })
    
    if (historicalMetrics.length < 10) {
      // Not enough data for deviation analysis
      return false
    }
    
    // Calculate mean and standard deviation
    const values = historicalMetrics.map(m => m.value)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    // Check if current value is outside expected range
    const lowerBound = mean - (deviationMultiplier * stdDev)
    const upperBound = mean + (deviationMultiplier * stdDev)
    
    return metric.value < lowerBound || metric.value > upperBound
  }
  
  private async checkPattern(rule: AnomalyRule, metric: EventMetric): Promise<boolean> {
    const { pattern, windowMinutes } = rule.config
    const windowStart = new Date(metric.timestamp.getTime() - windowMinutes * 60 * 1000)
    
    // Get recent metrics
    const recentMetrics = await prisma.eventMetric.findMany({
      where: {
        name: metric.name,
        timestamp: { gte: windowStart, lte: metric.timestamp },
        dimensions: { equals: metric.dimensions }
      },
      orderBy: { timestamp: 'asc' },
      select: { value: true, timestamp: true }
    })
    
    if (recentMetrics.length < 3) {
      return false // Not enough data points
    }
    
    switch (pattern) {
      case 'increasing':
        return this.isIncreasingPattern(recentMetrics, rule.config)
        
      case 'decreasing':
        return this.isDecreasingPattern(recentMetrics, rule.config)
        
      case 'spike':
        return this.isSpikePattern(recentMetrics, metric, rule.config)
        
      default:
        return false
    }
  }
  
  private isIncreasingPattern(
    metrics: Array<{ value: number; timestamp: Date }>,
    config: Record<string, any>
  ): boolean {
    const { minIncreaseRate } = config
    
    // Check if values are consistently increasing
    let increasingCount = 0
    for (let i = 1; i < metrics.length; i++) {
      if (metrics[i].value > metrics[i - 1].value) {
        increasingCount++
      }
    }
    
    // Check overall increase rate
    const firstValue = metrics[0].value
    const lastValue = metrics[metrics.length - 1].value
    const increaseRate = firstValue > 0 ? (lastValue - firstValue) / firstValue : 0
    
    return increasingCount >= metrics.length * 0.7 && increaseRate >= minIncreaseRate
  }
  
  private isDecreasingPattern(
    metrics: Array<{ value: number; timestamp: Date }>,
    config: Record<string, any>
  ): boolean {
    const { minDecreaseRate } = config
    
    // Check if values are consistently decreasing
    let decreasingCount = 0
    for (let i = 1; i < metrics.length; i++) {
      if (metrics[i].value < metrics[i - 1].value) {
        decreasingCount++
      }
    }
    
    // Check overall decrease rate
    const firstValue = metrics[0].value
    const lastValue = metrics[metrics.length - 1].value
    const decreaseRate = firstValue > 0 ? (firstValue - lastValue) / firstValue : 0
    
    return decreasingCount >= metrics.length * 0.7 && decreaseRate >= minDecreaseRate
  }
  
  private isSpikePattern(
    metrics: Array<{ value: number; timestamp: Date }>,
    currentMetric: EventMetric,
    config: Record<string, any>
  ): boolean {
    const { spikeMultiplier } = config
    
    // Calculate average excluding current value
    const historicalValues = metrics.slice(0, -1).map(m => m.value)
    const average = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length
    
    // Check if current value is a spike
    return currentMetric.value > average * spikeMultiplier
  }
  
  private async checkVolume(rule: AnomalyRule, metric: EventMetric): Promise<boolean> {
    // Volume checks would compare against expected volumes for time of day/week
    // This is a simplified version
    const { expectedVolume, tolerance } = rule.config
    
    const lowerBound = expectedVolume * (1 - tolerance)
    const upperBound = expectedVolume * (1 + tolerance)
    
    return metric.value < lowerBound || metric.value > upperBound
  }
  
  private async createAnomaly(rule: AnomalyRule, metric: EventMetric): Promise<void> {
    try {
      // Check if we already have this anomaly
      const existingAnomaly = await prisma.eventAnomaly.findFirst({
        where: {
          metricId: metric.id,
          detectionRule: rule.type,
          resolved: false
        }
      })
      
      if (existingAnomaly) {
        // Update existing anomaly
        await prisma.eventAnomaly.update({
          where: { id: existingAnomaly.id },
          data: {
            occurrenceCount: { increment: 1 },
            lastOccurrence: new Date()
          }
        })
      } else {
        // Create new anomaly
        await prisma.eventAnomaly.create({
          data: {
            metricId: metric.id,
            detectionRule: rule.type,
            severity: rule.severity,
            value: metric.value,
            expectedRange: this.getExpectedRange(rule),
            description: this.generateDescription(rule, metric),
            metadata: {
              rule: rule.config,
              metricName: metric.name,
              dimensions: metric.dimensions
            },
            detectedAt: new Date(),
            occurrenceCount: 1,
            lastOccurrence: new Date()
          }
        })
        
        // Trigger alerts for high/critical severity
        if (rule.severity === 'high' || rule.severity === 'critical') {
          await this.triggerAlert(rule, metric)
        }
      }
    } catch (error) {
      log.error('Failed to create anomaly', error as Error, {
        rule: rule.metricName,
        metricId: metric.id
      })
    }
  }
  
  private getExpectedRange(rule: AnomalyRule): Record<string, number> {
    const range: Record<string, number> = {}
    
    if (rule.config.minValue !== undefined) {
      range.min = rule.config.minValue
    }
    
    if (rule.config.maxValue !== undefined) {
      range.max = rule.config.maxValue
    }
    
    return range
  }
  
  private generateDescription(rule: AnomalyRule, metric: EventMetric): string {
    switch (rule.type) {
      case 'threshold':
        return `${metric.name} value ${metric.value} exceeded threshold`
        
      case 'deviation':
        return `${metric.name} deviated significantly from historical average`
        
      case 'pattern':
        return `Detected ${rule.config.pattern} pattern in ${metric.name}`
        
      case 'volume':
        return `Unusual volume detected for ${metric.name}`
        
      default:
        return `Anomaly detected in ${metric.name}`
    }
  }
  
  private async triggerAlert(rule: AnomalyRule, metric: EventMetric): Promise<void> {
    // In a real system, this would send notifications via email, Slack, PagerDuty, etc.
    log.warn('ANOMALY ALERT', {
      severity: rule.severity,
      metric: metric.name,
      value: metric.value,
      dimensions: metric.dimensions,
      rule: rule.type
    })
    
    // Could also create an alert record in the database
    // await prisma.alert.create({ ... })
  }
  
  // Method to resolve anomalies that are no longer active
  async resolveStaleAnomalies(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 60 * 60 * 1000) // 1 hour
    
    const resolved = await prisma.eventAnomaly.updateMany({
      where: {
        resolved: false,
        lastOccurrence: { lt: staleThreshold }
      },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolutionReason: 'auto_resolved_stale'
      }
    })
    
    if (resolved.count > 0) {
      log.info('Resolved stale anomalies', { count: resolved.count })
    }
  }
}

// Singleton instance
let detector: AnomalyDetector | null = null

export function getAnomalyDetector(): AnomalyDetector {
  if (!detector) {
    detector = new AnomalyDetector()
  }
  return detector
}