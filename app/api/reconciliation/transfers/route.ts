import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"

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
}

interface SOBData {
  sobId: string
  companyName: string
  amountToDraft: number
  feeAmount: number
  policies: PolicyData[]
  coverageMonth: string
}

// Helper function to get SOB and policies for a transfer
async function getSOBDataForTransfer(transfer: any): Promise<SOBData | null> {
  try {
    // TODO: Replace with actual HubSpot API call using transfer.customerId or correlationId
    // For now, return mock data based on transfer
    
    if (!transfer.customerId && !transfer.correlationId) {
      return null
    }

    // Mock implementation - replace with actual HubSpot integration
    const mockPolicies: PolicyData[] = [
      {
        policyId: `${transfer.customerName || "Customer"} - Dental`,
        policyHolderName: transfer.customerName || "Unknown",
        productName: "Dental",
        planName: "Enhanced",
        monthlyCost: 45.00,
        coverageLevel: "Employee Only",
        effectiveDate: "2024-01-01",
        status: "Active"
      },
      {
        policyId: `${transfer.customerName || "Customer"} - Vision`,
        policyHolderName: transfer.customerName || "Unknown",
        productName: "Vision",
        planName: "Standard",
        monthlyCost: 12.00,
        coverageLevel: "Employee Only",
        effectiveDate: "2024-01-01",
        status: "Active"
      },
      {
        policyId: `${transfer.customerName || "Customer"} - Life Insurance`,
        policyHolderName: transfer.customerName || "Unknown",
        productName: "Life Insurance",
        planName: "100K Coverage",
        monthlyCost: 125.00,
        coverageLevel: "Employee Only",
        effectiveDate: "2024-01-01",
        status: "Active"
      }
    ]

    // Calculate total from policies
    const totalAmount = mockPolicies.reduce((sum, policy) => sum + policy.monthlyCost, 0)

    return {
      sobId: `SOB-${transfer.dwollaId}`,
      companyName: transfer.companyName || transfer.customerName || "Unknown Company",
      amountToDraft: totalAmount,
      feeAmount: totalAmount * 0.02, // 2% fee
      policies: mockPolicies,
      coverageMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
    }
  } catch (error) {
    logger.error("Error fetching SOB data", { error, transferId: transfer.id })
    return null
  }
}

// Helper function to get carrier mapping for a product
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
    }

    const validatedQuery = querySchema.parse(queryParams)

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
        where.created.gte = new Date(validatedQuery.startDate)
      }
      if (validatedQuery.endDate) {
        where.created.lte = new Date(validatedQuery.endDate)
      }
    }

    // Calculate pagination
    const skip = (validatedQuery.page - 1) * validatedQuery.limit

    // Get total count for pagination
    const totalCount = await prisma.aCHTransaction.count({ where })

    // Fetch transactions
    const transactions = await prisma.aCHTransaction.findMany({
      where,
      skip,
      take: validatedQuery.limit,
      orderBy: {
        created: "desc",
      },
    })

    // Enrich transactions with SOB and policy data if requested
    const enrichedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        const transactionData: any = {
          ...transaction,
          amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
          fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
          netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
        }

        if (validatedQuery.includeSOB) {
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
        }

        return transactionData
      })
    )

    // Calculate carrier aggregations if SOB data is included
    let carrierTotals = {}
    if (validatedQuery.includeSOB) {
      carrierTotals = enrichedTransactions.reduce((acc: any, transaction) => {
        if (transaction.sob?.policies) {
          transaction.sob.policies.forEach((policy: any) => {
            const carrier = policy.carrier || "Unmapped"
            if (!acc[carrier]) {
              acc[carrier] = {
                totalAmount: 0,
                policyCount: 0,
                policies: []
              }
            }
            acc[carrier].totalAmount += policy.monthlyCost
            acc[carrier].policyCount += 1
            acc[carrier].policies.push({
              transferId: transaction.dwollaId,
              policyId: policy.policyId,
              amount: policy.monthlyCost
            })
          })
        }
        return acc
      }, {})
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