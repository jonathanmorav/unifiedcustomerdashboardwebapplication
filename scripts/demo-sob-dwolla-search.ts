#!/usr/bin/env tsx

/**
 * Demo: Comprehensive SOB-Dwolla Transfer Search
 * 
 * This script demonstrates all available methods to search for SOB IDs 
 * that have been processed via Dwolla transfers using the Unified Customer Dashboard.
 * 
 * Usage: npx tsx scripts/demo-sob-dwolla-search.ts
 */

import { HubSpotClient } from "../lib/api/hubspot/client"
import { prisma } from "../lib/db"
import { log } from "../lib/logger"
import { getEnv } from "../lib/env"

class ComprehensiveSOBSearch {
  private hubspotClient: HubSpotClient
  private env: ReturnType<typeof getEnv>

  constructor() {
    this.env = getEnv()
    this.hubspotClient = new HubSpotClient()
  }

  async runComprehensiveSearch(): Promise<void> {
    console.log("🔍 Comprehensive SOB-Dwolla Transfer Search Demo")
    console.log("==============================================")
    console.log("")

    // Check environment setup
    await this.checkEnvironment()

    // Search Method 1: Direct HubSpot API Search
    console.log("📋 Method 1: Direct HubSpot API Search")
    console.log("------------------------------------")
    await this.searchHubSpotDirect()

    // Search Method 2: Database Cache Search  
    console.log("\n📋 Method 2: Database Cache Search")
    console.log("--------------------------------")
    await this.searchDatabaseCache()

    // Search Method 3: Cross-Reference Search
    console.log("\n📋 Method 3: Cross-Reference Search (ACH + HubSpot)")
    console.log("-----------------------------------------------")
    await this.searchCrossReference()

    // Search Method 4: Reconciliation API Search
    console.log("\n📋 Method 4: Reconciliation API Simulation")
    console.log("----------------------------------------")
    await this.searchViaReconciliation()

    console.log("\n✅ Comprehensive search complete!")
    console.log("\nFor production use:")
    console.log("- Use Method 1 for real-time HubSpot data")
    console.log("- Use Method 2 for fast cached lookups")
    console.log("- Use Method 3 for comprehensive correlation")
    console.log("- Use Method 4 for reconciliation workflows")
  }

  private async checkEnvironment(): Promise<void> {
    console.log("🔧 Environment Check:")
    console.log(`   - Demo Mode: ${process.env.DEMO_MODE === "true" ? "Enabled" : "Disabled"}`)
    console.log(`   - HubSpot API: ${this.env.HUBSPOT_API_KEY ? "Configured" : "Missing"}`)
    console.log(`   - Database: ${this.env.DATABASE_URL ? "Configured" : "Missing"}`)
    
    try {
      await prisma.$connect()
      console.log(`   - Database Connection: ✅ Connected`)
    } catch (error) {
      console.log(`   - Database Connection: ❌ Failed`)
    }
    console.log("")
  }

  private async searchHubSpotDirect(): Promise<void> {
    try {
      if (process.env.DEMO_MODE === "true" || !this.env.HUBSPOT_API_KEY) {
        console.log("⚠️  Running in demo mode - showing mock data structure")
        
        const mockResults = [
          {
            sobId: "SOB-12345",
            transferId: "dwolla-transfer-789",
            companyName: "Acme Corporation",
            dwollaCustomerId: "dwolla-customer-456",
            coverageMonth: "2024-08",
            amountToDraft: 1250.00,
            feeAmount: 25.00,
            transferStatus: "processed",
            reconciliationStatus: "Matched"
          },
          {
            sobId: "SOB-67890", 
            transferId: "dwolla-transfer-101",
            companyName: "TechStart Inc",
            dwollaCustomerId: "dwolla-customer-112",
            coverageMonth: "2024-08",
            amountToDraft: 875.50,
            feeAmount: 17.51,
            transferStatus: "processed",
            reconciliationStatus: "Matched"
          }
        ]

        console.log(`   Found ${mockResults.length} SOB-transfer associations (mock data):`)
        mockResults.forEach(result => {
          console.log(`   • SOB ${result.sobId} → Transfer ${result.transferId}`)
          console.log(`     Company: ${result.companyName}`)
          console.log(`     Amount: $${result.amountToDraft} + $${result.feeAmount} fee`)
          console.log(`     Status: ${result.transferStatus} / ${result.reconciliationStatus}`)
        })
        return
      }

      // Real HubSpot search
      console.log("   Searching Dwolla Transfers in HubSpot...")
      const transfers = await this.hubspotClient.getDwollaTransfers({ limit: 10 })
      console.log(`   Found ${transfers.length} Dwolla transfers`)

      if (transfers.length === 0) {
        console.log("   No transfers found in HubSpot")
        return
      }

      let sobCount = 0
      for (const transfer of transfers.slice(0, 3)) { // Limit to 3 for demo
        const sobAssociations = await this.hubspotClient.getDwollaTransferSOBAssociations(transfer.id)
        if (sobAssociations.results.length > 0) {
          sobCount += sobAssociations.results.length
          console.log(`   • Transfer ${transfer.properties.dwolla_transfer_id}: ${sobAssociations.results.length} SOB(s)`)
          
          for (const sobAssoc of sobAssociations.results.slice(0, 2)) { // Limit to 2 SOBs per transfer
            console.log(`     → SOB ID: ${sobAssoc.id}`)
          }
        }
      }

      console.log(`   Total SOBs with transfer associations: ${sobCount}`)

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async searchDatabaseCache(): Promise<void> {
    try {
      // Search cached SOBs
      const cachedSOBs = await prisma.hubSpotSOBCache.findMany({
        where: {
          expiresAt: { gt: new Date() }
        },
        include: {
          // Would need to add relations in schema for proper joins
        },
        take: 10
      })

      console.log(`   Found ${cachedSOBs.length} cached SOBs`)

      if (cachedSOBs.length === 0) {
        console.log("   No cached SOB data available")
        return
      }

      let sobsWithTransfers = 0

      for (const sob of cachedSOBs) {
        // Get company for this SOB
        const company = await prisma.hubSpotCompanyCache.findFirst({
          where: {
            companyId: sob.companyId,
            expiresAt: { gt: new Date() }
          }
        })

        if (company?.dwollaCustomerId) {
          // Look for ACH transactions
          const achTransactions = await prisma.aCHTransaction.findMany({
            where: {
              customerId: company.dwollaCustomerId
            },
            take: 5
          })

          if (achTransactions.length > 0) {
            sobsWithTransfers++
            console.log(`   • SOB ${sob.sobId} (${company.companyName}): ${achTransactions.length} ACH transactions`)
            console.log(`     Coverage: ${sob.coverageMonth}, Amount: $${sob.amountToDraft}`)
          }
        }
      }

      console.log(`   SOBs with linked transactions: ${sobsWithTransfers}`)

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async searchCrossReference(): Promise<void> {
    try {
      // Get all ACH transactions (Dwolla transfers in local DB)
      const achTransactions = await prisma.aCHTransaction.findMany({
        where: {
          direction: "credit", // Customer-initiated
          status: "processed"
        },
        take: 20,
        orderBy: { created: 'desc' }
      })

      console.log(`   Found ${achTransactions.length} processed ACH transactions`)

      let correlatedSOBs = 0

      for (const ach of achTransactions.slice(0, 5)) { // Limit for demo
        // Method 1: Direct customer ID match
        if (ach.customerId) {
          const company = await prisma.hubSpotCompanyCache.findFirst({
            where: {
              dwollaCustomerId: ach.customerId,
              expiresAt: { gt: new Date() }
            }
          })

          if (company) {
            const sobs = await prisma.hubSpotSOBCache.findMany({
              where: {
                companyId: company.companyId,
                expiresAt: { gt: new Date() }
              }
            })

            if (sobs.length > 0) {
              correlatedSOBs += sobs.length
              console.log(`   • ACH ${ach.dwollaId} → Company ${company.companyName}`)
              console.log(`     Customer ID: ${ach.customerId}`)
              console.log(`     SOBs: ${sobs.map(s => s.sobId).join(", ")}`)
            }
          }
        }

        // Method 2: Company name match
        if (!ach.customerId && ach.companyName) {
          const company = await prisma.hubSpotCompanyCache.findFirst({
            where: {
              companyName: {
                contains: ach.companyName,
                mode: 'insensitive'
              },
              expiresAt: { gt: new Date() }
            }
          })

          if (company) {
            console.log(`   • ACH ${ach.dwollaId} → Company match by name: ${ach.companyName}`)
          }
        }
      }

      console.log(`   Total correlated SOBs: ${correlatedSOBs}`)

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async searchViaReconciliation(): Promise<void> {
    try {
      // Simulate the reconciliation API logic
      console.log("   Simulating reconciliation workflow...")

      // Get recent transfers
      const recentTransfers = await prisma.aCHTransaction.findMany({
        where: {
          direction: "credit",
          created: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        take: 10,
        orderBy: { created: 'desc' }
      })

      console.log(`   Found ${recentTransfers.length} recent transfers`)

      let processedSOBs = 0

      for (const transfer of recentTransfers.slice(0, 3)) { // Limit for demo
        // This simulates the getSOBDataForTransfer function from the reconciliation API
        const sobData = await this.getSOBDataForTransfer(transfer)
        
        if (sobData) {
          processedSOBs++
          console.log(`   • Transfer ${transfer.dwollaId}:`)
          console.log(`     SOB: ${sobData.sobId}`)
          console.log(`     Company: ${sobData.companyName}`)
          console.log(`     Policies: ${sobData.policies.length}`)
          console.log(`     Amount: $${sobData.amountToDraft} + $${sobData.feeAmount} fee`)
        }
      }

      console.log(`   Transfers with SOB data: ${processedSOBs}`)

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Simplified version of the reconciliation API's SOB lookup
  private async getSOBDataForTransfer(transfer: any): Promise<any | null> {
    try {
      // Check if we have cached SOB data for this customer
      if (transfer.customerId) {
        const company = await prisma.hubSpotCompanyCache.findFirst({
          where: {
            dwollaCustomerId: transfer.customerId,
            expiresAt: { gt: new Date() }
          }
        })

        if (company) {
          const sob = await prisma.hubSpotSOBCache.findFirst({
            where: {
              companyId: company.companyId,
              expiresAt: { gt: new Date() }
            },
            orderBy: { coverageMonth: 'desc' }
          })

          if (sob) {
            const policies = await prisma.hubSpotPolicyCache.findMany({
              where: {
                sobId: sob.sobId,
                expiresAt: { gt: new Date() }
              }
            })

            return {
              sobId: sob.sobId,
              companyName: company.companyName,
              amountToDraft: Number(sob.amountToDraft),
              feeAmount: Number(sob.feeAmount),
              policies: policies.map(p => ({
                policyId: p.policyId,
                productName: p.productName,
                monthlyCost: Number(p.monthlyCost)
              })),
              coverageMonth: sob.coverageMonth
            }
          }
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  async displaySummaryStats(): Promise<void> {
    console.log("\n📊 Summary Statistics")
    console.log("-------------------")

    try {
      const [
        totalSOBs,
        totalCompanies,
        totalPolicies,
        totalACHTransactions,
        carrierMappings
      ] = await Promise.all([
        prisma.hubSpotSOBCache.count({ where: { expiresAt: { gt: new Date() } } }),
        prisma.hubSpotCompanyCache.count({ where: { expiresAt: { gt: new Date() } } }),
        prisma.hubSpotPolicyCache.count({ where: { expiresAt: { gt: new Date() } } }),
        prisma.aCHTransaction.count(),
        prisma.carrierMapping.count()
      ])

      console.log(`   - Cached SOBs: ${totalSOBs}`)
      console.log(`   - Cached Companies: ${totalCompanies}`) 
      console.log(`   - Cached Policies: ${totalPolicies}`)
      console.log(`   - ACH Transactions: ${totalACHTransactions}`)
      console.log(`   - Carrier Mappings: ${carrierMappings}`)

      // Coverage months
      const coverageMonths = await prisma.hubSpotSOBCache.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { coverageMonth: true },
        distinct: ['coverageMonth']
      })

      console.log(`   - Coverage Months: ${coverageMonths.length} (${coverageMonths.map(c => c.coverageMonth).sort().join(', ')})`)

    } catch (error) {
      console.log(`   ❌ Error getting stats: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function main() {
  const searcher = new ComprehensiveSOBSearch()
  
  try {
    await searcher.runComprehensiveSearch()
    await searcher.displaySummaryStats()
    
    console.log("\n🛠️  Available Tools:")
    console.log("   - scripts/search-sob-dwolla-transfers.js (Node.js version)")
    console.log("   - scripts/search-sob-dwolla-transfers.ts (TypeScript version)")
    console.log("   - scripts/query-sob-dwolla-database.ts (Database-only search)")
    console.log("   - API: /api/reconciliation/transfers?includeSOB=true")
    console.log("")
    console.log("💡 Example commands:")
    console.log("   npx tsx scripts/search-sob-dwolla-transfers.ts --coverage-month 2024-08")
    console.log("   npx tsx scripts/query-sob-dwolla-database.ts --company-name Acme")
    console.log("   curl 'http://localhost:3000/api/reconciliation/transfers?includeSOB=true&limit=5'")
    
  } catch (error) {
    console.error("\n💥 Demo failed:", error instanceof Error ? error.message : String(error))
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