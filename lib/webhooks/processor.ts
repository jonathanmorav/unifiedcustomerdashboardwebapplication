import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { WebhookEvent, Prisma } from '@prisma/client'
import { getJourneyTracker } from './journey-tracker'
import { getRealtimeAnalyticsEngine } from '@/lib/analytics/realtime-engine'
import { ProcessingContext } from './processing-context'

export { ProcessingContext }

// Base processor interface
export interface EventProcessor {
  canProcess(event: WebhookEvent): boolean
  process(event: WebhookEvent, context: ProcessingContext): Promise<void>
}

// Transfer event processor
class TransferEventProcessor implements EventProcessor {
  canProcess(event: WebhookEvent): boolean {
    return event.resourceType === 'transfer' || 
           event.eventType.includes('transfer')
  }
  
  async process(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    const payload = event.payload as any
    
    // Extract transfer ID from resource URL
    const transferId = this.extractTransferId(payload._links?.resource?.href)
    if (!transferId) {
      throw new Error('Could not extract transfer ID from event')
    }
    
    // Find or create ACH transaction
    let transaction = await prisma.aCHTransaction.findUnique({
      where: { dwollaId: transferId }
    })
    
    if (!transaction) {
      // This might be the first event for this transfer
      transaction = await this.createTransactionFromEvent(event, transferId)
    }
    
    // Update transaction based on event type
    const updateData = await this.getUpdateData(event.eventType, payload)
    
    if (Object.keys(updateData).length > 0) {
      transaction = await prisma.aCHTransaction.update({
        where: { id: transaction.id },
        data: {
          ...updateData,
          lastWebhookAt: new Date(),
          webhookEvents: {
            push: {
              eventId: event.eventId,
              eventType: event.eventType,
              timestamp: event.eventTimestamp,
              payload: payload
            }
          }
        }
      })
    }
    
    // Create relationship
    await prisma.webhookEventRelation.create({
      data: {
        webhookEventId: event.id,
        relationType: 'transaction',
        relationId: transaction.id,
        relationTable: 'ACHTransaction',
        metadata: {
          transferId,
          status: transaction.status
        }
      }
    })
    
    // Add to context for journey tracking
    context.set('transaction', transaction)
    context.set('customerId', transaction.customerId)
  }
  
  private extractTransferId(resourceUrl?: string): string | null {
    if (!resourceUrl) return null
    const match = resourceUrl.match(/transfers\/([a-zA-Z0-9-]+)/)
    return match ? match[1] : null
  }
  
  private async createTransactionFromEvent(event: WebhookEvent, transferId: string): Promise<any> {
    const payload = event.payload as any
    
    return await prisma.aCHTransaction.create({
      data: {
        dwollaId: transferId,
        status: this.mapEventToStatus(event.eventType),
        amount: new Prisma.Decimal(0), // Will be updated when we get more info
        direction: 'unknown',
        created: event.eventTimestamp,
        correlationId: payload.correlationId,
        metadata: payload
      }
    })
  }
  
  private mapEventToStatus(eventType: string): string {
    const statusMap: Record<string, string> = {
      'transfer_created': 'pending',
      'transfer_completed': 'processed',
      'transfer_failed': 'failed',
      'transfer_cancelled': 'cancelled',
      'transfer_returned': 'returned',
      'transfer_reclaimed': 'reclaimed'
    }
    
    return statusMap[eventType] || 'unknown'
  }
  
  private async getUpdateData(eventType: string, payload: any): Promise<any> {
    const updateData: any = {}
    
    switch (eventType) {
      case 'transfer_completed':
        updateData.status = 'processed'
        updateData.processedAt = new Date()
        break
        
      case 'transfer_failed':
        updateData.status = 'failed'
        updateData.failureReason = payload.reason || 'Unknown failure reason'
        updateData.failureCode = payload.code
        break
        
      case 'transfer_cancelled':
        updateData.status = 'cancelled'
        break
        
      case 'transfer_returned':
        updateData.status = 'returned'
        updateData.returnCode = payload.returnCode
        updateData.failureReason = payload.reason
        break
    }
    
    return updateData
  }
}

// Customer event processor
class CustomerEventProcessor implements EventProcessor {
  canProcess(event: WebhookEvent): boolean {
    return event.resourceType === 'customer' || 
           event.eventType.includes('customer')
  }
  
  async process(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    const payload = event.payload as any
    const customerId = this.extractCustomerId(payload._links?.resource?.href)
    
    if (!customerId) {
      throw new Error('Could not extract customer ID from event')
    }
    
    // Store customer ID in context for journey tracking
    context.set('customerId', customerId)
    context.set('customerEvent', true)
    
    // Create relationship (we might not have a customer table yet)
    await prisma.webhookEventRelation.create({
      data: {
        webhookEventId: event.id,
        relationType: 'customer',
        relationId: customerId,
        relationTable: 'dwolla_customer',
        metadata: {
          eventType: event.eventType,
          timestamp: event.eventTimestamp
        }
      }
    })
  }
  
  private extractCustomerId(resourceUrl?: string): string | null {
    if (!resourceUrl) return null
    const match = resourceUrl.match(/customers\/([a-zA-Z0-9-]+)/)
    return match ? match[1] : null
  }
}

// Main event processing pipeline
export class EventProcessingPipeline {
  private processors: EventProcessor[] = []
  private journeyTracker = getJourneyTracker()
  private analyticsEngine = getRealtimeAnalyticsEngine()
  
  constructor() {
    // Register processors
    this.processors.push(new TransferEventProcessor())
    this.processors.push(new CustomerEventProcessor())
  }
  
  async processEvent(eventId: string): Promise<void> {
    let event: WebhookEvent | null = null
    
    try {
      // Get event and mark as processing
      event = await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { 
          processingState: 'processing',
          processingAttempts: { increment: 1 }
        }
      })
      
      const startTime = Date.now()
      const context = new ProcessingContext(event)
      
      // Enrich event with additional data
      await this.enrichEvent(event, context)
      
      // Find and run appropriate processor
      let processed = false
      for (const processor of this.processors) {
        if (processor.canProcess(event)) {
          await processor.process(event, context)
          processed = true
          break
        }
      }
      
      if (!processed) {
        log.warn('No processor found for event', {
          eventId: event.id,
          eventType: event.eventType,
          resourceType: event.resourceType
        })
      }
      
      // Update journey tracking (will be implemented separately)
      await this.updateJourneys(event, context)
      
      // Update analytics (will be implemented separately)
      await this.updateAnalytics(event, context)
      
      // Evaluate alerts (will be implemented separately)
      await this.evaluateAlerts(event, context)
      
      // Mark as completed
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingState: 'completed',
          processedAt: new Date(),
          processingDurationMs: Date.now() - startTime
        }
      })
      
      log.info('Event processed successfully', {
        eventId: event.id,
        eventType: event.eventType,
        duration: Date.now() - startTime
      })
      
    } catch (error) {
      await this.handleProcessingError(event, error as Error)
    }
  }
  
  private async enrichEvent(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    // Get recent events for the same resource
    if (event.resourceId) {
      const recentEvents = await prisma.webhookEvent.findMany({
        where: {
          resourceId: event.resourceId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { eventTimestamp: 'desc' },
        take: 10
      })
      
      context.set('recentEvents', recentEvents)
    }
    
    // Get active journeys for this resource
    if (event.resourceId) {
      const activeJourneys = await prisma.journeyInstance.findMany({
        where: {
          resourceId: event.resourceId,
          status: 'active'
        }
      })
      
      context.set('activeJourneys', activeJourneys)
    }
  }
  
  private async updateJourneys(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    try {
      await this.journeyTracker.processEvent(event, context)
    } catch (error) {
      log.error('Journey tracking failed', error as Error, {
        eventId: event.id
      })
    }
  }
  
  private async updateAnalytics(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    try {
      await this.analyticsEngine.processEvent(event, context)
    } catch (error) {
      log.error('Analytics update failed', error as Error, {
        eventId: event.id
      })
    }
  }
  
  private async evaluateAlerts(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    // Alert evaluation is handled within the analytics engine
    // This method is kept for future expansion (e.g., business rule alerts)
  }
  
  private async handleProcessingError(event: WebhookEvent | null, error: Error): Promise<void> {
    log.error('Event processing failed', error, {
      eventId: event?.id,
      eventType: event?.eventType
    })
    
    if (!event) return
    
    const shouldRetry = this.shouldRetry(event, error)
    
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        processingState: shouldRetry ? 'queued' : 'failed',
        lastProcessingError: error.message
      }
    })
    
    if (shouldRetry && event.processingAttempts < 3) {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, event.processingAttempts) * 1000
      setTimeout(() => {
        this.processEvent(event.id).catch(err => {
          log.error('Retry processing failed', err, { eventId: event.id })
        })
      }, delay)
    } else if (!shouldRetry || event.processingAttempts >= 3) {
      // Move to dead letter queue
      await this.moveToDeadLetter(event, error)
    }
  }
  
  private shouldRetry(event: WebhookEvent, error: Error): boolean {
    // Don't retry validation errors
    if (error.message.includes('validation')) return false
    
    // Don't retry if event is too old
    const age = Date.now() - event.eventTimestamp.getTime()
    if (age > 24 * 60 * 60 * 1000) return false // 24 hours
    
    // Retry most other errors
    return true
  }
  
  private async moveToDeadLetter(event: WebhookEvent, error: Error): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        processingState: 'quarantined',
        quarantined: true,
        quarantineReason: `Failed after ${event.processingAttempts} attempts: ${error.message}`,
        quarantinedAt: new Date()
      }
    })
    
    // Could also send notification to ops team here
  }
}

// Singleton instance
let pipeline: EventProcessingPipeline | null = null

export function getEventProcessingPipeline(): EventProcessingPipeline {
  if (!pipeline) {
    pipeline = new EventProcessingPipeline()
  }
  return pipeline
}