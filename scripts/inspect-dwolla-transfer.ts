import { DwollaClient } from "../lib/api/dwolla/client"
import dotenv from "dotenv"
import path from "path"

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

async function inspectTransfer() {
  try {
    const client = new DwollaClient()

    // Get one transfer
    const response = await client.getTransfers({ limit: 1 })
    const transfer = response._embedded?.transfers?.[0]

    if (!transfer) {
      console.log("No transfers found")
      return
    }

    console.log("\n=== Raw Transfer Object ===")
    console.log(JSON.stringify(transfer, null, 2))

    // Get funding source details
    console.log("\n=== Source Funding Source ===")
    const source = await client.getFundingSourceByUrl(transfer._links.source.href)
    console.log(JSON.stringify(source, null, 2))

    console.log("\n=== Destination Funding Source ===")
    const dest = await client.getFundingSourceByUrl(transfer._links.destination.href)
    console.log(JSON.stringify(dest, null, 2))
  } catch (error) {
    console.error("Inspection failed:", error)
  }
}

inspectTransfer()
