import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { ApplicationError, BusinessLogicError } from "@/lib/errors"
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
  status: z.string().optional(),
  direction: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  maxAmount: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  search: z.string().optional(),
  sortBy: z.enum(["created", "amount", "customerName", "status"]).optional().default("created"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
})

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
      status: searchParams.get("status") || undefined,
      direction: searchParams.get("direction") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      minAmount: searchParams.get("minAmount") || undefined,
      maxAmount: searchParams.get("maxAmount") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "created",
      sortOrder: searchParams.get("sortOrder") || "desc",
    }

    const validatedQuery = querySchema.parse(queryParams)

    // Build where clause
    const where: any = {}
    
    // IMPORTANT: Only show customer-initiated transfers (credits to Cakewalk)
    // This filters out transfers where Cakewalk sends money to customers
    where.direction = "credit"

    if (validatedQuery.status && validatedQuery.status !== "all") {
      where.status = validatedQuery.status
    }

    // Override direction filter to always be "credit" for customer-initiated transfers
    // Even if user tries to filter by "debit", we only show credits
    if (validatedQuery.direction && validatedQuery.direction === "credit") {
      // Already set to credit above
    } else if (validatedQuery.direction && validatedQuery.direction === "debit") {
      // User is trying to see debits, but we don't show those
      // Return empty result set
      where.direction = "never_match"
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

    if (validatedQuery.minAmount !== undefined || validatedQuery.maxAmount !== undefined) {
      where.amount = {}
      if (validatedQuery.minAmount !== undefined) {
        where.amount.gte = validatedQuery.minAmount
      }
      if (validatedQuery.maxAmount !== undefined) {
        where.amount.lte = validatedQuery.maxAmount
      }
    }

    if (validatedQuery.search) {
      where.AND = [
        {
          OR: [
            { dwollaId: { contains: validatedQuery.search, mode: "insensitive" } },
            { customerName: { contains: validatedQuery.search, mode: "insensitive" } },
            { companyName: { contains: validatedQuery.search, mode: "insensitive" } },
            { correlationId: { contains: validatedQuery.search, mode: "insensitive" } },
            { invoiceNumber: { contains: validatedQuery.search, mode: "insensitive" } },
          ],
        },
      ]
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
        [validatedQuery.sortBy]: validatedQuery.sortOrder,
      },
    })

    // Transform decimal fields to numbers for JSON serialization
    const transformedTransactions = transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
      fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
      netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
    }))

    // Calculate aggregate metrics
    const metrics = await prisma.aCHTransaction.aggregate({
      where,
      _sum: {
        amount: true,
        fees: true,
        netAmount: true,
      },
      _count: {
        _all: true,
      },
    })

    // Calculate status counts
    const statusCounts = await prisma.aCHTransaction.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    })

    const response = {
      transactions: transformedTransactions,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / validatedQuery.limit),
      },
      metrics: {
        totalAmount: metrics._sum.amount ? parseFloat(metrics._sum.amount.toString()) : 0,
        totalFees: metrics._sum.fees ? parseFloat(metrics._sum.fees.toString()) : 0,
        totalNetAmount: metrics._sum.netAmount ? parseFloat(metrics._sum.netAmount.toString()) : 0,
        totalCount: metrics._count._all,
        statusCounts: statusCounts.reduce((acc: any, item) => {
          acc[item.status] = item._count._all
          return acc
        }, {}),
      },
    }

    // Log successful request
    logger.info("ACH transactions fetched", {
      userId: session.user.id,
      transactionCount: transactions.length,
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

    if (error instanceof ApplicationError) {
      return NextResponse.json(error.toClientResponse(), { status: error.statusCode })
    }

    logger.error("Error fetching ACH transactions", error as Error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}
