import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { WebhookEvent } from '@prisma/client'
import { getReconciliationEngine } from './reconciliation-engine'

interface BatchConfig {
  batchSize: number
  parallelWorkers: number
  retryAttempts: number
  timeoutMs: number
}

interface BatchResult {
  batchId: string
  startTime: Date
  endTime: Date
  totalProcessed: number
  successCount: number
  errorCount: number
  errors: Array<{
    resourceId: string
    error: string
    timestamp: Date
  }>
}

export class BatchReconciler {
  private defaultConfig: BatchConfig = {
    batchSize: 100,
    parallelWorkers: 5,
    retryAttempts: 3,
    timeoutMs: 30000 // 30 seconds per batch
  }
  
  async performBatchReconciliation(
    resourceType: 'transfer' | 'customer' | 'funding_source',
    startDate: Date,
    endDate: Date,
    config?: Partial<BatchConfig>
  ): Promise<BatchResult[]> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const results: BatchResult[] = []
    
    log.info('Starting batch reconciliation', {
      resourceType,
      startDate,
      endDate,
      config: finalConfig
    })
    
    // Get total count for progress tracking
    const totalCount = await this.getResourceCount(resourceType, startDate, endDate)
    
    if (totalCount === 0) {
      log.info('No resources to reconcile')
      return results
    }
    
    log.info(`Found ${totalCount} resources to reconcile`)
    
    // Process in batches
    let offset = 0
    const startTime = Date.now()
    
    while (offset < totalCount) {
      const batchResult = await this.processBatch(
        resourceType,
        startDate,
        endDate,
        offset,
        finalConfig
      )
      
      results.push(batchResult)
      offset += finalConfig.batchSize
      
      // Progress update
      const progress = Math.min(100, (offset / totalCount) * 100)
      log.info(`Batch reconciliation progress: ${progress.toFixed(2)}%`, {
        processed: offset,
        total: totalCount,
        elapsed: Date.now() - startTime
      })
      
      // Small delay between batches to prevent overload
      await this.delay(100)
    }
    
    // Generate summary
    const summary = this.generateBatchSummary(results)
    log.info('Batch reconciliation completed', summary)
    
    return results
  }
  
  private async getResourceCount(
    resourceType: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Count unique resource IDs from webhook events
    const uniqueResources = await prisma.webhookEvent.groupBy({
      by: ['resourceId'],
      where: {
        resourceType,
        eventTimestamp: { gte: startDate, lte: endDate },
        resourceId: { not: null }
      },
      _count: true
    })
    
    return uniqueResources.length
  }
  
  private async processBatch(
    resourceType: string,
    startDate: Date,
    endDate: Date,
    offset: number,
    config: BatchConfig
  ): Promise<BatchResult> {
    const batchId = `batch_${Date.now()}_${offset}`
    const batchStartTime = new Date()
    const errors: BatchResult['errors'] = []
    
    try {
      // Get batch of resource IDs
      const resourceIds = await this.getBatchResourceIds(
        resourceType,
        startDate,
        endDate,
        offset,
        config.batchSize
      )
      
      // Process resources in parallel chunks
      const chunks = this.chunkArray(resourceIds, Math.ceil(resourceIds.length / config.parallelWorkers))
      const results = await Promise.allSettled(
        chunks.map(chunk => this.processChunk(chunk, resourceType, errors))
      )
      
      // Count successes and failures
      let successCount = 0
      let errorCount = 0
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount += result.value.success
          errorCount += result.value.errors
        } else {
          errorCount += chunks[results.indexOf(result)].length
          errors.push({
            resourceId: 'chunk_error',
            error: result.reason.message,
            timestamp: new Date()
          })
        }
      }
      
      return {
        batchId,
        startTime: batchStartTime,
        endTime: new Date(),
        totalProcessed: resourceIds.length,
        successCount,
        errorCount,
        errors
      }
      
    } catch (error) {
      log.error('Batch processing failed', error as Error, { batchId })
      
      return {
        batchId,
        startTime: batchStartTime,
        endTime: new Date(),
        totalProcessed: 0,
        successCount: 0,
        errorCount: config.batchSize,
        errors: [{
          resourceId: 'batch_error',
          error: (error as Error).message,
          timestamp: new Date()
        }]
      }
    }
  }
  
  private async getBatchResourceIds(
    resourceType: string,
    startDate: Date,
    endDate: Date,
    offset: number,
    limit: number
  ): Promise<string[]> {
    const resources = await prisma.webhookEvent.findMany({
      where: {
        resourceType,
        eventTimestamp: { gte: startDate, lte: endDate },
        resourceId: { not: null }
      },
      select: {
        resourceId: true
      },
      distinct: ['resourceId'],
      skip: offset,
      take: limit,
      orderBy: { resourceId: 'asc' }
    })
    
    return resources.map(r => r.resourceId!).filter(Boolean)
  }
  
  private async processChunk(
    resourceIds: string[],
    resourceType: string,
    errors: BatchResult['errors']
  ): Promise<{ success: number; errors: number }> {
    let success = 0
    let errorCount = 0
    
    for (const resourceId of resourceIds) {
      try {
        await this.reconcileResource(resourceId, resourceType)
        success++
      } catch (error) {
        errorCount++
        errors.push({
          resourceId,
          error: (error as Error).message,
          timestamp: new Date()
        })
      }
    }
    
    return { success, errors: errorCount }
  }
  
  private async reconcileResource(
    resourceId: string,
    resourceType: string
  ): Promise<void> {
    // Get latest webhook state
    const latestEvent = await prisma.webhookEvent.findFirst({
      where: {
        resourceId,
        resourceType,
        processingState: 'completed'
      },
      orderBy: { eventTimestamp: 'desc' }
    })
    
    if (!latestEvent) {
      throw new Error('No webhook events found for resource')
    }
    
    // Perform reconciliation checks
    // This is a simplified version - in production would use full reconciliation engine
    const webhookState = this.extractState(latestEvent)
    const actualState = await this.fetchActualState(resourceId, resourceType)
    
    if (!actualState) {
      await this.recordDiscrepancy(resourceId, resourceType, 'not_found', {
        webhookState,
        actualState: null
      })
      return
    }
    
    // Compare states
    const discrepancies = this.compareStates(webhookState, actualState)
    
    for (const discrepancy of discrepancies) {
      await this.recordDiscrepancy(resourceId, resourceType, discrepancy.type, discrepancy)
    }
  }
  
  private extractState(event: WebhookEvent): any {
    const payload = event.payload as any
    
    return {
      id: event.resourceId,
      type: event.resourceType,
      status: this.inferStatus(event),
      amount: payload.amount,
      timestamp: event.eventTimestamp,
      metadata: payload
    }
  }
  
  private inferStatus(event: WebhookEvent): string {
    const eventType = event.eventType
    
    if (eventType.includes('completed')) return 'completed'
    if (eventType.includes('failed')) return 'failed'
    if (eventType.includes('pending')) return 'pending'
    if (eventType.includes('processing')) return 'processing'
    
    return 'unknown'
  }
  
  private async fetchActualState(
    resourceId: string,
    resourceType: string
  ): Promise<any> {
    // In demo mode, fetch from database
    if (process.env.DEMO_MODE === 'true') {
      switch (resourceType) {
        case 'transfer':
          const transfer = await prisma.aCHTransaction.findUnique({
            where: { dwollaId: resourceId }
          })
          
          return transfer ? {
            id: resourceId,
            type: 'transfer',
            status: transfer.status,
            amount: transfer.amount,
            metadata: transfer.metadata
          } : null
          
        default:
          return null
      }
    }
    
    // In production, would fetch from Dwolla API
    return null
  }
  
  private compareStates(webhookState: any, actualState: any): Array<{
    type: string
    field: string
    expected: any
    actual: any
  }> {
    const discrepancies: any[] = []
    
    // Status comparison
    if (webhookState.status !== actualState.status) {
      discrepancies.push({
        type: 'status_mismatch',
        field: 'status',
        expected: webhookState.status,
        actual: actualState.status
      })
    }
    
    // Amount comparison
    if (webhookState.amount && actualState.amount) {
      const webhookAmount = parseFloat(webhookState.amount.value || webhookState.amount)
      const actualAmount = parseFloat(actualState.amount.value || actualState.amount)
      
      if (Math.abs(webhookAmount - actualAmount) > 0.01) {
        discrepancies.push({
          type: 'amount_mismatch',
          field: 'amount',
          expected: webhookAmount,
          actual: actualAmount
        })
      }
    }
    
    return discrepancies
  }
  
  private async recordDiscrepancy(
    resourceId: string,
    resourceType: string,
    discrepancyType: string,
    details: any
  ): Promise<void> {
    // In a full implementation, this would create proper discrepancy records
    log.warn('Batch reconciliation discrepancy', {
      resourceId,
      resourceType,
      discrepancyType,
      details
    })
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  private generateBatchSummary(results: BatchResult[]): {
    totalBatches: number
    totalProcessed: number
    totalSuccess: number
    totalErrors: number
    successRate: number
    duration: number
  } {
    const totalBatches = results.length
    const totalProcessed = results.reduce((sum, r) => sum + r.totalProcessed, 0)
    const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
    const successRate = totalProcessed > 0 ? (totalSuccess / totalProcessed) * 100 : 0
    
    const startTime = results[0]?.startTime.getTime() || Date.now()
    const endTime = results[results.length - 1]?.endTime.getTime() || Date.now()
    const duration = endTime - startTime
    
    return {
      totalBatches,
      totalProcessed,
      totalSuccess,
      totalErrors,
      successRate,
      duration
    }
  }
  
  // Catch-up reconciliation for historical data
  async performCatchUpReconciliation(
    resourceType: string,
    daysBack: number = 30
  ): Promise<BatchResult[]> {
    const endDate = new Date()
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    
    log.info('Starting catch-up reconciliation', {
      resourceType,
      daysBack,
      startDate,
      endDate
    })
    
    // Use larger batches for historical data
    const config: Partial<BatchConfig> = {
      batchSize: 500,
      parallelWorkers: 10
    }
    
    return this.performBatchReconciliation(
      resourceType as any,
      startDate,
      endDate,
      config
    )
  }
  
  // Real-time reconciliation for recent events
  async performRealtimeReconciliation(
    minutesBack: number = 5
  ): Promise<void> {
    const endDate = new Date()
    const startDate = new Date(Date.now() - minutesBack * 60 * 1000)
    
    // Process all resource types
    const resourceTypes: Array<'transfer' | 'customer' | 'funding_source'> = [
      'transfer',
      'customer', 
      'funding_source'
    ]
    
    for (const resourceType of resourceTypes) {
      try {
        await this.performBatchReconciliation(
          resourceType,
          startDate,
          endDate,
          {
            batchSize: 50,
            parallelWorkers: 3
          }
        )
      } catch (error) {
        log.error('Real-time reconciliation failed', error as Error, {
          resourceType
        })
      }
    }
  }
}

// Singleton instance
let reconciler: BatchReconciler | null = null

export function getBatchReconciler(): BatchReconciler {
  if (!reconciler) {
    reconciler = new BatchReconciler()
  }
  return reconciler
}