#!/usr/bin/env tsx

/**
 * Query SOB IDs with Dwolla transfers from local database
 * 
 * This script queries the local database cache to find SOB IDs that have been
 * processed through Dwolla transfers, providing faster results than API calls.
 * 
 * Usage: npx tsx scripts/query-sob-dwolla-database.ts [options]
 * 
 * Options:
 *   --coverage-month YYYY-MM    Filter by coverage month
 *   --company-name NAME         Filter by company name
 *   --amount-min MIN            Minimum transfer amount
 *   --amount-max MAX            Maximum transfer amount
 *   --export-csv FILE           Export to CSV
 *   --format FORMAT             Output format: json, table, csv
 */

import { prisma } from "../lib/db"
import { log } from "../lib/logger"
import fs from "fs"

interface DatabaseSearchOptions {
  coverageMonth?: string
  companyName?: string
  amountMin?: number
  amountMax?: number
  exportCsv?: string
  format: 'json' | 'table' | 'csv'
}

interface SOBDwollaRecord {
  sobId: string
  sobData: any
  companyName: string
  companyId: string
  dwollaCustomerId: string | null
  coverageMonth: string
  amountToDraft: number
  feeAmount: number
  achTransactions: any[]
  policies: any[]
  totalPolicies: number
  carrierBreakdown: Record<string, number>
}

class DatabaseSOBSearcher {
  private options: DatabaseSearchOptions

  constructor(options: DatabaseSearchOptions) {
    this.options = options
  }

  async searchDatabase(): Promise<SOBDwollaRecord[]> {
    log.info("Starting database SOB-Dwolla search", { options: this.options })

    const whereClause: any = {
      expiresAt: { gt: new Date() } // Only non-expired cache entries
    }

    // Add filters
    if (this.options.coverageMonth) {
      whereClause.coverageMonth = this.options.coverageMonth
    }

    // Get all cached SOBs with company information
    const sobCacheEntries = await prisma.hubSpotSOBCache.findMany({
      where: whereClause,
      include: {
        // This would require adding relations to the schema, so we'll do separate queries
      },
      orderBy: [
        { coverageMonth: 'desc' },
        { companyId: 'asc' }
      ]
    })

    log.info(`Found ${sobCacheEntries.length} cached SOB entries`)

    const results: SOBDwollaRecord[] = []

    for (const sobCache of sobCacheEntries) {
      // Get company information
      const company = await prisma.hubSpotCompanyCache.findFirst({
        where: {
          companyId: sobCache.companyId,
          expiresAt: { gt: new Date() }
        }
      })

      if (!company) continue

      // Apply company name filter
      if (this.options.companyName && 
          !company.companyName.toLowerCase().includes(this.options.companyName.toLowerCase())) {
        continue
      }

      // Apply amount filters
      const totalAmount = Number(sobCache.amountToDraft) + Number(sobCache.feeAmount)
      if (this.options.amountMin && totalAmount < this.options.amountMin) continue
      if (this.options.amountMax && totalAmount > this.options.amountMax) continue

      // Get related ACH transactions (Dwolla transfers in local DB)
      const achTransactions = await prisma.aCHTransaction.findMany({
        where: {
          OR: [
            { customerId: company.dwollaCustomerId },
            { customerName: company.companyName },
            { companyName: company.companyName }
          ]
        },
        orderBy: { created: 'desc' }
      })

      // Only include if there are related ACH transactions (indicating Dwolla processing)
      if (achTransactions.length === 0) continue

      // Get policies
      const policies = await prisma.hubSpotPolicyCache.findMany({
        where: {
          sobId: sobCache.sobId,
          expiresAt: { gt: new Date() }
        }
      })

      // Calculate carrier breakdown
      const carrierBreakdown: Record<string, number> = {}
      let totalPolicyCost = 0

      for (const policy of policies) {
        const monthlyCost = Number(policy.monthlyCost)
        totalPolicyCost += monthlyCost

        // Get carrier mapping
        const mapping = await prisma.carrierMapping.findUnique({
          where: { productName: policy.productName }
        })

        const carrierName = mapping?.carrierName || "Unmapped"
        carrierBreakdown[carrierName] = (carrierBreakdown[carrierName] || 0) + monthlyCost
      }

      const record: SOBDwollaRecord = {
        sobId: sobCache.sobId,
        sobData: sobCache.data,
        companyName: company.companyName,
        companyId: company.companyId,
        dwollaCustomerId: company.dwollaCustomerId,
        coverageMonth: sobCache.coverageMonth,
        amountToDraft: Number(sobCache.amountToDraft),
        feeAmount: Number(sobCache.feeAmount),
        achTransactions: achTransactions.map(ach => ({
          id: ach.id,
          dwollaId: ach.dwollaId,
          status: ach.status,
          amount: Number(ach.amount),
          direction: ach.direction,
          created: ach.created,
          description: ach.description
        })),
        policies: policies.map(p => ({
          policyId: p.policyId,
          productName: p.productName,
          policyHolderName: p.policyHolderName,
          monthlyCost: Number(p.monthlyCost),
          coverageLevel: p.coverageLevel
        })),
        totalPolicies: policies.length,
        carrierBreakdown
      }

      results.push(record)
    }

    log.info(`Found ${results.length} SOBs with Dwolla processing`)
    return results
  }

  private formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString()
  }

  displayResults(results: SOBDwollaRecord[]): void {
    if (this.options.format === "json") {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    if (this.options.format === "csv" || this.options.exportCsv) {
      this.exportToCsv(results)
      if (this.options.format === "csv") return
    }

    this.displayTable(results)
  }

  private displayTable(results: SOBDwollaRecord[]): void {
    if (results.length === 0) {
      console.log("\n📊 No SOBs with Dwolla processing found in database cache.")
      return
    }

    console.log(`\n📊 Found ${results.length} SOB(s) with Dwolla processing:\n`)

    // Group by coverage month for better organization
    const grouped = results.reduce((acc, record) => {
      if (!acc[record.coverageMonth]) acc[record.coverageMonth] = []
      acc[record.coverageMonth].push(record)
      return acc
    }, {} as Record<string, SOBDwollaRecord[]>)

    Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a)) // Sort by coverage month descending
      .forEach(([coverageMonth, monthRecords]) => {
        console.log(`📅 Coverage Month: ${coverageMonth}`)
        console.log(`   SOBs in month: ${monthRecords.length}`)
        console.log("")

        monthRecords.forEach(record => {
          console.log(`   🏢 ${record.companyName}`)
          console.log(`      SOB ID: ${record.sobId}`)
          console.log(`      Company ID: ${record.companyId}`)
          console.log(`      Dwolla Customer ID: ${record.dwollaCustomerId || "N/A"}`)
          console.log(`      Amount to Draft: ${this.formatCurrency(record.amountToDraft)}`)
          console.log(`      Fee Amount: ${this.formatCurrency(record.feeAmount)}`)
          console.log(`      Total: ${this.formatCurrency(record.amountToDraft + record.feeAmount)}`)
          console.log(`      Policies: ${record.totalPolicies}`)
          
          if (record.achTransactions.length > 0) {
            console.log(`      ACH Transactions: ${record.achTransactions.length}`)
            console.log(`        Latest: ${record.achTransactions[0].dwollaId} (${record.achTransactions[0].status})`)
            console.log(`        Amount: ${this.formatCurrency(record.achTransactions[0].amount)}`)
            console.log(`        Date: ${this.formatDate(record.achTransactions[0].created)}`)
          }

          if (Object.keys(record.carrierBreakdown).length > 0) {
            console.log(`      Carrier Breakdown:`)
            Object.entries(record.carrierBreakdown).forEach(([carrier, amount]) => {
              console.log(`        - ${carrier}: ${this.formatCurrency(amount)}`)
            })
          }

          console.log("")
        })
      })
  }

  private exportToCsv(results: SOBDwollaRecord[]): void {
    const headers = [
      "SOB ID",
      "Company Name", 
      "Company ID",
      "Dwolla Customer ID",
      "Coverage Month",
      "Amount to Draft",
      "Fee Amount",
      "Total Amount",
      "Policy Count",
      "ACH Transaction Count",
      "Latest ACH Status",
      "Latest ACH Amount",
      "Primary Carrier",
      "Carrier Count"
    ]

    const rows = results.map(record => {
      const primaryCarrier = Object.entries(record.carrierBreakdown)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || "None"
      
      const latestAch = record.achTransactions[0]

      return [
        record.sobId,
        record.companyName,
        record.companyId,
        record.dwollaCustomerId || "N/A",
        record.coverageMonth,
        record.amountToDraft,
        record.feeAmount,
        record.amountToDraft + record.feeAmount,
        record.totalPolicies,
        record.achTransactions.length,
        latestAch?.status || "N/A",
        latestAch?.amount || 0,
        primaryCarrier,
        Object.keys(record.carrierBreakdown).length
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const filename = this.options.exportCsv || `sob-dwolla-database-${new Date().toISOString().slice(0, 10)}.csv`
    fs.writeFileSync(filename, csvContent)
    console.log(`\n📄 Results exported to ${filename}`)
  }

  displaySummary(results: SOBDwollaRecord[]): void {
    if (results.length === 0) return

    console.log(`\n📈 Summary Statistics:`)
    console.log(`   - Total SOBs with Dwolla processing: ${results.length}`)
    console.log(`   - Unique companies: ${new Set(results.map(r => r.companyId)).size}`)
    console.log(`   - Coverage months: ${new Set(results.map(r => r.coverageMonth)).size}`)
    
    const totalDraftAmount = results.reduce((sum, r) => sum + r.amountToDraft, 0)
    const totalFeeAmount = results.reduce((sum, r) => sum + r.feeAmount, 0)
    const totalPolicies = results.reduce((sum, r) => sum + r.totalPolicies, 0)
    const totalAchTx = results.reduce((sum, r) => sum + r.achTransactions.length, 0)

    console.log(`   - Total draft amount: ${this.formatCurrency(totalDraftAmount)}`)
    console.log(`   - Total fee amount: ${this.formatCurrency(totalFeeAmount)}`)
    console.log(`   - Total amount: ${this.formatCurrency(totalDraftAmount + totalFeeAmount)}`)
    console.log(`   - Total policies: ${totalPolicies}`)
    console.log(`   - Total ACH transactions: ${totalAchTx}`)

    // Carrier breakdown across all SOBs
    const allCarriers = results.reduce((acc, r) => {
      Object.entries(r.carrierBreakdown).forEach(([carrier, amount]) => {
        acc[carrier] = (acc[carrier] || 0) + amount
      })
      return acc
    }, {} as Record<string, number>)

    console.log(`   - Carrier breakdown:`)
    Object.entries(allCarriers)
      .sort(([,a], [,b]) => b - a)
      .forEach(([carrier, amount]) => {
        console.log(`     • ${carrier}: ${this.formatCurrency(amount)}`)
      })

    // Coverage month breakdown
    const monthBreakdown = results.reduce((acc, r) => {
      acc[r.coverageMonth] = (acc[r.coverageMonth] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`   - Coverage month breakdown:`)
    Object.entries(monthBreakdown)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([month, count]) => {
        console.log(`     • ${month}: ${count} SOBs`)
      })
  }
}

async function parseArgs(): Promise<DatabaseSearchOptions> {
  const args = process.argv.slice(2)
  const options: DatabaseSearchOptions = {
    format: "table"
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--coverage-month" && args[i + 1]) {
      options.coverageMonth = args[i + 1]
    }
    if (args[i] === "--company-name" && args[i + 1]) {
      options.companyName = args[i + 1]
    }
    if (args[i] === "--amount-min" && args[i + 1]) {
      options.amountMin = parseFloat(args[i + 1])
    }
    if (args[i] === "--amount-max" && args[i + 1]) {
      options.amountMax = parseFloat(args[i + 1])
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
  console.log("🗄️  SOB-Dwolla Database Query")
  console.log("============================")
  
  try {
    const options = await parseArgs()
    
    console.log(`📊 Query Configuration:`)
    console.log(`   - Coverage Month: ${options.coverageMonth || "All months"}`)
    console.log(`   - Company Name: ${options.companyName || "All companies"}`)
    console.log(`   - Amount Range: ${options.amountMin ? `$${options.amountMin}` : "No min"} - ${options.amountMax ? `$${options.amountMax}` : "No max"}`)
    console.log(`   - Output Format: ${options.format}`)
    console.log("")
    
    const searcher = new DatabaseSOBSearcher(options)
    const results = await searcher.searchDatabase()
    
    searcher.displayResults(results)
    searcher.displaySummary(results)
    
  } catch (error) {
    console.error("\n💥 Query failed:", error instanceof Error ? error.message : String(error))
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