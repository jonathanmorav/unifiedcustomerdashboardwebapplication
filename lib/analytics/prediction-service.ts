import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { EventAggregate, JourneyInstance } from '@prisma/client'

interface PredictionModel {
  name: string
  type: 'linear' | 'seasonal' | 'ml'
  targetMetric: string
  features: string[]
  config: Record<string, any>
}

interface Prediction {
  metric: string
  timestamp: Date
  predictedValue: number
  confidence: number
  upperBound: number
  lowerBound: number
  model: string
}

export class PredictionService {
  private models: PredictionModel[] = [
    {
      name: 'transfer_volume_predictor',
      type: 'seasonal',
      targetMetric: 'total_transfer_volume',
      features: ['day_of_week', 'hour_of_day', 'is_holiday'],
      config: {
        seasonalityDays: 7,
        trendDays: 30
      }
    },
    {
      name: 'failure_rate_predictor',
      type: 'linear',
      targetMetric: 'transfer_failure_rate',
      features: ['recent_failure_rate', 'volume_trend'],
      config: {
        lookbackHours: 24,
        smoothingFactor: 0.3
      }
    },
    {
      name: 'journey_completion_predictor',
      type: 'ml',
      targetMetric: 'journey_completion_probability',
      features: ['journey_type', 'time_elapsed', 'steps_completed'],
      config: {
        modelType: 'logistic_regression'
      }
    }
  ]
  
  async generatePredictions(): Promise<Prediction[]> {
    const predictions: Prediction[] = []
    
    for (const model of this.models) {
      try {
        const modelPredictions = await this.runModel(model)
        predictions.push(...modelPredictions)
      } catch (error) {
        log.error('Prediction model failed', error as Error, {
          model: model.name
        })
      }
    }
    
    // Store predictions
    await this.storePredictions(predictions)
    
    return predictions
  }
  
  private async runModel(model: PredictionModel): Promise<Prediction[]> {
    switch (model.type) {
      case 'seasonal':
        return this.runSeasonalModel(model)
      case 'linear':
        return this.runLinearModel(model)
      case 'ml':
        return this.runMLModel(model)
      default:
        return []
    }
  }
  
  private async runSeasonalModel(model: PredictionModel): Promise<Prediction[]> {
    const { seasonalityDays, trendDays } = model.config
    const now = new Date()
    const predictions: Prediction[] = []
    
    // Get historical data
    const historicalData = await prisma.eventAggregate.findMany({
      where: {
        name: 'daily_transfer_summary',
        timeBucket: { 
          gte: new Date(now.getTime() - trendDays * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { timeBucket: 'asc' }
    })
    
    if (historicalData.length < seasonalityDays) {
      return [] // Not enough data
    }
    
    // Calculate seasonal patterns
    const seasonalPattern = this.calculateSeasonalPattern(historicalData, seasonalityDays)
    
    // Calculate trend
    const trend = this.calculateTrend(historicalData)
    
    // Generate predictions for next 24 hours
    for (let hours = 1; hours <= 24; hours++) {
      const predictTime = new Date(now.getTime() + hours * 60 * 60 * 1000)
      const dayOfWeek = predictTime.getDay()
      const hourOfDay = predictTime.getHours()
      
      // Base prediction from seasonal pattern
      const seasonalValue = seasonalPattern[dayOfWeek] || 0
      
      // Apply trend
      const trendAdjustment = trend * hours
      const predictedValue = Math.max(0, seasonalValue + trendAdjustment)
      
      // Calculate confidence based on data quality
      const confidence = this.calculateConfidence(historicalData.length, seasonalityDays)
      
      // Calculate bounds (simple percentage-based)
      const uncertainty = (1 - confidence) * 0.5
      const upperBound = predictedValue * (1 + uncertainty)
      const lowerBound = predictedValue * (1 - uncertainty)
      
      predictions.push({
        metric: model.targetMetric,
        timestamp: predictTime,
        predictedValue,
        confidence,
        upperBound,
        lowerBound,
        model: model.name
      })
    }
    
    return predictions
  }
  
  private calculateSeasonalPattern(
    data: EventAggregate[],
    seasonalityDays: number
  ): Record<number, number> {
    const pattern: Record<number, number[]> = {}
    
    // Group by day of week
    for (const record of data) {
      const dayOfWeek = record.timeBucket.getDay()
      const value = (record.metrics as any).total_volume || 0
      
      if (!pattern[dayOfWeek]) {
        pattern[dayOfWeek] = []
      }
      
      pattern[dayOfWeek].push(value)
    }
    
    // Calculate average for each day
    const avgPattern: Record<number, number> = {}
    
    for (const [day, values] of Object.entries(pattern)) {
      avgPattern[Number(day)] = values.reduce((sum, val) => sum + val, 0) / values.length
    }
    
    return avgPattern
  }
  
  private calculateTrend(data: EventAggregate[]): number {
    if (data.length < 2) return 0
    
    // Simple linear regression
    const n = data.length
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumX2 = 0
    
    data.forEach((record, index) => {
      const x = index
      const y = (record.metrics as any).total_volume || 0
      
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    })
    
    // Calculate slope
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    
    return slope
  }
  
  private async runLinearModel(model: PredictionModel): Promise<Prediction[]> {
    const { lookbackHours, smoothingFactor } = model.config
    const now = new Date()
    const predictions: Prediction[] = []
    
    // Get recent failure rates
    const recentMetrics = await prisma.eventMetric.findMany({
      where: {
        name: 'transfer_failure_rate',
        timestamp: { 
          gte: new Date(now.getTime() - lookbackHours * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'desc' }
    })
    
    if (recentMetrics.length === 0) return []
    
    // Apply exponential smoothing
    let smoothedValue = recentMetrics[0].value
    
    for (let i = 1; i < recentMetrics.length; i++) {
      smoothedValue = smoothingFactor * recentMetrics[i].value + 
                      (1 - smoothingFactor) * smoothedValue
    }
    
    // Simple linear projection
    const recentTrend = this.calculateRecentTrend(recentMetrics)
    
    // Predict next hour
    const predictedValue = Math.max(0, Math.min(100, smoothedValue + recentTrend))
    const confidence = 0.7 // Medium confidence for simple model
    
    predictions.push({
      metric: model.targetMetric,
      timestamp: new Date(now.getTime() + 60 * 60 * 1000),
      predictedValue,
      confidence,
      upperBound: Math.min(100, predictedValue * 1.2),
      lowerBound: Math.max(0, predictedValue * 0.8),
      model: model.name
    })
    
    return predictions
  }
  
  private calculateRecentTrend(metrics: any[]): number {
    if (metrics.length < 2) return 0
    
    // Compare recent average to older average
    const midpoint = Math.floor(metrics.length / 2)
    const recentAvg = metrics.slice(0, midpoint)
      .reduce((sum, m) => sum + m.value, 0) / midpoint
    const olderAvg = metrics.slice(midpoint)
      .reduce((sum, m) => sum + m.value, 0) / (metrics.length - midpoint)
    
    return recentAvg - olderAvg
  }
  
  private async runMLModel(model: PredictionModel): Promise<Prediction[]> {
    // Simplified ML model for journey completion prediction
    const predictions: Prediction[] = []
    
    // Get active journeys
    const activeJourneys = await prisma.journeyInstance.findMany({
      where: { 
        status: 'active',
        startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      include: {
        definition: true,
        steps: true
      }
    })
    
    for (const journey of activeJourneys) {
      const prediction = await this.predictJourneyCompletion(journey)
      if (prediction) {
        predictions.push(prediction)
      }
    }
    
    return predictions
  }
  
  private async predictJourneyCompletion(journey: any): Promise<Prediction | null> {
    const config = journey.definition.config as any
    const expectedSteps = config.expectedSteps || []
    
    if (expectedSteps.length === 0) return null
    
    // Features
    const timeElapsed = Date.now() - journey.startTime.getTime()
    const stepsCompleted = journey.steps.length
    const progressRate = stepsCompleted / (timeElapsed / (60 * 60 * 1000)) // Steps per hour
    
    // Simple logistic regression model
    // P(completion) = 1 / (1 + e^(-z))
    // z = b0 + b1*progress + b2*timeRatio + b3*stepsRatio
    
    const stepsRatio = stepsCompleted / expectedSteps.length
    const timeRatio = timeElapsed / (config.timeoutMinutes * 60 * 1000)
    
    // Coefficients (would be trained on historical data)
    const b0 = -2.0
    const b1 = 1.5  // Progress rate weight
    const b2 = -0.8 // Time ratio weight (negative = less likely over time)
    const b3 = 3.0  // Steps ratio weight
    
    const z = b0 + b1 * progressRate + b2 * timeRatio + b3 * stepsRatio
    const probability = 1 / (1 + Math.exp(-z))
    
    return {
      metric: 'journey_completion_probability',
      timestamp: new Date(),
      predictedValue: probability * 100, // Convert to percentage
      confidence: 0.65, // Medium confidence
      upperBound: Math.min(100, probability * 100 * 1.3),
      lowerBound: Math.max(0, probability * 100 * 0.7),
      model: 'journey_completion_predictor'
    }
  }
  
  private calculateConfidence(dataPoints: number, requiredPoints: number): number {
    // More data = higher confidence
    const dataRatio = Math.min(1, dataPoints / (requiredPoints * 4))
    
    // Base confidence of 0.5, can go up to 0.9
    return 0.5 + (0.4 * dataRatio)
  }
  
  private async storePredictions(predictions: Prediction[]): Promise<void> {
    // Store predictions for historical analysis
    // In a real system, this might go to a separate predictions table
    
    for (const prediction of predictions) {
      await prisma.eventMetric.create({
        data: {
          name: `prediction_${prediction.metric}`,
          value: prediction.predictedValue,
          aggregationType: 'prediction',
          dimensions: {
            model: prediction.model,
            confidence: prediction.confidence.toString()
          },
          windowSizeMinutes: 60,
          timestamp: prediction.timestamp,
          metadata: {
            upperBound: prediction.upperBound,
            lowerBound: prediction.lowerBound,
            generatedAt: new Date()
          }
        }
      })
    }
  }
  
  // Get predictions for a specific metric
  async getPredictions(
    metricName: string,
    hoursAhead: number = 24
  ): Promise<Prediction[]> {
    const predictions = await prisma.eventMetric.findMany({
      where: {
        name: `prediction_${metricName}`,
        timestamp: {
          gte: new Date(),
          lte: new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'asc' }
    })
    
    return predictions.map(p => ({
      metric: metricName,
      timestamp: p.timestamp,
      predictedValue: p.value,
      confidence: parseFloat((p.dimensions as any).confidence || '0'),
      upperBound: (p.metadata as any).upperBound || p.value * 1.2,
      lowerBound: (p.metadata as any).lowerBound || p.value * 0.8,
      model: (p.dimensions as any).model || 'unknown'
    }))
  }
  
  // Schedule prediction generation
  schedulePredictions(): void {
    // Run predictions every hour
    setInterval(() => {
      this.generatePredictions().catch(error => {
        log.error('Scheduled prediction failed', error)
      })
    }, 60 * 60 * 1000)
    
    // Run immediately
    this.generatePredictions().catch(error => {
      log.error('Initial prediction failed', error)
    })
    
    log.info('Prediction service scheduled')
  }
}

// Singleton instance
let service: PredictionService | null = null

export function getPredictionService(): PredictionService {
  if (!service) {
    service = new PredictionService()
  }
  return service
}