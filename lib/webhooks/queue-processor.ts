import { prisma } from '@/lib/db'
import { getEventProcessingPipeline } from './processor'
import { log } from '@/lib/logger'

export class QueueProcessor {
  private isRunning = false
  private interval: NodeJS.Timeout | null = null
  private processingCount = 0
  private maxConcurrency = 5
  
  start(intervalMs: number = 5000): void {
    if (this.isRunning) {
      log.warn('Queue processor already running')
      return
    }
    
    this.isRunning = true
    log.info('Starting webhook queue processor', { intervalMs, maxConcurrency: this.maxConcurrency })
    
    // Process immediately
    this.processQueue()
    
    // Then process on interval
    this.interval = setInterval(() => {
      this.processQueue()
    }, intervalMs)
  }
  
  stop(): void {
    if (!this.isRunning) return
    
    this.isRunning = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    
    log.info('Webhook queue processor stopped')
  }
  
  isActive(): boolean {
    return this.isRunning
  }
  
  getStatus(): { isRunning: boolean; processingCount: number; maxConcurrency: number } {
    return {
      isRunning: this.isRunning,
      processingCount: this.processingCount,
      maxConcurrency: this.maxConcurrency
    }
  }
  
  private async processQueue(): Promise<void> {
    if (!this.isRunning || this.processingCount >= this.maxConcurrency) return
    
    try {
      // Get queued events (oldest first)
      const queuedEvents = await prisma.webhookEvent.findMany({
        where: {
          processingState: 'queued',
          quarantined: false
        },
        orderBy: { createdAt: 'asc' },
        take: Math.min(10, this.maxConcurrency - this.processingCount) // Process in batches
      })
      
      if (queuedEvents.length === 0) return
      
      log.debug(`Processing ${queuedEvents.length} queued webhook events`)
      
      const pipeline = getEventProcessingPipeline()
      
      // Process events with concurrency control
      const promises = queuedEvents.map(async (event) => {
        this.processingCount++
        try {
          await pipeline.processEvent(event.id)
        } catch (error) {
          log.error('Failed to process webhook event', error as Error, {
            eventId: event.id,
            eventType: event.eventType
          })
        } finally {
          this.processingCount--
        }
      })
      
      await Promise.allSettled(promises)
      
    } catch (error) {
      log.error('Queue processing error', error as Error)
    }
  }
}

// Singleton instance
let queueProcessor: QueueProcessor | null = null

export function getQueueProcessor(): QueueProcessor {
  if (!queueProcessor) {
    queueProcessor = new QueueProcessor()
  }
  return queueProcessor
}

// Auto-start the queue processor in production
// Auto-start the queue processor in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_QUEUE_PROCESSOR === 'true') {
  const processor = getQueueProcessor()
  processor.start()

  let shutdownInProgress = false

  const gracefulShutdown = async (signal: string) => {
    if (shutdownInProgress) return
    shutdownInProgress = true

    log.info(`${signal} received, stopping queue processor`)
    processor.stop()

    // Wait for active processing to complete (with timeout)
    const timeout = setTimeout(() => {
      log.warn('Shutdown timeout reached, forcing exit')
      process.exit(0)
    }, 30000) // 30 second timeout

    // Wait for processing to complete
    while (processor.getStatus().processingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    clearTimeout(timeout)
    process.exit(0)
  }

  // Handle graceful shutdown
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.once('SIGINT', () => gracefulShutdown('SIGINT'))
}