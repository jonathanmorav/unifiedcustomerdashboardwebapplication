import { NextRequest, NextResponse } from 'next/server'
import { getWebhookReceiver } from '@/lib/webhooks/receiver'
import { log } from '@/lib/logger'

/**
 * Enhanced Dwolla webhook endpoint with full event capture
 * POST /api/webhooks/dwolla/v2
 */
export async function POST(request: NextRequest) {
  const receiver = getWebhookReceiver()
  
  try {
    // Delegate to webhook receiver
    const response = await receiver.handleWebhook(request)
    return response
  } catch (error) {
    // This should rarely happen as receiver handles its own errors
    log.error('Catastrophic webhook error', error as Error)
    
    // Still return 200 to prevent Dwolla retries
    return NextResponse.json(
      { received: true, error: 'internal_error' },
      { status: 200 }
    )
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/webhooks/dwolla/v2',
    timestamp: new Date().toISOString()
  })
}