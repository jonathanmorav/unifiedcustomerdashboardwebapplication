import { prisma } from '@/lib/db'
import { getEventProcessingPipeline } from './processor'
import { log } from '@/lib/logger'

export class QueueProcessor {
  private isRunning = false
  private interval: NodeJS.Timeout | null = null
  
  start(intervalMs: number = 5000): void {
    if (this.isRunning) {
      log.warn('Queue processor already running')
      return
    }
    
    this.isRunning = true
    log.info('Starting queue processor', { intervalMs })
    
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
    
    log.info('Stopped queue processor')
  }
  
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return
    
    try {
      // Get queued events (oldest first)
      const queuedEvents = await prisma.webhookEvent.findMany({
        where: {
          processingState: 'queued',
          quarantined: false
        },
        orderBy: { createdAt: 'asc' },
        take: 10 // Process in batches
      })
      
      if (queuedEvents.length === 0) return
      
      log.debug(`Processing ${queuedEvents.length} queued events`)
      
      const pipeline = getEventProcessingPipeline()
      
      // Process events in parallel (max 5 at a time)
      const chunks = this.chunkArray(queuedEvents, 5)
      
      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map(event => pipeline.processEvent(event.id))
        )
      }
      
    } catch (error) {
      log.error('Queue processing error', error as Error)
    }
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

// Singleton instance
let processor: QueueProcessor | null = null

export function getQueueProcessor(): QueueProcessor {
  if (!processor) {
    processor = new QueueProcessor()
  }
  return processor
}