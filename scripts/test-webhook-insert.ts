#!/usr/bin/env tsx

import { prisma } from "@/lib/db"

async function testWebhookInsert() {
  console.log("🧪 Testing webhook event insertion...\n")

  try {
    // Create a test webhook event
    const testEvent = await prisma.webhookEvent.create({
      data: {
        eventId: `test-${Date.now()}`,
        eventType: "customer_transfer_completed",
        topic: "customer_transfer_completed",
        resourceId: "test-resource-123",
        resourceType: "transfer",
        eventTimestamp: new Date(),
        headers: { "content-type": "application/json" },
        payload: {
          id: "test-transfer-123",
          status: "completed",
          amount: { value: "100.00", currency: "USD" }
        },
        payloadSize: 150,
        processingState: "received",
        partitionKey: "dwolla-test",
        signatureValid: true,
        verificationMethod: "webhook-signature",
      }
    })

    console.log("✅ Successfully created test webhook event:")
    console.log(`   ID: ${testEvent.id}`)
    console.log(`   Event ID: ${testEvent.eventId}`)
    console.log(`   Type: ${testEvent.eventType}`)
    console.log(`   State: ${testEvent.processingState}`)

    // Clean up the test event
    await prisma.webhookEvent.delete({
      where: { id: testEvent.id }
    })
    console.log("\n🧹 Test event cleaned up")

    console.log("\n✨ Webhook system is working correctly!")
  } catch (error) {
    console.error("❌ Error testing webhook insert:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testWebhookInsert()