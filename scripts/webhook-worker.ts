#!/usr/bin/env tsx

import { prisma } from '@/lib/db'
import { QueueProcessor } from '@/lib/webhooks/queue-processor'
import { WebhookReceiver } from '@/lib/webhooks/receiver'
import { log } from '@/lib/logger'

// Worker process for webhook processing
async function startWebhookWorker() {
  console.log('🚀 Starting webhook worker process...')
  
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected')
    
    // Initialize webhook receiver
    const receiver = new WebhookReceiver()
    console.log('✅ Webhook receiver initialized')
    
    // Initialize queue processor
    const processor = new QueueProcessor()
    console.log('✅ Queue processor initialized')
    
    // Start processing webhooks
    await processor.start()
    console.log('✅ Webhook worker started successfully')
    console.log('📊 Processing webhooks from queue...')
    
    // Keep the process alive
    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...')
      await processor.stop()
      await prisma.$disconnect()
      process.exit(0)
    })
    
    process.on('SIGINT', async () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...')
      await processor.stop()
      await prisma.$disconnect()
      process.exit(0)
    })
    
    // Log status every 30 seconds
    setInterval(async () => {
      const queuedCount = await prisma.webhookEvent.count({
        where: { processingState: 'queued' }
      })
      const processingCount = await prisma.webhookEvent.count({
        where: { processingState: 'processing' }
      })
      
      console.log(`📊 Status: ${queuedCount} queued, ${processingCount} processing`)
    }, 30000)
    
  } catch (error) {
    console.error('❌ Failed to start webhook worker:', error)
    process.exit(1)
  }
}

// Start the worker
startWebhookWorker().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})