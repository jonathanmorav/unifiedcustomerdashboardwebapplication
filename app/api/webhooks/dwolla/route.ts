import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getReturnCodeInfo } from "@/lib/api/dwolla/return-codes"
import crypto from "crypto"
import { log } from "@/lib/logger"

/**
 * Verify Dwolla webhook signature
 */
async function verifyDwollaWebhook(
  request: NextRequest,
  payload: any
): Promise<boolean> {
  const signature = request.headers.get("X-Dwolla-Signature")
  const webhookSecret = process.env.DWOLLA_WEBHOOK_SECRET
  
  if (!signature || !webhookSecret) {
    log.warn("Missing webhook signature or secret")
    return false
  }
  
  // Dwolla uses HMAC-SHA256 for webhook signatures
  const computedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(payload))
    .digest("hex")
    
  return signature === computedSignature
}

/**
 * Handle Dwolla webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    // Log webhook receipt
    log.info("Received Dwolla webhook", {
      topic: payload.topic,
      timestamp: payload.timestamp,
      id: payload.id
    })
    
    // Verify webhook authenticity
    const isValid = await verifyDwollaWebhook(request, payload)
    if (!isValid) {
      log.error("Invalid webhook signature")
      return NextResponse.json(
        { error: "Invalid webhook signature" }, 
        { status: 401 }
      )
    }
    
    // Route to appropriate handler based on topic
    switch (payload.topic) {
      case "customer_transfer_completed":
      case "transfer_completed":
        await handleTransferCompleted(payload)
        break
        
      case "customer_transfer_failed":
      case "transfer_failed":
        await handleTransferFailed(payload)
        break
        
      case "customer_transfer_cancelled":
      case "transfer_cancelled":
        await handleTransferCancelled(payload)
        break
        
      case "customer_bank_transfer_completed":
      case "bank_transfer_completed":
        await handleBankTransferCompleted(payload)
        break
        
      case "customer_bank_transfer_failed":
      case "bank_transfer_failed":
        await handleBankTransferFailed(payload)
        break
        
      case "transfer_returned":
        await handleTransferReturned(payload)
        break
        
      case "transfer_reclaimed":
        await handleTransferReclaimed(payload)
        break
        
      default:
        log.info(`Unhandled webhook topic: ${payload.topic}`)
    }
    
    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error) {
    log.error("Webhook processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" }, 
      { status: 400 }
    )
  }
}

/**
 * Handle transfer completed event
 */
async function handleTransferCompleted(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  
  log.info(`Transfer completed: ${transferId}`)
  
  // Update transaction status
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "completed",
      processedAt: new Date(),
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          id: payload.id,
          details: payload
        }
      }
    }
  }).catch(error => {
    log.error(`Failed to update completed transaction ${transferId}:`, error)
  })
}

/**
 * Handle transfer failed event
 */
async function handleTransferFailed(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  
  // Extract failure information from payload
  const failureReason = payload.description || payload.reasonDescription || "Transfer failed"
  const failureCode = payload.code || payload.reasonCode || null
  const returnCode = payload.achDetails?.returnCode || payload.achReturnCode || null
  
  log.warn(`Transfer failed: ${transferId}`, {
    reason: failureReason,
    code: failureCode,
    returnCode: returnCode
  })
  
  // Update transaction with failure details
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "failed",
      failureReason,
      failureCode,
      returnCode,
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          id: payload.id,
          reason: failureReason,
          code: failureCode,
          returnCode: returnCode,
          details: payload
        }
      }
    }
  }).catch(error => {
    log.error(`Failed to update failed transaction ${transferId}:`, error)
  })
}

/**
 * Handle transfer cancelled event
 */
async function handleTransferCancelled(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  
  log.info(`Transfer cancelled: ${transferId}`)
  
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "cancelled",
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          id: payload.id,
          details: payload
        }
      }
    }
  }).catch(error => {
    log.error(`Failed to update cancelled transaction ${transferId}:`, error)
  })
}

/**
 * Handle bank transfer completed event
 */
async function handleBankTransferCompleted(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  
  log.info(`Bank transfer completed: ${transferId}`)
  
  // Update clearing date for bank transfers
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      clearingDate: new Date(),
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          id: payload.id,
          details: payload
        }
      }
    }
  }).catch(error => {
    log.error(`Failed to update bank transfer ${transferId}:`, error)
  })
}

/**
 * Handle bank transfer failed event
 */
async function handleBankTransferFailed(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  
  log.warn(`Bank transfer failed: ${transferId}`)
  
  // Similar to regular transfer failure but for bank transfers
  await handleTransferFailed(payload)
}

/**
 * Handle transfer returned event (ACH return)
 */
async function handleTransferReturned(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  const returnCode = payload.returnCode || payload.achReturnCode || payload.code
  
  log.warn(`Transfer returned: ${transferId} with code ${returnCode}`)
  
  // Get detailed return code information
  const returnCodeInfo = returnCode ? getReturnCodeInfo(returnCode) : null
  
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "returned",
      returnCode,
      failureReason: returnCodeInfo?.title || `ACH Return: ${returnCode}`,
      failureCode: returnCode,
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          id: payload.id,
          returnCode,
          returnCodeInfo: returnCodeInfo ? {
            title: returnCodeInfo.title,
            description: returnCodeInfo.description,
            retryable: returnCodeInfo.retryable,
            category: returnCodeInfo.category,
            userAction: returnCodeInfo.userAction
          } : null,
          details: payload
        }
      }
    }
  }).catch(error => {
    log.error(`Failed to update returned transaction ${transferId}:`, error)
  })
  
  // TODO: Send notification for non-retryable returns
  if (returnCodeInfo && !returnCodeInfo.retryable) {
    log.warn(`Non-retryable return for ${transferId}: ${returnCode} - ${returnCodeInfo.title}`)
    // Implement notification logic here
  }
}

/**
 * Handle transfer reclaimed event
 */
async function handleTransferReclaimed(payload: any) {
  const transferUrl = payload._links?.resource?.href
  if (!transferUrl) return
  
  const transferId = transferUrl.split("/").pop()
  
  log.warn(`Transfer reclaimed: ${transferId}`)
  
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "reclaimed",
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          id: payload.id,
          details: payload
        }
      }
    }
  }).catch(error => {
    log.error(`Failed to update reclaimed transaction ${transferId}:`, error)
  })
}

/**
 * Handle OPTIONS request for CORS
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Dwolla-Signature",
    },
  })
}