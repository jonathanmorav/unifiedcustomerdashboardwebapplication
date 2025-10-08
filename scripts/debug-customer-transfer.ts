import { DwollaClient } from "../lib/api/dwolla/client"
import dotenv from "dotenv"
import path from "path"

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

async function debugCustomerTransfer() {
  try {
    const client = new DwollaClient()

    console.log("\n=== Debugging Customer Transfer ===\n")

    // Get the specific transfer with customer as source
    const transferId = "eefffe9e-1967-f011-ac7e-0a27ad48efdb"

    console.log(`Fetching transfer ${transferId}...`)
    const transfer = await client.getTransfer(transferId)

    console.log("\nTransfer details:")
    console.log(JSON.stringify(transfer, null, 2))

    // The source is a customer URL, not a funding source
    const sourceUrl = transfer._links?.source.href
    console.log(`\nSource URL: ${sourceUrl}`)

    if (sourceUrl && sourceUrl.includes("/customers/")) {
      console.log("Source is a CUSTOMER (direct debit)")

      // For customer sources, we need to get the customer directly
      try {
        const customer = await client.getCustomerByUrl(sourceUrl!)
        console.log("\nCustomer details:")
        console.log(`Name: ${customer.firstName} ${customer.lastName}`)
        console.log(`Email: ${customer.email}`)
        console.log(`Type: ${customer.type}`)
        if (customer.businessName) {
          console.log(`Business: ${customer.businessName}`)
        }
      } catch (error) {
        console.error("Error fetching customer:", error)
      }
    }

    // Check if transfer has source-funding-source link
    if (transfer._links?.["source-funding-source"]) {
      console.log("\nTransfer has source-funding-source link!")
      const sourceFundingSource = await client.getFundingSourceByUrl(
        transfer._links?.["source-funding-source"].href
      )
      console.log("Source Funding Source:", sourceFundingSource.name)
      console.log("Type:", sourceFundingSource.type)
    }
  } catch (error) {
    console.error("Debug failed:", error)
  }
}

debugCustomerTransfer()
