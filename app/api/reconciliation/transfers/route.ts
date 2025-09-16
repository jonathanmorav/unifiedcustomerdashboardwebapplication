import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { HubSpotService } from "@/lib/api/hubspot/service"
import { getEnv } from "@/lib/env"
import { processBatch } from "@/lib/utils/batch-processor"
import { hubspotCache } from "@/lib/cache/hubspot-cache"
import { databaseCache } from "@/lib/cache/database-cache"
import { getTransferAdapter } from "@/lib/api/adapters/transfer-adapter"

// Request query schema
const querySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  status: z.enum(["processed", "pending", "failed", "all"]).optional().default("processed"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeSOB: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  coverageMonth: z.string().optional(), // Format: YYYY-MM
  useHubSpot: z
    .string()
    .optional()
    .transform((val) => val === "true"),
})

// Mock SOB and Policy data structure (replace with actual HubSpot API calls)
interface PolicyData {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string
  monthlyCost: number
  coverageLevel: string
  effectiveDate: string
  terminationDate?: string
  status: string
  carrier?: string
}

interface SOBData {
  sobId: string
  companyName: string
  amountToDraft: number
  feeAmount: number
  doubleBill?: "Yes" | "No" | null
  policies: PolicyData[]
  coverageMonth?: string // Optional - comes from transfer, not SOB
}

// Mock carrier mappings that match the database seed data
const MOCK_CARRIER_MAPPINGS: Record<string, string> = {
  "Long Term Disability": "SunLife",
  "Short Term Disability": "SunLife",
  "Life - Dependent": "SunLife",
  "Voluntary Life & AD&D": "SunLife",
  "Accident": "SunLife",
  "Critical Illness": "SunLife",
  "Dental": "SunLife",
  "Vision": "Guardian",
  "Health": "Sedera",
  "Sedera Health Cost Sharing": "Sedera",
  "Telehealth": "Recuro",
  "Virtual Primary Care": "Recuro",
  "Identity Theft Protection": "Transunion",
  "Long Term Care": "Unum",
  "Excess Disability": "Hanleigh",
  "Excess Disability Insurance": "Hanleigh",
}

// Helper function to get SOB and policies for a transfer
async function getSOBDataForTransfer(transfer: any): Promise<SOBData | null> {
  try {
    // Check database cache first
    const dbCached = await databaseCache.getSOB(transfer.dwollaId)
    if (dbCached) {
      logger.info("Found SOB in database cache", { transferId: transfer.dwollaId })
      return dbCached as SOBData
    }
    
    // Check memory cache second
    const cacheKey = `sob_${transfer.customerId || transfer.correlationId || transfer.dwollaId}`
    const cached = hubspotCache.get<SOBData>(cacheKey)
    if (cached) {
      logger.info("Found SOB in memory cache", { transferId: transfer.dwollaId })
      return cached
    }

    const env = getEnv()
    
    // Check if we're in demo mode or missing HubSpot credentials
    if (process.env.DEMO_MODE === "true" || !env.HUBSPOT_API_KEY) {
      // Return mock data in demo mode
      if (!transfer.customerId && !transfer.correlationId) {
        return null
      }

      const mockPolicies: PolicyData[] = [
        {
          policyId: `${transfer.customerName || "Customer"} - Dental`,
          policyHolderName: transfer.customerName || "Unknown",
          productName: "Dental",
          planName: "Enhanced",
          monthlyCost: 45.00,
          coverageLevel: "Employee Only",
          effectiveDate: "2024-01-01",
          status: "Active",
          carrier: MOCK_CARRIER_MAPPINGS["Dental"] || "Unmapped"
        },
        {
          policyId: `${transfer.customerName || "Customer"} - Vision`,
          policyHolderName: transfer.customerName || "Unknown",
          productName: "Vision",
          planName: "Standard",
          monthlyCost: 12.00,
          coverageLevel: "Employee Only",
          effectiveDate: "2024-01-01",
          status: "Active",
          carrier: MOCK_CARRIER_MAPPINGS["Vision"] || "Unmapped"
        },
        {
          policyId: `${transfer.customerName || "Customer"} - Voluntary Life & AD&D`,
          policyHolderName: transfer.customerName || "Unknown",
          productName: "Voluntary Life & AD&D",
          planName: "100K Coverage",
          monthlyCost: 125.00,
          coverageLevel: "Employee Only",
          effectiveDate: "2024-01-01",
          status: "Active",
          carrier: MOCK_CARRIER_MAPPINGS["Voluntary Life & AD&D"] || "Unmapped"
        },
        {
          policyId: `${transfer.customerName || "Customer"} - Short Term Disability`,
          policyHolderName: transfer.customerName || "Unknown",
          productName: "Short Term Disability",
          planName: "60% Salary",
          monthlyCost: 35.00,
          coverageLevel: "Employee Only",
          effectiveDate: "2024-01-01",
          status: "Active",
          carrier: MOCK_CARRIER_MAPPINGS["Short Term Disability"] || "Unmapped"
        }
      ]

      const totalAmount = mockPolicies.reduce((sum, policy) => sum + policy.monthlyCost, 0)

      const mockData = {
        sobId: `SOB-${transfer.dwollaId}`,
        companyName: transfer.companyName || transfer.customerName || "Unknown Company",
        amountToDraft: totalAmount,
        feeAmount: totalAmount * 0.02,
        policies: mockPolicies,
        coverageMonth: new Date().toISOString().slice(0, 7),
      }
      
      // Cache the mock data
      hubspotCache.set(cacheKey, mockData)
      return mockData
    }

    // Use real HubSpot data
    const hubspotService = new HubSpotService()
    
    // Try to find company by Dwolla customer ID first
    let customerData = null
    
    if (transfer.customerId) {
      try {
        customerData = await hubspotService.searchCustomer({
          searchTerm: transfer.customerId,
          searchType: "dwolla_id"
        }).catch(err => {
          logger.warn("Failed to search by Dwolla ID, will try fallback", { error: err })
          return null
        })
      } catch (error) {
        logger.warn("Failed to find HubSpot company by Dwolla ID", { 
          dwollaId: transfer.customerId,
          error 
        })
      }
    }
    
    // Fallback to searching by company name if Dwolla ID search fails
    if (!customerData && (transfer.companyName || transfer.customerName)) {
      try {
        customerData = await hubspotService.searchCustomer({
          searchTerm: transfer.companyName || transfer.customerName,
          searchType: "business_name"
        }).catch(err => {
          logger.warn("Failed to search by company name", { error: err })
          return null
        })
      } catch (error) {
        logger.warn("Failed to find HubSpot company by name", { 
          name: transfer.companyName || transfer.customerName,
          error 
        })
      }
    }
    
    if (!customerData || !customerData.summaryOfBenefits?.length) {
      logger.info("No SOB data found for transfer", { 
        transferId: transfer.dwollaId,
        customerId: transfer.customerId 
      })
      return null
    }
    
    // Use the most recent SOB
    const latestSOB = customerData.summaryOfBenefits[0]
    
    // Convert HubSpot policies to our format
    const policies: PolicyData[] = customerData.policies.map(policy => {
      const props = policy.properties
      
      // Build policy holder name from first/last or use policyholder field
      const policyHolderName = props.policyholder || 
        `${props.first_name || ""} ${props.last_name || ""}`.trim() || 
        transfer.customerName || 
        "Unknown"
      
      // Format policy ID as "{Name} - {Product}"
      const policyId = `${policyHolderName} - ${props.product_name || "Unknown Product"}`
      
      // Parse cost as number
      const monthlyCost = typeof props.cost_per_month === 'string' 
        ? parseFloat(props.cost_per_month) 
        : typeof props.cost_per_month === 'number'
        ? props.cost_per_month
        : 0
      
      return {
        policyId,
        policyHolderName,
        productName: String(props.product_name || "Unknown Product"),
        planName: props.plan_name ? String(props.plan_name) : undefined,
        monthlyCost,
        coverageLevel: String(props.coverage_level_display || props.coverage_level || "Unknown"),
        effectiveDate: String(props.policy_effective_date || ""),
        terminationDate: props.policy_termination_date ? String(props.policy_termination_date) : undefined,
        status: props.policy_termination_date ? "Terminated" : "Active"
      }
    })
    
    // Calculate total from policies
    const totalAmount = policies.reduce((sum, policy) => sum + policy.monthlyCost, 0)
    
    const result = {
      sobId: latestSOB.id,
      companyName: customerData.company?.properties?.name || 
                   transfer.companyName || 
                   transfer.customerName || 
                   "Unknown Company",
      amountToDraft: latestSOB.properties?.amount_to_draft || totalAmount,
      feeAmount: latestSOB.properties?.fee_amount || 0,
      doubleBill: latestSOB.properties?.double_bill || null,
      policies,
      // Don't include coverageMonth here - it should come from the transfer itself
    }
    
    // Cache the result in memory
    hubspotCache.set(cacheKey, result, 10 * 60 * 1000) // Cache for 10 minutes
    
    // Cache in database for persistent storage
    if (customerData) {
      await databaseCache.setCompany(
        customerData,
        transfer.customerId || undefined,
        24 * 60 * 60 * 1000 // 24 hours
      ).catch(err => {
        logger.warn("Failed to cache to database", { error: err, transferId: transfer.dwollaId })
      })
    }
    
    return result
  } catch (error) {
    logger.error("Error fetching SOB data from HubSpot", { 
      error, 
      transferId: transfer.id,
      customerId: transfer.customerId 
    })
    return null
  }
}

// Cache for carrier mappings
const carrierMappingsCache = new Map<string, string | null>()

// Helper function to get carrier mapping for a product
async function getCarrierForProduct(productName: string): Promise<string | null> {
  try {
    // Check cache first
    if (carrierMappingsCache.has(productName)) {
      return carrierMappingsCache.get(productName) || null
    }
    
    const mapping = await prisma.carrierMapping.findUnique({
      where: { productName },
      select: { carrierName: true }
    })
    
    const result = mapping?.carrierName || null
    // Cache the result
    carrierMappingsCache.set(productName, result)
    
    return result
  } catch (error) {
    logger.error("Error fetching carrier mapping", { error, productName })
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
      status: searchParams.get("status") || "processed",
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      includeSOB: searchParams.get("includeSOB") || "true",
      coverageMonth: searchParams.get("coverageMonth") || undefined,
      useHubSpot: searchParams.get("useHubSpot") || "false",
    }

    const validatedQuery = querySchema.parse(queryParams)

    let transactions: any[] = []
    let totalCount = 0

    // Check if we should use HubSpot transfers or local database
    if (validatedQuery.useHubSpot) {
      // Use the transfer adapter to fetch from HubSpot
      const transferAdapter = getTransferAdapter()
      const result = await transferAdapter.getTransfersWithCompatibility({
        status: validatedQuery.status,
        startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : null,
        endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : null,
        coverageMonth: validatedQuery.coverageMonth,
        limit: validatedQuery.limit,
        page: validatedQuery.page,
        useHubSpot: true,
      })

      transactions = result.transfers
      totalCount = result.pagination.total

      logger.info("Fetched transfers from HubSpot via adapter", {
        count: transactions.length,
        total: totalCount,
        coverageMonth: validatedQuery.coverageMonth,
      })
    } else {
      // Original logic - fetch from local database
      // Build where clause for ACH transactions
      const where: any = {
        direction: "credit", // Only customer-initiated transfers
      }

      if (validatedQuery.status !== "all") {
        where.status = validatedQuery.status
      }

      if (validatedQuery.startDate || validatedQuery.endDate) {
        where.created = {}
        if (validatedQuery.startDate) {
          // Start of the day
          const startDate = new Date(validatedQuery.startDate)
          startDate.setHours(0, 0, 0, 0)
          where.created.gte = startDate
        }
        if (validatedQuery.endDate) {
          // End of the day (23:59:59.999)
          const endDate = new Date(validatedQuery.endDate)
          endDate.setHours(23, 59, 59, 999)
          where.created.lte = endDate
        }
      }

      // Calculate pagination
      const skip = (validatedQuery.page - 1) * validatedQuery.limit

      // Log the query for debugging
      logger.info("Fetching reconciliation transfers from database", {
        filters: {
          status: validatedQuery.status,
          startDate: validatedQuery.startDate,
          endDate: validatedQuery.endDate,
          limit: validatedQuery.limit,
          page: validatedQuery.page,
        },
        where,
      })

      // Get total count for pagination
      totalCount = await prisma.aCHTransaction.count({ where })

      // Fetch transactions
      const dbTransactions = await prisma.aCHTransaction.findMany({
        where,
        skip,
        take: validatedQuery.limit,
        orderBy: {
          created: "desc",
        },
      })

      // Transform to match the adapter format
      transactions = dbTransactions.map(t => ({
        ...t,
        amount: t.amount ? parseFloat(t.amount.toString()) : 0,
        fees: t.fees ? parseFloat(t.fees.toString()) : 0,
        netAmount: t.netAmount ? parseFloat(t.netAmount.toString()) : 0,
      }))
    }

    logger.info("Reconciliation transfers query results", {
      totalInDB: totalCount,
      fetchedCount: transactions.length,
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      source: validatedQuery.useHubSpot ? "HubSpot" : "Database",
      coverageMonth: validatedQuery.coverageMonth,
    })

    // Return transactions immediately without HubSpot data if quickLoad is requested
    const quickLoad = searchParams.get("quickLoad") === "true"
    
    let enrichedTransactions
    
    if (quickLoad || !validatedQuery.includeSOB) {
      // Return transfers immediately without HubSpot data
      // Transactions are already in the correct format from adapter
      enrichedTransactions = transactions.map((transaction) => ({
        ...transaction,
        sob: null, // No SOB data in quick load
        policiesLoading: true // Indicate that policies can be loaded separately
      }))
    } else {
      // Original slow path - kept for backward compatibility
      enrichedTransactions = await processBatch(
        transactions,
        async (transaction) => {
          // Transaction already has correct number format from adapter or database processing
          const transactionData: any = {
            ...transaction,
          }

          const sobData = await getSOBDataForTransfer(transaction)
          if (sobData) {
            // Add carrier mappings to policies
            const policiesWithCarriers = await Promise.all(
              sobData.policies.map(async (policy) => {
                const carrier = await getCarrierForProduct(policy.productName)
                return {
                  ...policy,
                  carrier: carrier || "Unmapped",
                }
              })
            )

            transactionData.sob = {
              ...sobData,
              policies: policiesWithCarriers,
            }
          }

          return transactionData
        },
        {
          batchSize: 5, // Process 5 transactions at a time
          delayBetweenBatches: 500 // Wait 500ms between batches to avoid rate limiting
        }
      )
    }

    // Calculate hierarchical carrier aggregations if SOB data is included
    let carrierTotals: any[] = []
    if (validatedQuery.includeSOB) {
      // Build hierarchical structure: Carrier -> Product -> Policies
      const hierarchicalData: any = {}
      
      enrichedTransactions.forEach((transaction) => {
        if (transaction.sob?.policies) {
          transaction.sob.policies.forEach((policy: any) => {
            const carrier = policy.carrier || "Unmapped"
            const productName = policy.productName
            
            // Initialize carrier if not exists
            if (!hierarchicalData[carrier]) {
              hierarchicalData[carrier] = {
                carrier,
                totalAmount: 0,
                policyCount: 0,
                products: {}
              }
            }
            
            // Initialize product under carrier if not exists
            if (!hierarchicalData[carrier].products[productName]) {
              hierarchicalData[carrier].products[productName] = {
                productName,
                totalAmount: 0,
                policyCount: 0,
                policies: []
              }
            }
            
            // Add policy to product
            hierarchicalData[carrier].products[productName].policies.push({
              transferId: transaction.dwollaId,
              policyId: policy.policyId,
              policyHolderName: policy.policyHolderName,
              amount: policy.monthlyCost,
              coverageLevel: policy.coverageLevel,
              planName: policy.planName
            })
            
            // Update totals
            hierarchicalData[carrier].products[productName].totalAmount += policy.monthlyCost
            hierarchicalData[carrier].products[productName].policyCount += 1
            hierarchicalData[carrier].totalAmount += policy.monthlyCost
            hierarchicalData[carrier].policyCount += 1
          })
        }
      })
      
      // Convert products object to array for each carrier
      carrierTotals = Object.values(hierarchicalData).map((carrier: any) => ({
        ...carrier,
        products: Object.values(carrier.products).sort((a: any, b: any) => 
          b.totalAmount - a.totalAmount // Sort products by amount descending
        )
      })).sort((a, b) => b.totalAmount - a.totalAmount) // Sort carriers by amount descending
    }

    // Fetch Dwolla Transfer totals from HubSpot
    let dwollaTransferTotals = {
      totalAmount: 0,
      totalFees: 0,
      transferCount: 0
    }
    
    try {
      logger.info("Starting to fetch Dwolla Transfer totals from HubSpot using direct API")
      
      const env = getEnv()
      const apiKey = env.HUBSPOT_API_KEY
      const baseUrl = env.HUBSPOT_BASE_URL
      
      // First, let's try a simpler query to just get transfers and see what we get
      const searchRequest = {
        filterGroups: [], // Start with no filters to see if we get any data
        properties: [
          "amount",
          "fee_amount",
          "dwolla_transfer_id",
          "draft_status",
          "transfer_status",
          "is_credit",
          "transfer_type"
        ],
        limit: 100
      }
      
      let after: string | undefined = undefined
      let hasMore = true
      let totalFetched = 0
      let allTransfers: any[] = []
      
      while (hasMore && totalFetched < 500) { // Limit to 500 for testing
        const requestBody = { ...searchRequest }
        if (after) {
          (requestBody as any).after = after
        }
        
        // Use the custom object name instead of ID
        const response = await fetch(`${baseUrl}/crm/v3/objects/p2_dwolla_transfer/search`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          logger.error("HubSpot API error", {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          })
          throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        const batchSize = data.results?.length || 0
        totalFetched += batchSize
        
        // Collect all transfers first
        if (data.results && Array.isArray(data.results)) {
          allTransfers.push(...data.results)
        }
        
        logger.info(`Fetched batch of Dwolla Transfers`, {
          batchSize,
          totalFetched,
          hasMore: !!data.paging?.next?.after
        })
        
        // Check for more pages
        if (data.paging?.next?.after) {
          after = data.paging.next.after
        } else {
          hasMore = false
        }
      }
      
      // Now filter and calculate totals
      logger.info(`Processing ${allTransfers.length} total Dwolla Transfers`)
      
      // Log the first few transfers to see the data structure
      if (allTransfers.length > 0) {
        logger.info("Sample transfer data:", {
          firstTransfer: allTransfers[0].properties,
          totalTransfers: allTransfers.length
        })
      }
      
      // Filter for processed transfers
      const processedTransfers = allTransfers.filter((transfer: any) => {
        const draftStatus = transfer.properties?.draft_status
        const transferStatus = transfer.properties?.transfer_status
        
        // Log a few examples to see what statuses we have
        if (Math.random() < 0.01) { // Log 1% of transfers
          logger.info("Transfer status check", {
            transferId: transfer.properties?.dwolla_transfer_id,
            draftStatus,
            transferStatus,
            matches: draftStatus === "Processed" && transferStatus === "Processed"
          })
        }
        
        return draftStatus === "Processed" && transferStatus === "Processed"
      })
      
      logger.info(`Found ${processedTransfers.length} processed transfers (draft_status=Processed, transfer_status=Processed)`)
      
      // Calculate totals from processed transfers
      processedTransfers.forEach((transfer: any) => {
        const amount = transfer.properties?.amount || 0
        const feeAmount = transfer.properties?.fee_amount || 0
        
        dwollaTransferTotals.totalAmount += Number(amount)
        dwollaTransferTotals.totalFees += Number(feeAmount)
        dwollaTransferTotals.transferCount += 1
        
        // Log first few for debugging
        if (dwollaTransferTotals.transferCount <= 5) {
          logger.info("Processing Dwolla Transfer", {
            transferId: transfer.properties?.dwolla_transfer_id,
            amount: Number(amount),
            feeAmount: Number(feeAmount),
            draftStatus: transfer.properties?.draft_status,
            transferStatus: transfer.properties?.transfer_status,
            runningTotal: dwollaTransferTotals.totalAmount
          })
        }
      })
      
      logger.info("Successfully calculated Dwolla Transfer totals", {
        totalAmount: dwollaTransferTotals.totalAmount,
        totalFees: dwollaTransferTotals.totalFees,
        transferCount: dwollaTransferTotals.transferCount,
        totalFetched: allTransfers.length,
        totalProcessed: processedTransfers.length
      })
    } catch (error) {
      logger.error("Failed to fetch Dwolla Transfer totals from HubSpot", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // Continue with zeros if fetch fails
    }

    const response = {
      transfers: enrichedTransactions,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / validatedQuery.limit),
      },
      carrierTotals,
      summary: {
        totalTransfers: enrichedTransactions.length,
        totalAmount: enrichedTransactions.reduce((sum, t) => sum + t.amount, 0),
        totalPolicies: enrichedTransactions.reduce(
          (sum, t) => sum + (t.sob?.policies?.length || 0),
          0
        ),
      },
      dwollaTransferTotals, // Add the new totals from HubSpot
    }

    logger.info("Reconciliation transfers fetched", {
      userId: session.user.id,
      transferCount: enrichedTransactions.length,
      filters: validatedQuery,
    })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error fetching reconciliation transfers", error as Error)
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 })
  }
}