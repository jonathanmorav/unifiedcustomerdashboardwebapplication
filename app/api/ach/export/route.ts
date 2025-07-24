import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { createEndpointRateLimiter } from "@/lib/security/middleware/rate-limit-middleware"
import { z } from "zod"

// Rate limiter for export endpoint
const exportRateLimiter = createEndpointRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 exports per 5 minutes
})

// Query schema for export
const exportQuerySchema = z.object({
  format: z.enum(["csv", "excel"]).default("csv"),
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
})

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return ""
  const stringValue = String(value)

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function generateCsv(transactions: any[]): string {
  const headers = [
    "Transaction ID",
    "Status",
    "Amount",
    "Direction",
    "Customer Name",
    "Company Name",
    "Email",
    "Bank Last 4",
    "Invoice Number",
    "Transaction Type",
    "Created Date",
    "Processed Date",
    "Clearing Date",
    "Fees",
    "Net Amount",
    "Correlation ID",
    "ACH ID",
    "Failure Reason",
  ]

  const csvRows = [headers.map(escapeCsvValue).join(",")]

  for (const transaction of transactions) {
    const row = [
      transaction.dwollaId,
      transaction.status,
      transaction.amount,
      transaction.direction,
      transaction.customerName,
      transaction.companyName,
      transaction.customerEmail,
      transaction.bankLastFour,
      transaction.invoiceNumber,
      transaction.transactionType,
      transaction.created ? new Date(transaction.created).toISOString() : "",
      transaction.processedAt ? new Date(transaction.processedAt).toISOString() : "",
      transaction.clearingDate ? new Date(transaction.clearingDate).toISOString() : "",
      transaction.fees || 0,
      transaction.netAmount || transaction.amount,
      transaction.correlationId,
      transaction.individualAchId,
      transaction.failureReason,
    ]

    csvRows.push(row.map(escapeCsvValue).join(","))
  }

  return csvRows.join("\n")
}

function generateExcel(transactions: any[]): Buffer {
  // For Excel, we'll generate a simple CSV that Excel can open
  // In a production environment, you'd use a library like exceljs
  const csv = generateCsv(transactions)
  return Buffer.from(csv, "utf-8")
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await exportRateLimiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      format: searchParams.get("format") || "csv",
      status: searchParams.get("status") || undefined,
      direction: searchParams.get("direction") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      minAmount: searchParams.get("minAmount") || undefined,
      maxAmount: searchParams.get("maxAmount") || undefined,
      search: searchParams.get("search") || undefined,
    }

    const validatedQuery = exportQuerySchema.parse(queryParams)

    // Build where clause (same as main transactions endpoint)
    const where: any = {}

    if (validatedQuery.status && validatedQuery.status !== "all") {
      where.status = validatedQuery.status
    }

    if (validatedQuery.direction && validatedQuery.direction !== "all") {
      where.direction = validatedQuery.direction
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
      where.OR = [
        { dwollaId: { contains: validatedQuery.search, mode: "insensitive" } },
        { customerName: { contains: validatedQuery.search, mode: "insensitive" } },
        { companyName: { contains: validatedQuery.search, mode: "insensitive" } },
        { correlationId: { contains: validatedQuery.search, mode: "insensitive" } },
        { invoiceNumber: { contains: validatedQuery.search, mode: "insensitive" } },
      ]
    }

    // Fetch all matching transactions (limited to 10k for safety)
    const transactions = await prisma.aCHTransaction.findMany({
      where,
      take: 10000,
      orderBy: {
        created: "desc",
      },
    })

    // Transform decimal fields
    const transformedTransactions = transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
      fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
      netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
    }))

    // Generate export file
    let fileContent: string | Buffer
    let contentType: string
    let filename: string

    if (validatedQuery.format === "excel") {
      fileContent = generateExcel(transformedTransactions)
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      filename = `ach-transactions-${new Date().toISOString().split("T")[0]}.xlsx`
    } else {
      fileContent = generateCsv(transformedTransactions)
      contentType = "text/csv"
      filename = `ach-transactions-${new Date().toISOString().split("T")[0]}.csv`
    }

    // Log export
    logger.info("ACH transactions exported", {
      userId: session.user.id,
      format: validatedQuery.format,
      transactionCount: transactions.length,
      filters: validatedQuery,
    })

    // Return file
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error exporting ACH transactions", error as Error)
    return NextResponse.json({ error: "Failed to export transactions" }, { status: 500 })
  }
}
