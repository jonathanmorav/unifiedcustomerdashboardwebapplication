import { DwollaClient } from "../lib/api/dwolla/client"
import { logger } from "../lib/logger"

async function debugDwollaSync() {
  try {
    console.log("\n=== Debugging Dwolla Sync ===\n")

    // Initialize Dwolla client
    const client = new DwollaClient({
      key: process.env.DWOLLA_KEY!,
      secret: process.env.DWOLLA_SECRET!,
      environment: process.env.DWOLLA_ENVIRONMENT === "production" ? "production" : "sandbox",
    })

    const accountId = process.env.DWOLLA_MASTER_ACCOUNT_ID
    console.log(`Master Account ID: ${accountId}`)

    // Fetch a single transfer to debug
    console.log("\nFetching transfers...")
    const response = await client.getTransfers({ limit: 1 })

    if (!response._embedded?.transfers?.length) {
      console.log("No transfers found")
      return
    }

    const transfer = response._embedded.transfers[0]
    console.log("\n=== Transfer Details ===")
    console.log(`ID: ${transfer.id}`)
    console.log(`Status: ${transfer.status}`)
    console.log(`Amount: ${transfer.amount.value} ${transfer.amount.currency}`)
    console.log(`Created: ${transfer.created}`)

    // Debug source
    console.log("\n=== Source Details ===")
    console.log(`Source URL: ${transfer._links.source.href}`)

    try {
      const sourceDetails = await client.getFundingSourceByUrl(transfer._links.source.href)
      console.log(`Source ID: ${sourceDetails.id}`)
      console.log(`Source Name: ${sourceDetails.name}`)
      console.log(`Source Type: ${sourceDetails.type}`)

      if (sourceDetails._links?.customer) {
        console.log(`\nSource Customer URL: ${sourceDetails._links.customer.href}`)
        try {
          const sourceCustomer = await client.getCustomerByUrl(sourceDetails._links.customer.href)
          console.log(`Source Customer: ${sourceCustomer.firstName} ${sourceCustomer.lastName}`)
          console.log(`Source Customer Email: ${sourceCustomer.email}`)
          console.log(`Source Customer Type: ${sourceCustomer.type}`)
          if (sourceCustomer.businessName) {
            console.log(`Source Business Name: ${sourceCustomer.businessName}`)
          }
        } catch (error) {
          console.error("Failed to fetch source customer:", error)
        }
      } else {
        console.log("No customer link in source funding source")
      }
    } catch (error) {
      console.error("Failed to fetch source details:", error)
    }

    // Debug destination
    console.log("\n=== Destination Details ===")
    console.log(`Destination URL: ${transfer._links.destination.href}`)

    try {
      const destDetails = await client.getFundingSourceByUrl(transfer._links.destination.href)
      console.log(`Destination ID: ${destDetails.id}`)
      console.log(`Destination Name: ${destDetails.name}`)
      console.log(`Destination Type: ${destDetails.type}`)

      if (destDetails._links?.customer) {
        console.log(`\nDestination Customer URL: ${destDetails._links.customer.href}`)
        try {
          const destCustomer = await client.getCustomerByUrl(destDetails._links.customer.href)
          console.log(`Destination Customer: ${destCustomer.firstName} ${destCustomer.lastName}`)
          console.log(`Destination Customer Email: ${destCustomer.email}`)
          console.log(`Destination Customer Type: ${destCustomer.type}`)
          if (destCustomer.businessName) {
            console.log(`Destination Business Name: ${destCustomer.businessName}`)
          }
        } catch (error) {
          console.error("Failed to fetch destination customer:", error)
        }
      } else {
        console.log("No customer link in destination funding source")
      }
    } catch (error) {
      console.error("Failed to fetch destination details:", error)
    }

    // Check metadata
    console.log("\n=== Metadata ===")
    console.log(JSON.stringify(transfer.metadata || {}, null, 2))
  } catch (error) {
    console.error("Debug failed:", error)
  }
}

debugDwollaSync()
