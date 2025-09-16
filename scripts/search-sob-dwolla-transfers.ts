#!/usr/bin/env tsx

/**
 * TypeScript version: Search for SOB IDs that have been processed via Dwolla transfers
 * 
 * This script uses the existing project infrastructure to search across HubSpot and 
 * local database to find SOB IDs with associated Dwolla transfers.
 * 
 * Usage: npx tsx scripts/search-sob-dwolla-transfers.ts [options]
 * 
 * Options:
 *   --coverage-month YYYY-MM    Filter by specific coverage month
 *   --status STATUS             Filter by transfer status
 *   --customer-id ID            Search by specific Dwolla customer ID
 *   --export-csv FILE           Export results to CSV file
 *   --detailed                  Include detailed policy information
 *   --format FORMAT             Output format: json, table, csv
 */

import { HubSpotClient } from "../lib/api/hubspot/client"
import { prisma } from "../lib/db"
import { log } from "../lib/logger"
import fs from "fs"

interface SearchOptions {
  coverageMonth?: string
  status?: string
  customerId?: string
  exportCsv?: string
  detailed: boolean
  format: 'json' | 'table' | 'csv'
}

interface SOBTransferResult {
  sobId: string
  transfer: any
  sob?: any
  company?: any
  policies?: any[]
  atchTransactions?: any[]
  matchType?: string
}

class SOBDwollaSearcher {
  private hubspotClient: HubSpotClient
  private options: SearchOptions

  constructor(options: SearchOptions) {
    this.hubspotClient = new HubSpotClient()
    this.options = options
  }

  async searchSOBsWithDwollaTransfers(): Promise<SOBTransferResult[]> {
    log.info("Starting SOB-Dwolla transfer search", { options: this.options })

    // Get Dwolla transfers from HubSpot
    const transfers = await this.getDwollaTransfers()
    log.info(`Found ${transfers.length} Dwolla transfers`)

    if (transfers.length === 0) {
      return []
    }

    const results: SOBTransferResult[] = []

    // Process each transfer
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i]
      process.stdout.write(`\rProcessing ${i + 1}/${transfers.length} transfers...`)

      // Find SOB associations
      const sobResults = await this.findSOBsForTransfer(transfer)
      results.push(...sobResults)

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    console.log() // New line after progress indicator
    log.info(`Found ${results.length} SOB-transfer associations`)

    return results
  }

  private async getDwollaTransfers(): Promise<any[]> {
    const filters: any = {}

    if (this.options.coverageMonth) {
      filters.coverageMonth = this.options.coverageMonth
    }

    try {
      return await this.hubspotClient.getDwollaTransfers(filters)
    } catch (error) {
      log.error("Failed to get Dwolla transfers from HubSpot", { error })
      return []
    }
  }

  private async findSOBsForTransfer(transfer: any): Promise<SOBTransferResult[]> {
    const results: SOBTransferResult[] = []
    const transferId = transfer.id

    try {
      // Method 1: Direct SOB associations
      const sobAssociations = await this.hubspotClient.getDwollaTransferSOBAssociations(transferId)
      
      for (const sobAssoc of sobAssociations.results || []) {
        const result = await this.buildSOBResult(sobAssoc.id, transfer, "direct_association")
        if (result) results.push(result)
      }

      // Method 2: Company-based matching if no direct associations
      if (results.length === 0 && transfer.properties.dwolla_customer_id) {
        const companyResults = await this.findSOBsViaCompany(transfer)
        results.push(...companyResults)
      }

      // Method 3: Database cache lookup
      const cacheResults = await this.findSOBsViaCache(transfer)
      results.push(...cacheResults)

    } catch (error) {
      log.error("Error finding SOBs for transfer", { 
        transferId, 
        error: error instanceof Error ? error.message : String(error) 
      })
    }

    return results
  }

  private async findSOBsViaCompany(transfer: any): Promise<SOBTransferResult[]> {
    const results: SOBTransferResult[] = []
    
    try {
      // Search for company by Dwolla customer ID
      const companies = await this.hubspotClient.searchCompanies(
        transfer.properties.dwolla_customer_id,
        "dwolla_id"
      )

      for (const company of companies) {
        // Get SOBs associated with this company
        const companySOBs = await this.hubspotClient.getCompanySummaryOfBenefits(company.id)
        
        // Match by coverage month
        for (const sob of companySOBs) {
          if (sob.properties.coverage_month === transfer.properties.coverage_month) {
            const result = await this.buildSOBResult(sob.id, transfer, "company_match", company)
            if (result) results.push(result)
          }
        }
      }
    } catch (error) {
      log.error("Error finding SOBs via company", { 
        customerId: transfer.properties.dwolla_customer_id,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return results
  }

  private async findSOBsViaCache(transfer: any): Promise<SOBTransferResult[]> {
    const results: SOBTransferResult[] = []
    
    try {
      // Look up in local database cache
      const achTransactions = await prisma.aCHTransaction.findMany({
        where: {
          OR: [
            { dwollaId: transfer.properties.dwolla_transfer_id },
            { correlationId: transfer.properties.dwolla_transfer_id },
            { customerId: transfer.properties.dwolla_customer_id }
          ]
        }
      })

      for (const achTx of achTransactions) {
        if (achTx.customerId) {
          // Find SOBs in cache for this customer
          const cachedSOBs = await prisma.hubSpotSOBCache.findMany({
            where: {
              expiresAt: { gt: new Date() }
            },
            include: {
              // Join with company cache to match customer ID
            }
          })

          for (const sobCache of cachedSOBs) {
            if (sobCache.coverageMonth === transfer.properties.coverage_month) {
              const result: SOBTransferResult = {
                sobId: sobCache.sobId,
                transfer,
                sob: sobCache.data,
                atchTransactions: [achTx],
                matchType: "cache_match"
              }
              results.push(result)
            }
          }
        }
      }
    } catch (error) {
      log.error("Error finding SOBs via cache", { 
        transferId: transfer.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return results
  }

  private async buildSOBResult(
    sobId: string, 
    transfer: any, 
    matchType: string,
    company?: any
  ): Promise<SOBTransferResult | null> {
    try {
      // Get SOB details
      const sob = await this.hubspotClient.getObjectById(
        "2-45680577", // SOB object type
        sobId,
        ["amount_to_draft", "fee_amount", "coverage_month", "pdf_document_url"]
      )

      // Get company if not provided
      if (!company && transfer.properties.dwolla_customer_id) {
        const companies = await this.hubspotClient.searchCompanies(
          transfer.properties.dwolla_customer_id,
          "dwolla_id"
        )
        company = companies[0]
      }

      // Get policies if detailed flag is set
      let policies: any[] = []
      if (this.options.detailed) {
        policies = await this.hubspotClient.getSummaryOfBenefitsPolicies(sobId)
      }

      // Get related ACH transactions from local database
      const achTransactions = await prisma.aCHTransaction.findMany({
        where: {
          OR: [
            { dwollaId: transfer.properties.dwolla_transfer_id },
            { correlationId: transfer.properties.dwolla_transfer_id },
            { customerId: transfer.properties.dwolla_customer_id }
          ]
        }
      })

      return {
        sobId,
        transfer,
        sob,
        company,
        policies,
        atchTransactions: achTransactions,
        matchType
      }
    } catch (error) {
      log.error("Error building SOB result", { 
        sobId, 
        transferId: transfer.id,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  private formatCurrency(amount: any): string {
    return `$${Number(amount || 0).toFixed(2)}`
  }

  private formatDate(dateString: any): string {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString()
  }

  displayResults(results: SOBTransferResult[]): void {
    if (this.options.format === "json") {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    if (this.options.format === "csv" || this.options.exportCsv) {
      this.exportToCsv(results)
      if (this.options.format === "csv") return
    }

    // Table format
    this.displayTable(results)
  }

  private displayTable(results: SOBTransferResult[]): void {
    if (results.length === 0) {
      console.log("\n📊 No results found.")
      return
    }

    console.log(`\n📊 Found ${results.length} SOB(s) with Dwolla transfer processing:\n`)
    
    // Group by company
    const grouped = results.reduce((acc, result) => {
      const companyName = result.company?.properties?.name || "Unknown Company"
      if (!acc[companyName]) acc[companyName] = []
      acc[companyName].push(result)
      return acc
    }, {} as Record<string, SOBTransferResult[]>)

    Object.entries(grouped).forEach(([companyName, companyResults]) => {
      console.log(`🏢 ${companyName}`)
      console.log(`   Dwolla Customer ID: ${companyResults[0].company?.properties?.dwolla_customer_id || "N/A"}`)
      console.log(`   SOBs processed: ${companyResults.length}`)
      console.log("")

      companyResults.forEach(result => {
        console.log(`   📋 SOB ID: ${result.sobId}`)
        console.log(`      Transfer ID: ${result.transfer.properties.dwolla_transfer_id}`)
        console.log(`      Coverage Month: ${result.transfer.properties.coverage_month || "N/A"}`)
        console.log(`      Transfer Amount: ${this.formatCurrency(result.transfer.properties.amount)}`)
        console.log(`      SOB Amount: ${this.formatCurrency(result.sob?.properties?.amount_to_draft)}`)
        console.log(`      Fee: ${this.formatCurrency(result.transfer.properties.fee_amount)}`)
        console.log(`      Status: ${result.transfer.properties.transfer_status || "Unknown"}`)
        console.log(`      Reconciliation: ${result.transfer.properties.reconciliation_status || "Unknown"}`)
        console.log(`      Date: ${this.formatDate(result.transfer.properties.date_initiated)}`)
        console.log(`      Match Type: ${result.matchType}`)
        
        if (result.atchTransactions?.length) {
          console.log(`      Local ACH Records: ${result.atchTransactions.length}`)
        }
        
        if (this.options.detailed && result.policies?.length) {
          console.log(`      Policies (${result.policies.length}):`)
          result.policies.forEach(policy => {
            const name = policy.properties.policyholder || 
                        `${policy.properties.first_name || ""} ${policy.properties.last_name || ""}`.trim() ||
                        "Unknown"
            console.log(`        - ${policy.properties.product_name || "Unknown"} (${name})`)
          })
        }
        console.log("")
      })
    })
  }

  private exportToCsv(results: SOBTransferResult[]): void {
    const headers = [
      "SOB ID",
      "Transfer ID", 
      "Company Name",
      "Dwolla Customer ID",
      "Coverage Month",
      "Transfer Amount",
      "SOB Amount",
      "Fee Amount",
      "Transfer Status",
      "Reconciliation Status",
      "Date Initiated",
      "Match Type",
      "Policy Count",
      "ACH Records"
    ]

    if (this.options.detailed) {
      headers.push("Policies")
    }

    const rows = results.map(result => {
      const row = [
        result.sobId || "N/A",
        result.transfer.properties.dwolla_transfer_id || "N/A",
        result.company?.properties?.name || "Unknown",
        result.transfer.properties.dwolla_customer_id || "N/A",
        result.transfer.properties.coverage_month || "N/A",
        result.transfer.properties.amount || "0",
        result.sob?.properties?.amount_to_draft || "0",
        result.transfer.properties.fee_amount || "0",
        result.transfer.properties.transfer_status || "Unknown",
        result.transfer.properties.reconciliation_status || "Unknown",
        this.formatDate(result.transfer.properties.date_initiated),
        result.matchType || "Unknown",
        result.policies?.length || 0,
        result.atchTransactions?.length || 0
      ]

      if (this.options.detailed && result.policies?.length) {
        const policyStr = result.policies.map(p => {
          const name = p.properties.policyholder || 
                      `${p.properties.first_name || ""} ${p.properties.last_name || ""}`.trim() ||
                      "Unknown"
          return `${p.properties.product_name || 'Unknown'} (${name})`
        }).join("; ")
        row.push(policyStr)
      } else if (this.options.detailed) {
        row.push("")
      }

      return row
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const filename = this.options.exportCsv || `sob-dwolla-transfers-${new Date().toISOString().slice(0, 10)}.csv`
    fs.writeFileSync(filename, csvContent)
    console.log(`\n📄 Results exported to ${filename}`)
  }

  displaySummary(results: SOBTransferResult[]): void {
    console.log(`\n📈 Summary Statistics:`)
    console.log(`   - Total SOBs with transfers: ${results.length}`)
    console.log(`   - Unique companies: ${new Set(results.map(r => r.company?.id).filter(Boolean)).size}`)
    console.log(`   - Coverage months: ${new Set(results.map(r => r.transfer.properties.coverage_month).filter(Boolean)).size}`)
    
    const statusCounts = results.reduce((acc, r) => {
      const status = r.transfer.properties.transfer_status || "unknown"
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(`   - Status breakdown:`)
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`     • ${status}: ${count}`)
    })

    const matchTypeCounts = results.reduce((acc, r) => {
      const matchType = r.matchType || "unknown"
      acc[matchType] = (acc[matchType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(`   - Match type breakdown:`)
    Object.entries(matchTypeCounts).forEach(([matchType, count]) => {
      console.log(`     • ${matchType}: ${count}`)
    })
    
    const totalAmount = results.reduce((sum, r) => {
      return sum + Number(r.transfer.properties.amount || 0)
    }, 0)
    
    console.log(`   - Total transfer amount: ${this.formatCurrency(totalAmount)}`)
  }
}

async function parseArgs(): Promise<SearchOptions> {
  const args = process.argv.slice(2)
  const options: SearchOptions = {
    detailed: args.includes("--detailed"),
    format: "table"
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--coverage-month" && args[i + 1]) {
      options.coverageMonth = args[i + 1]
    }
    if (args[i] === "--status" && args[i + 1]) {
      options.status = args[i + 1]
    }
    if (args[i] === "--customer-id" && args[i + 1]) {
      options.customerId = args[i + 1]
    }
    if (args[i] === "--export-csv" && args[i + 1]) {
      options.exportCsv = args[i + 1]
      options.format = "csv"
    }
    if (args[i] === "--format" && args[i + 1]) {
      options.format = args[i + 1] as 'json' | 'table' | 'csv'
    }
  }

  return options
}

async function main() {
  console.log("🔍 SOB IDs with Dwolla Transfer Processing Search (TypeScript)")
  console.log("==========================================================")
  
  try {
    const options = await parseArgs()
    
    console.log(`📊 Search Configuration:`)
    console.log(`   - Coverage Month: ${options.coverageMonth || "All months"}`)
    console.log(`   - Status Filter: ${options.status || "All statuses"}`)
    console.log(`   - Customer ID: ${options.customerId || "All customers"}`)
    console.log(`   - Include Details: ${options.detailed ? "Yes" : "No"}`)
    console.log(`   - Output Format: ${options.format}`)
    console.log("")
    
    const searcher = new SOBDwollaSearcher(options)
    const results = await searcher.searchSOBsWithDwollaTransfers()
    
    searcher.displayResults(results)
    searcher.displaySummary(results)
    
  } catch (error) {
    console.error("\n💥 Search failed:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
}