import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"

// Schema for generating reconciliation
const generateReconciliationSchema = z.object({
  transferIds: z.array(z.string()).optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
  status: z.enum(["processed", "pending", "failed"]).optional().default("processed"),
  notes: z.string().optional(),
})

// Helper to generate session number
function generateSessionNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `REC-${year}${month}${day}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = generateReconciliationSchema.parse(body)

    // Build query for transfers
    const where: any = {
      direction: "credit",
      status: validatedData.status,
    }

    if (validatedData.transferIds && validatedData.transferIds.length > 0) {
      where.dwollaId = { in: validatedData.transferIds }
    }

    if (validatedData.dateRangeStart || validatedData.dateRangeEnd) {
      where.created = {}
      if (validatedData.dateRangeStart) {
        where.created.gte = new Date(validatedData.dateRangeStart)
      }
      if (validatedData.dateRangeEnd) {
        where.created.lte = new Date(validatedData.dateRangeEnd)
      }
    }

    // Fetch transfers
    const transfers = await prisma.aCHTransaction.findMany({
      where,
      orderBy: { created: "desc" },
    })

    if (transfers.length === 0) {
      return NextResponse.json(
        { error: "No transfers found matching the criteria" },
        { status: 404 }
      )
    }

    // Get carrier mappings
    const carrierMappings = await prisma.carrierMapping.findMany({
      where: { isActive: true },
    })

    const mappingLookup = carrierMappings.reduce((acc: any, mapping) => {
      acc[mapping.productName] = mapping.carrierName
      return acc
    }, {})

    // Process each transfer and build policy details
    const policyDetails: any[] = []
    const carrierTotals: Record<string, number> = {}
    let totalAmount = 0
    let totalPolicyCount = 0

    for (const transfer of transfers) {
      // TODO: Replace with actual HubSpot API call
      // Mock policy data for now
      const mockPolicies = [
        {
          productName: "Dental",
          policyHolderName: transfer.customerName || "Unknown",
          monthlyCost: 45.00,
          coverageLevel: "Employee Only",
        },
        {
          productName: "Vision",
          policyHolderName: transfer.customerName || "Unknown",
          monthlyCost: 12.00,
          coverageLevel: "Employee Only",
        },
        {
          productName: "Life Insurance",
          policyHolderName: transfer.customerName || "Unknown",
          monthlyCost: 125.00,
          coverageLevel: "Employee Only",
        },
      ]

      for (const policy of mockPolicies) {
        const carrierName = mappingLookup[policy.productName] || "Unmapped"
        
        const policyDetail = {
          transferId: transfer.dwollaId,
          transferDate: transfer.created,
          companyName: transfer.companyName || transfer.customerName,
          policyId: `${policy.policyHolderName} - ${policy.productName}`,
          policyHolderName: policy.policyHolderName,
          productName: policy.productName,
          monthlyCost: policy.monthlyCost,
          coverageLevel: policy.coverageLevel,
          carrierName,
        }

        policyDetails.push(policyDetail)
        
        // Update carrier totals
        if (!carrierTotals[carrierName]) {
          carrierTotals[carrierName] = 0
        }
        carrierTotals[carrierName] += policy.monthlyCost
        totalAmount += policy.monthlyCost
        totalPolicyCount += 1
      }
    }

    // Create reconciliation session
    const reconciliationSession = await prisma.reconciliationSession.create({
      data: {
        sessionNumber: generateSessionNumber(),
        transferIds: transfers.map(t => t.dwollaId),
        dateRangeStart: validatedData.dateRangeStart ? new Date(validatedData.dateRangeStart) : null,
        dateRangeEnd: validatedData.dateRangeEnd ? new Date(validatedData.dateRangeEnd) : null,
        status: "draft",
        transferCount: transfers.length,
        policyCount: totalPolicyCount,
        totalAmount,
        carrierTotals,
        policyDetails,
        notes: validatedData.notes,
        createdBy: session.user.id || session.user.email || "unknown",
      },
    })

    // Prepare response
    const response = {
      session: {
        id: reconciliationSession.id,
        sessionNumber: reconciliationSession.sessionNumber,
        status: reconciliationSession.status,
        createdAt: reconciliationSession.createdAt,
      },
      summary: {
        transferCount: transfers.length,
        policyCount: totalPolicyCount,
        totalAmount,
        dateRange: {
          start: validatedData.dateRangeStart,
          end: validatedData.dateRangeEnd,
        },
      },
      carrierBreakdown: Object.entries(carrierTotals).map(([carrier, amount]) => ({
        carrier,
        amount,
        policyCount: policyDetails.filter(p => p.carrierName === carrier).length,
      })),
      unmappedProducts: policyDetails
        .filter(p => p.carrierName === "Unmapped")
        .map(p => p.productName)
        .filter((value, index, self) => self.indexOf(value) === index), // unique products
    }

    logger.info("Reconciliation session generated", {
      userId: session.user.id,
      sessionId: reconciliationSession.id,
      sessionNumber: reconciliationSession.sessionNumber,
      transferCount: transfers.length,
      policyCount: totalPolicyCount,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error generating reconciliation", error as Error)
    return NextResponse.json({ error: "Failed to generate reconciliation" }, { status: 500 })
  }
}

// GET - Fetch existing reconciliation sessions
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "10")
    const page = parseInt(searchParams.get("page") || "1")

    const where: any = {}
    if (status) {
      where.status = status
    }

    const skip = (page - 1) * limit

    const [sessions, totalCount] = await Promise.all([
      prisma.reconciliationSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sessionNumber: true,
          status: true,
          transferCount: true,
          policyCount: true,
          totalAmount: true,
          dateRangeStart: true,
          dateRangeEnd: true,
          createdBy: true,
          createdAt: true,
          reviewedAt: true,
          finalizedAt: true,
        },
      }),
      prisma.reconciliationSession.count({ where }),
    ])

    // Transform decimal fields
    const transformedSessions = sessions.map(s => ({
      ...s,
      totalAmount: s.totalAmount ? parseFloat(s.totalAmount.toString()) : 0,
    }))

    return NextResponse.json({
      sessions: transformedSessions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    logger.error("Error fetching reconciliation sessions", error as Error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}