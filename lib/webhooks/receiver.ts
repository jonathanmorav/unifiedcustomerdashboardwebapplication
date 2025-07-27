import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import crypto from 'crypto'
import { z } from 'zod'

// Webhook event schema for validation
const webhookEventSchema = z.object({
  id: z.string(),
  resourceId: z.string().optional(),
  topic: z.string(),
  timestamp: z.string(),
  _links: z.object({
    self: z.object({
      href: z.string(),
    }),
    resource: z.object({
      href: z.string(),
    }).optional(),
  }).optional(),
})

// Circuit breaker configuration
interface CircuitBreakerConfig {
  errorThreshold: number
  resetTimeout: number
  monitoringWindow: number
}

class CircuitBreaker {
  private failures = 0
  private lastFailureTime: Date | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime?.getTime() || 0) > this.config.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failures = 0
      }
      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = new Date()
      
      if (this.failures >= this.config.errorThreshold) {
        this.state = 'open'
      }
      
      throw error
    }
  }
  
  isOpen(): boolean {
    return this.state === 'open'
  }
}

// Deduplication service using Redis-like in-memory cache
class DeduplicationService {
  private cache = new Map<string, { timestamp: Date; count: number }>()
  private cleanupInterval: NodeJS.Timeout
  
  constructor(private ttl: number = 7 * 24 * 60 * 60 * 1000) { // 7 days
    // Cleanup old entries every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000)
  }
  
  async isDuplicate(eventId: string): Promise<{ isDuplicate: boolean; count: number }> {
    const existing = this.cache.get(eventId)
    
    if (existing) {
      existing.count++
      return { isDuplicate: true, count: existing.count }
    }
    
    // Check database for recent duplicates
    const dbEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
      select: { id: true, duplicateCount: true }
    })
    
    if (dbEvent) {
      this.cache.set(eventId, { timestamp: new Date(), count: dbEvent.duplicateCount + 1 })
      return { isDuplicate: true, count: dbEvent.duplicateCount + 1 }
    }
    
    this.cache.set(eventId, { timestamp: new Date(), count: 0 })
    return { isDuplicate: false, count: 0 }
  }
  
  private cleanup() {
    const now = Date.now()
    for (const [eventId, data] of this.cache.entries()) {
      if (now - data.timestamp.getTime() > this.ttl) {
        this.cache.delete(eventId)
      }
    }
  }
  
  destroy() {
    clearInterval(this.cleanupInterval)
  }
}

// Main webhook receiver class
export class WebhookReceiver {
  private circuitBreaker: CircuitBreaker
  private deduplicationService: DeduplicationService
  
  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      errorThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 300000 // 5 minutes
    })
    
    this.deduplicationService = new DeduplicationService()
  }
  
  async handleWebhook(request: NextRequest): Promise<Response> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      // Extract headers
      const headers = this.extractHeaders(request)
      const sourceIp = this.getSourceIp(request)
      
      // Parse payload
      const payload = await this.parsePayload(request)
      
      // Quick validation
      const validation = this.validatePayload(payload)
      if (!validation.success) {
        log.warn('Invalid webhook payload', {
          requestId,
          errors: validation.errors,
          payload
        })
      }
      
      // Verify signature
      const signatureValid = await this.verifySignature(request, payload)
      
      // Check for duplicates
      const { isDuplicate, count } = await this.deduplicationService.isDuplicate(payload.id)
      
      // Store event (even if duplicate for tracking)
      const event = await this.storeEvent({
        eventId: payload.id,
        eventType: this.extractEventType(payload.topic),
        resourceId: payload.resourceId,
        resourceType: this.extractResourceType(payload),
        resourceUri: payload._links?.resource?.href,
        topic: payload.topic,
        eventTimestamp: new Date(payload.timestamp),
        headers,
        payload,
        payloadSize: JSON.stringify(payload).length,
        signature: headers['x-dwolla-signature'],
        signatureValid,
        verificationMethod: signatureValid ? 'signature' : 'none',
        sourceIp,
        isDuplicate,
        duplicateCount: count,
        validationStatus: validation.success ? 'valid' : 'warning',
        validationErrors: validation.errors,
        processingState: isDuplicate ? 'completed' : 'received',
        partitionKey: this.generatePartitionKey(payload),
        source: 'webhook'
      })
      
      // Queue for processing if not duplicate
      if (!isDuplicate && !this.circuitBreaker.isOpen()) {
        await this.queueForProcessing(event)
      }
      
      // Update metrics
      const duration = Date.now() - startTime
      await this.updateMetrics({
        duration,
        success: true,
        isDuplicate,
        eventType: event.eventType
      })
      
      log.info('Webhook processed', {
        requestId,
        eventId: event.id,
        eventType: event.eventType,
        duration,
        isDuplicate
      })
      
      // Return success response
      return new Response(JSON.stringify({
        received: true,
        eventId: event.eventId,
        duplicate: isDuplicate,
        processingTime: duration
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      })
      
    } catch (error) {
      // Log error but still return 200 to prevent retries
      log.error('Webhook processing error', error as Error, {
        requestId,
        duration: Date.now() - startTime
      })
      
      // Store raw request for later recovery if possible
      try {
        await this.storeFailedRequest(request, error as Error)
      } catch (storeError) {
        log.error('Failed to store failed request', storeError as Error)
      }
      
      return new Response(JSON.stringify({
        received: true,
        error: true,
        requestId
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      })
    }
  }
  
  private extractHeaders(request: NextRequest): Record<string, string> {
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })
    return headers
  }
  
  private getSourceIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0] || 
           request.headers.get('x-real-ip') || 
           'unknown'
  }
  
  private async parsePayload(request: NextRequest): Promise<any> {
    const text = await request.text()
    return JSON.parse(text)
  }
  
  private validatePayload(payload: any): { success: boolean; errors?: any[] } {
    try {
      webhookEventSchema.parse(payload)
      return { success: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error.errors }
      }
      return { success: false, errors: [{ message: 'Unknown validation error' }] }
    }
  }
  
  private async verifySignature(request: NextRequest, payload: any): Promise<boolean> {
    const signature = request.headers.get('x-dwolla-signature')
    const secret = process.env.DWOLLA_WEBHOOK_SECRET
    
    if (!signature || !secret) {
      return false
    }
    
    try {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex')
      
      return signature === hash
    } catch (error) {
      log.error('Signature verification error', error as Error)
      return false
    }
  }
  
  private extractEventType(topic: string): string {
    // Extract the main event type from topic
    // e.g., "customer_bank_transfer_completed" -> "bank_transfer_completed"
    const parts = topic.split('_')
    if (parts[0] === 'customer' && parts.length > 2) {
      return parts.slice(1).join('_')
    }
    return topic
  }
  
  private extractResourceType(payload: any): string | null {
    if (payload._links?.resource?.href) {
      const url = payload._links.resource.href
      if (url.includes('/transfers/')) return 'transfer'
      if (url.includes('/customers/')) return 'customer'
      if (url.includes('/funding-sources/')) return 'funding_source'
      if (url.includes('/accounts/')) return 'account'
    }
    return null
  }
  
  private generatePartitionKey(payload: any): string {
    // Generate partition key for efficient querying
    const date = new Date(payload.timestamp)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  
  private async storeEvent(data: any): Promise<any> {
    return await this.circuitBreaker.execute(async () => {
      return await prisma.webhookEvent.create({
        data: {
          ...data,
          schemaVersion: '1.0'
        }
      })
    })
  }
  
  private async queueForProcessing(event: any): Promise<void> {
    // In a production system, this would publish to a message queue
    // For now, we'll use a simple database flag
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processingState: 'queued' }
    })
    
    // Trigger async processing (in production, this would be a separate service)
    setImmediate(() => {
      this.processEvent(event.id).catch(error => {
        log.error('Async processing error', error, { eventId: event.id })
      })
    })
  }
  
  private async processEvent(eventId: string): Promise<void> {
    // Import and use the event processing pipeline
    const { getEventProcessingPipeline } = await import('./processor')
    const pipeline = getEventProcessingPipeline()
    
    try {
      await pipeline.processEvent(eventId)
    } catch (error) {
      log.error('Event processing failed', error as Error, { eventId })
    }
  }
  
  private async updateMetrics(metrics: any): Promise<void> {
    // Update real-time metrics
    // This will be implemented with the analytics engine
    log.debug('Metrics updated', metrics)
  }
  
  private async storeFailedRequest(request: NextRequest, error: Error): Promise<void> {
    // Store failed requests for manual recovery
    const headers = this.extractHeaders(request)
    const body = await request.text().catch(() => 'Failed to read body')
    
    await prisma.webhookEvent.create({
      data: {
        eventId: `failed-${Date.now()}-${crypto.randomUUID()}`,
        eventType: 'failed_webhook',
        topic: 'system.webhook.failed',
        eventTimestamp: new Date(),
        headers,
        payload: { 
          error: error.message, 
          body: body.substring(0, 1000) // Limit size
        },
        payloadSize: body.length,
        processingState: 'failed',
        lastProcessingError: error.message,
        validationStatus: 'invalid',
        partitionKey: this.generatePartitionKey({ timestamp: new Date().toISOString() }),
        source: 'webhook'
      }
    })
  }
}

// Singleton instance
let receiver: WebhookReceiver | null = null

export function getWebhookReceiver(): WebhookReceiver {
  if (!receiver) {
    receiver = new WebhookReceiver()
  }
  return receiver
}