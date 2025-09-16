import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { HubSpotService } from "@/lib/api/hubspot/service"
import { getEnv } from "@/lib/env"
import { hubspotCache } from "@/lib/cache/hubspot-cache"
import { databaseCache } from "@/lib/cache/database-cache"
import { prisma } from "@/lib/db"

// Request schema for fetching policies
const fetchPoliciesSchema = z.object({
  transferIds: z.array(z.string()),
  batchSize: z.number().min(1).max(50).default(10),
})

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

// Helper to get carrier mapping
async function getCarrierForProduct(productName: string): Promise<string | null> {
  try {
    const mapping = await prisma.carrierMapping.findUnique({
      where: { productName },
      select: { carrierName: true }
    })
    return mapping?.carrierName || null
  } catch (error) {
    logger.error("Error fetching carrier mapping", { error, productName })
    return null
  }
}

// POST - Fetch policies for specific transfers
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { transferIds, batchSize } = fetchPoliciesSchema.parse(body)

    logger.info("Fetching policies for transfers", {
      userId: session.user.id,
      transferCount: transferIds.length,
      batchSize,
    })

    // Get transfers from database
    const transfers = await prisma.aCHTransaction.findMany({
      where: {
        dwollaId: { in: transferIds }
      }
    })

    if (transfers.length === 0) {
      return NextResponse.json({ 
        policies: [],
        message: "No transfers found" 
      })
    }

    const env = getEnv()
    const useHubSpot = process.env.DEMO_MODE !== "true" && env.HUBSPOT_API_KEY
    
    if (!useHubSpot) {
      // Return mock data for demo mode with variety of products
      const mockPolicies = transfers.map(transfer => {
        // Create a variety of policies for each transfer
        const policies = [
          {
            policyId: `${transfer.customerName || "Customer"} - Dental`,
            policyHolderName: transfer.customerName || "Unknown",
            productName: "Dental",
            monthlyCost: 45.00,
            coverageLevel: "Employee Only",
            carrier: MOCK_CARRIER_MAPPINGS["Dental"] || "Unmapped"
          },
          {
            policyId: `${transfer.customerName || "Customer"} - Vision`,
            policyHolderName: transfer.customerName || "Unknown",
            productName: "Vision",
            monthlyCost: 12.00,
            coverageLevel: "Employee Only",
            carrier: MOCK_CARRIER_MAPPINGS["Vision"] || "Unmapped"
          },
          {
            policyId: `${transfer.customerName || "Customer"} - Voluntary Life & AD&D`,
            policyHolderName: transfer.customerName || "Unknown",
            productName: "Voluntary Life & AD&D",
            monthlyCost: 125.00,
            coverageLevel: "Employee Only",
            carrier: MOCK_CARRIER_MAPPINGS["Voluntary Life & AD&D"] || "Unmapped"
          },
          {
            policyId: `${transfer.customerName || "Customer"} - Short Term Disability`,
            policyHolderName: transfer.customerName || "Unknown",
            productName: "Short Term Disability",
            monthlyCost: 35.00,
            coverageLevel: "Employee Only",
            carrier: MOCK_CARRIER_MAPPINGS["Short Term Disability"] || "Unmapped"
          }
        ]
        
        return {
          transferId: transfer.dwollaId,
          sobData: {
            sobId: `SOB-${transfer.dwollaId}`,
            companyName: transfer.companyName || transfer.customerName || "Unknown",
            policies
          }
        }
      })

      return NextResponse.json({
        policies: mockPolicies,
        completed: transferIds.length,
        total: transferIds.length,
        fromCache: false
      })
    }

    // Fetch from HubSpot
    const hubspotService = new HubSpotService()
    const results: any[] = []
    const errors: any[] = []

    // Process in smaller batches to avoid rate limiting
    for (let i = 0; i < transfers.length; i += batchSize) {
      const batch = transfers.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (transfer) => {
          try {
            // Check database cache first
            const dbCached = await databaseCache.getSOB(transfer.dwollaId)
            if (dbCached) {
              return {
                transferId: transfer.dwollaId,
                sobData: dbCached,
                fromCache: true,
                cacheType: 'database'
              }
            }
            
            // Check memory cache second
            const cacheKey = `sob_${transfer.customerId || transfer.dwollaId}`
            const cached = hubspotCache.get(cacheKey)
            if (cached) {
              return {
                transferId: transfer.dwollaId,
                sobData: cached,
                fromCache: true,
                cacheType: 'memory'
              }
            }

            // Fetch from HubSpot
            let customerData = null
            
            if (transfer.customerId) {
              customerData = await hubspotService.searchCustomer({
                searchTerm: transfer.customerId,
                searchType: "dwolla_id"
              }).catch(() => null)
            }
            
            if (!customerData && (transfer.companyName || transfer.customerName)) {
              customerData = await hubspotService.searchCustomer({
                searchTerm: (transfer.companyName || transfer.customerName) as string,
                searchType: "business_name"
              }).catch(() => null)
            }
            
            if (!customerData || !customerData.summaryOfBenefits?.length) {
              return {
                transferId: transfer.dwollaId,
                sobData: null,
                fromCache: false
              }
            }
            
            // Process policies
            const latestSOB = customerData.summaryOfBenefits[0]
            const policies = await Promise.all(
              customerData.policies.map(async (policy) => {
                const props = policy.properties
                const policyHolderName = props.policyholder || 
                  `${props.first_name || ""} ${props.last_name || ""}`.trim() || 
                  transfer.customerName || 
                  "Unknown"
                
                const productName = String(props.product_name || "Unknown Product")
                const carrier = await getCarrierForProduct(productName)
                
                return {
                  policyId: `${policyHolderName} - ${productName}`,
                  policyHolderName,
                  productName,
                  planName: props.plan_name,
                  monthlyCost: typeof props.cost_per_month === 'string' 
                    ? parseFloat(props.cost_per_month) 
                    : (props.cost_per_month || 0),
                  coverageLevel: props.coverage_level_display || props.coverage_level || "Unknown",
                  carrier: carrier || "Unmapped"
                }
              })
            )
            
            const sobData = {
              sobId: latestSOB.id,
              companyName: customerData.company?.properties?.name || 
                           transfer.companyName || 
                           transfer.customerName || 
                           "Unknown Company",
              doubleBill: latestSOB.properties?.double_bill || null,
              amountToDraft: latestSOB.properties?.amount_to_draft || 0,
              policies
            }
            
            // Debug logging for double bill
            if (latestSOB.properties?.double_bill) {
              logger.info("Double Bill found", {
                transferId: transfer.dwollaId,
                sobId: latestSOB.id,
                doubleBill: latestSOB.properties.double_bill
              })
            }
            
            // Cache the result in memory
            hubspotCache.set(cacheKey, sobData, 10 * 60 * 1000) // 10 minutes
            
            // Cache in database for persistent storage
            if (customerData) {
              await databaseCache.setCompany(
                customerData, 
                transfer.customerId || undefined,
                24 * 60 * 60 * 1000 // 24 hours
              ).catch(err => {
                logger.warn("Failed to cache to database", { error: err })
              })
            }
            
            return {
              transferId: transfer.dwollaId,
              sobData,
              fromCache: false
            }
          } catch (error) {
            logger.error("Error fetching policies for transfer", {
              transferId: transfer.dwollaId,
              error
            })
            return {
              transferId: transfer.dwollaId,
              sobData: null,
              error: error instanceof Error ? error.message : "Unknown error"
            }
          }
        })
      )
      
      // Collect results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          errors.push({
            transferId: 'unknown',
            error: result.reason
          })
        }
      })
      
      // Add delay between batches if not last batch
      if (i + batchSize < transfers.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return NextResponse.json({
      policies: results.filter(r => r.sobData !== null),
      errors: errors.length > 0 ? errors : undefined,
      completed: results.length,
      total: transferIds.length,
      fromCache: results.some(r => r.fromCache)
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error fetching policies", error as Error)
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 })
  }
}