#!/usr/bin/env tsx

import crypto from 'crypto'

async function sendTestWebhook() {
  const webhookUrl = 'http://localhost:3000/api/webhooks/dwolla/v2'
  const secret = process.env.DWOLLA_WEBHOOK_SECRET || 'cVjM0Ww1kV4RJPC1UVfXWBt8OCi0FDjyyqRxWNRoJuY='
  
  // Sample webhook payload
  const payload = {
    id: `test-webhook-${Date.now()}`,
    resourceId: 'test-transfer-123',
    topic: 'transfer:completed',
    timestamp: new Date().toISOString(),
    _links: {
      self: {
        href: 'https://api.dwolla.com/events/test-event'
      },
      resource: {
        href: 'https://api.dwolla.com/transfers/test-transfer-123'
      }
    }
  }
  
  // Generate signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
  
  console.log('📤 Sending test webhook to:', webhookUrl)
  console.log('📦 Payload:', JSON.stringify(payload, null, 2))
  console.log('🔐 Signature:', signature)
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dwolla-signature': signature
      },
      body: JSON.stringify(payload)
    })
    
    const result = await response.text()
    console.log('📨 Response status:', response.status)
    console.log('📨 Response:', result)
    
    if (response.ok) {
      console.log('✅ Webhook sent successfully!')
    } else {
      console.log('❌ Webhook failed')
    }
  } catch (error) {
    console.error('❌ Error sending webhook:', error)
  }
}

// Run the test
sendTestWebhook().catch(console.error)