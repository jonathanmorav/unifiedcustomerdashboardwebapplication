#!/usr/bin/env node

/**
 * Test utility for Dwolla webhook integration
 * 
 * Usage:
 * npm run test:webhook -- --event transfer_failed --code R01
 * npm run test:webhook -- --event transfer_returned --code R02
 * npm run test:webhook -- --event transfer_completed
 */

import crypto from "crypto"
import { program } from "commander"

// Webhook event templates
const eventTemplates = {
  transfer_completed: {
    topic: "transfer_completed",
    timestamp: new Date().toISOString(),
    id: `event_${Math.random().toString(36).substr(2, 9)}`,
    resourceId: `transfer_${Math.random().toString(36).substr(2, 9)}`,
    _links: {
      self: {
        href: "https://api.dwolla.com/events/event_id"
      },
      account: {
        href: "https://api.dwolla.com/accounts/account_id"
      },
      resource: {
        href: "https://api.dwolla.com/transfers/transfer_id"
      }
    }
  },
  
  transfer_failed: {
    topic: "transfer_failed",
    timestamp: new Date().toISOString(),
    id: `event_${Math.random().toString(36).substr(2, 9)}`,
    resourceId: `transfer_${Math.random().toString(36).substr(2, 9)}`,
    description: "Transfer failed",
    reasonCode: "R01",
    _links: {
      self: {
        href: "https://api.dwolla.com/events/event_id"
      },
      account: {
        href: "https://api.dwolla.com/accounts/account_id"
      },
      resource: {
        href: "https://api.dwolla.com/transfers/transfer_id"
      }
    }
  },
  
  transfer_returned: {
    topic: "transfer_returned",
    timestamp: new Date().toISOString(),
    id: `event_${Math.random().toString(36).substr(2, 9)}`,
    resourceId: `transfer_${Math.random().toString(36).substr(2, 9)}`,
    returnCode: "R01",
    achReturnCode: "R01",
    _links: {
      self: {
        href: "https://api.dwolla.com/events/event_id"
      },
      account: {
        href: "https://api.dwolla.com/accounts/account_id"
      },
      resource: {
        href: "https://api.dwolla.com/transfers/transfer_id"
      }
    }
  },
  
  customer_transfer_failed: {
    topic: "customer_transfer_failed",
    timestamp: new Date().toISOString(),
    id: `event_${Math.random().toString(36).substr(2, 9)}`,
    resourceId: `transfer_${Math.random().toString(36).substr(2, 9)}`,
    description: "Customer transfer failed",
    reasonCode: "R01",
    achDetails: {
      returnCode: "R01"
    },
    _links: {
      self: {
        href: "https://api.dwolla.com/events/event_id"
      },
      customer: {
        href: "https://api.dwolla.com/customers/customer_id"
      },
      resource: {
        href: "https://api.dwolla.com/transfers/transfer_id"
      }
    }
  }
}

// ACH return codes for testing
const commonReturnCodes = [
  "R01", // Insufficient Funds
  "R02", // Account Closed
  "R03", // No Account
  "R04", // Invalid Account Number
  "R07", // Authorization Revoked
  "R08", // Payment Stopped
  "R10", // Customer Advises Not Authorized
  "R16", // Account Frozen
  "R20", // Non-Transaction Account
  "R29"  // Corporate Customer Not Authorized
]

program
  .name("test-dwolla-webhook")
  .description("Test Dwolla webhook integration")
  .version("1.0.0")

program
  .option("-e, --event <type>", "Event type", "transfer_failed")
  .option("-c, --code <code>", "Return code for failed/returned events", "R01")
  .option("-t, --transfer-id <id>", "Specific transfer ID")
  .option("-u, --url <url>", "Webhook URL", "http://localhost:3000/api/webhooks/dwolla")
  .option("-s, --secret <secret>", "Webhook secret", process.env.DWOLLA_WEBHOOK_SECRET || "test-secret")
  .option("-d, --dry-run", "Print payload without sending")
  .option("-r, --random-code", "Use random return code")
  .parse()

const options = program.opts()

async function sendWebhook() {
  // Get event template
  const template = eventTemplates[options.event as keyof typeof eventTemplates]
  if (!template) {
    console.error(`Unknown event type: ${options.event}`)
    console.log("Available events:", Object.keys(eventTemplates).join(", "))
    process.exit(1)
  }
  
  // Create payload
  const payload = { ...template }
  
  // Update with specific options
  if (options.transferId) {
    payload.resourceId = options.transferId
    payload._links.resource.href = `https://api.dwolla.com/transfers/${options.transferId}`
  }
  
  // Add return code for failed/returned events
  if (options.event.includes("failed") || options.event.includes("returned")) {
    const returnCode = options.randomCode 
      ? commonReturnCodes[Math.floor(Math.random() * commonReturnCodes.length)]
      : options.code
      
    if (payload.topic === "transfer_returned") {
      const returnPayload = payload as { returnCode?: string; achReturnCode?: string }
      returnPayload.returnCode = returnCode
      returnPayload.achReturnCode = returnCode
    } else if (payload.topic === "transfer_failed" || payload.topic === "customer_transfer_failed") {
      const failedPayload = payload as { reasonCode?: string; achDetails?: { returnCode?: string }; description?: string }
      failedPayload.reasonCode = returnCode
      if (failedPayload.achDetails) {
        failedPayload.achDetails.returnCode = returnCode
      }
      failedPayload.description = `Transfer failed with return code ${returnCode}`
    }
  }
  
  // Generate signature
  const signature = crypto
    .createHmac("sha256", options.secret)
    .update(JSON.stringify(payload))
    .digest("hex")
  
  console.log("\n📤 Webhook Test")
  console.log("================")
  console.log(`Event: ${payload.topic}`)
  console.log(`URL: ${options.url}`)
  if (options.event.includes("failed") || options.event.includes("returned")) {
    const returnPayload = payload as { returnCode?: string; reasonCode?: string }
    console.log(`Return Code: ${returnPayload.returnCode || returnPayload.reasonCode}`)
  }
  console.log(`Signature: ${signature}`)
  console.log("\nPayload:")
  console.log(JSON.stringify(payload, null, 2))
  
  if (options.dryRun) {
    console.log("\n✅ Dry run complete (not sent)")
    return
  }
  
  // Send webhook
  try {
    console.log("\n🚀 Sending webhook...")
    const response = await fetch(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dwolla-Signature": signature
      },
      body: JSON.stringify(payload)
    })
    
    const responseData = await response.text()
    
    console.log(`\n📨 Response Status: ${response.status} ${response.statusText}`)
    if (responseData) {
      try {
        console.log("Response:", JSON.stringify(JSON.parse(responseData), null, 2))
      } catch {
        console.log("Response:", responseData)
      }
    }
    
    if (response.ok) {
      console.log("\n✅ Webhook sent successfully!")
    } else {
      console.log("\n❌ Webhook failed!")
    }
  } catch (error) {
    console.error("\n❌ Error sending webhook:", error)
  }
}

// Add example commands
if (!process.argv.slice(2).length) {
  console.log("\n📚 Examples:")
  console.log("  npm run test:webhook -- --event transfer_failed --code R01")
  console.log("  npm run test:webhook -- --event transfer_returned --code R02")
  console.log("  npm run test:webhook -- --event transfer_completed")
  console.log("  npm run test:webhook -- --event customer_transfer_failed --random-code")
  console.log("  npm run test:webhook -- --dry-run")
  console.log("\nUse --help for all options")
} else {
  sendWebhook()
}