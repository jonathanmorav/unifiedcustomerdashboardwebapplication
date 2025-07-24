import { DwollaClient } from "../lib/api/dwolla/client"
import { prisma } from "../lib/db"
import dotenv from "dotenv"
import path from "path"

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

async function syncCustomerOnly() {
  try {
    console.log("\n=== Syncing Customer Transfers Only ===\n")

    const client = new DwollaClient()
    let customerTransferCount = 0
    let offset = 0
    const limit = 100
    const targetCount = 300

    while (customerTransferCount < targetCount) {
      console.log(`\nFetching batch at offset ${offset}...`)

      const response = await client.getTransfers({
        limit,
        offset,
      })

      const transfers = response._embedded?.transfers || []

      if (transfers.length === 0) {
        console.log("No more transfers available")
        break
      }

      console.log(`Processing ${transfers.length} transfers...`)

      for (const transfer of transfers) {
        // Check if this is a customer transfer
        const sourceUrl = transfer._links.source.href
        const destUrl = transfer._links.destination.href

        // Skip if both are accounts/banks (not customer transfers)
        if (!sourceUrl.includes("/customers/") && !destUrl.includes("/customers/")) {
          continue
        }

        // This is a customer transfer - enrich and save it
        try {
          let customerDetails = null
          let customerEmail = null
          let customerName = null
          let companyName = null

          if (sourceUrl.includes("/customers/")) {
            // Customer is source (debit)
            const customer = await client.getCustomerByUrl(sourceUrl)
            customerDetails = customer
            customerEmail = customer.email
            customerName = `${customer.firstName} ${customer.lastName}`
            companyName = customer.businessName
          } else if (destUrl.includes("/customers/")) {
            // Customer is destination (credit)
            const customer = await client.getCustomerByUrl(destUrl)
            customerDetails = customer
            customerEmail = customer.email
            customerName = `${customer.firstName} ${customer.lastName}`
            companyName = customer.businessName
          }

          if (customerEmail) {
            // Save to database
            await prisma.aCHTransaction.create({
              data: {
                dwollaId: transfer.id,
                status: transfer.status,
                amount: parseFloat(transfer.amount.value),
                currency: transfer.amount.currency,
                direction: destUrl.includes(process.env.DWOLLA_MASTER_ACCOUNT_ID)
                  ? "credit"
                  : "debit",
                created: new Date(transfer.created),
                sourceId: sourceUrl.split("/").pop(),
                sourceName: sourceUrl.includes("/customers/")
                  ? customerName
                  : "Cakewalk Benefits Inc.",
                destinationId: destUrl.split("/").pop(),
                destinationName: destUrl.includes("/customers/")
                  ? customerName
                  : "Cakewalk Benefits Inc.",
                correlationId: transfer.correlationId,
                individualAchId: transfer.individualAchId,
                customerName,
                customerEmail,
                companyName,
                metadata: {},
              },
            })

            customerTransferCount++
            console.log(`✓ Saved customer transfer ${customerTransferCount}: ${customerName}`)

            if (customerTransferCount >= targetCount) {
              break
            }
          }
        } catch (error) {
          console.error(`Error processing transfer ${transfer.id}:`, error.message)
        }
      }

      offset += limit

      // Safety limit to prevent infinite loop
      if (offset > 2000) {
        console.log("Reached maximum offset, stopping")
        break
      }
    }

    console.log(`\n=== Sync Complete ===`)
    console.log(`Total customer transfers synced: ${customerTransferCount}`)
  } catch (error) {
    console.error("Sync failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}

syncCustomerOnly()
