#!/usr/bin/env tsx
// Script to fetch your Dwolla Account ID using your API credentials
// Run with: npx tsx scripts/get-dwolla-account-id.ts

import { DwollaTokenManager } from "../lib/api/dwolla/auth"

async function getDwollaAccountId() {
  console.log("Fetching your Dwolla Account ID...\n")

  try {
    // Check if credentials are set
    if (!process.env.DWOLLA_KEY || !process.env.DWOLLA_SECRET) {
      console.error("❌ Missing Dwolla credentials!")
      console.error("Please ensure DWOLLA_KEY and DWOLLA_SECRET are set in your .env.local file")
      process.exit(1)
    }

    const baseUrl = process.env.DWOLLA_BASE_URL || "https://api-sandbox.dwolla.com"
    console.log(`Using Dwolla API: ${baseUrl}`)

    // Get access token
    const tokenManager = new DwollaTokenManager()
    const token = await tokenManager.getAccessToken()
    console.log("✓ Successfully authenticated with Dwolla\n")

    // Fetch root account information
    const response = await fetch(`${baseUrl}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.dwolla.v1.hal+json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch account info: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // The account ID is typically in the _links.account.href
    if (data._links?.account?.href) {
      const accountUrl = data._links.account.href
      const accountId = accountUrl.split("/").pop()

      console.log("🎉 Found your Dwolla Account ID!")
      console.log("=====================================")
      console.log(`Account ID: ${accountId}`)
      console.log("=====================================\n")

      console.log("Add this to your .env.local file:")
      console.log(`DWOLLA_MASTER_ACCOUNT_ID=${accountId}\n`)

      // Try to get more account details
      const accountResponse = await fetch(accountUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.dwolla.v1.hal+json",
        },
      })

      if (accountResponse.ok) {
        const accountData = await accountResponse.json()
        console.log("Account Details:")
        console.log(`- Name: ${accountData.name || "N/A"}`)
        console.log(`- Type: ${accountData.type || "N/A"}`)
        console.log(`- Created: ${accountData.created || "N/A"}`)
      }
    } else {
      console.log("Could not find account ID in API response.")
      console.log("Response:", JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error("❌ Error:", error)
    if ((error as Error).message.includes("401")) {
      console.error("\nAuthentication failed. Please check your DWOLLA_KEY and DWOLLA_SECRET.")
    }
  }
}

// Load environment variables
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

// Run the script
getDwollaAccountId().catch(console.error)
