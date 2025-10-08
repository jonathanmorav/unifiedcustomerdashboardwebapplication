import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { createEndpointRateLimiter } from "@/lib/security/middleware/rate-limit-middleware"
import { z } from "zod"
import { TransferAdapter } from "@/lib/api/adapters/transfer-adapter"
import { HubSpotClient } from "@/lib/api/hubspot/client"

// Rate limiter for export endpoint with more generous limits
const exportRateLimiter = createEndpointRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 exports per 5 minutes (increased from 10)
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
    "Dwolla Customer ID",
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
    "Coverage Month", // Real coverage month from Dwolla Transfer
  ]

  const csvRows = [headers.map(escapeCsvValue).join(",")]

  for (const transaction of transactions) {
    const row = [
      transaction.dwollaId,
      transaction.status,
      transaction.amount,
      transaction.direction,
      transaction.customerName,
      transaction.customerId,
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
      transaction.coverageMonth || "", // Use the real coverage month from TransferAdapter
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
    // Apply rate limiting with better error messages
    const rateLimitResult = await exportRateLimiter(request)
    if (rateLimitResult) {
      // Get the user-friendly error message
      const rateLimitError = await rateLimitResult.json().catch(() => ({ error: "Rate limit exceeded" }))
      
      return NextResponse.json({
        error: "Export rate limit exceeded",
        message: "You have reached the maximum number of exports allowed. Please wait a few minutes before trying again.",
        retryAfter: "5 minutes",
        details: rateLimitError
      }, { 
        status: 429,
        headers: {
          'Retry-After': '300', // 5 minutes in seconds
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Window': '300'
        }
      })
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

    // Try TransferAdapter first, fallback to database if it fails
    let transformedTransactions: any[] = []
    
    try {
      const transferAdapter = new TransferAdapter()
      const result = await transferAdapter.getTransfersWithCompatibility({
        status: validatedQuery.status,
        startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : null,
        endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : null,
        limit: 10000,
        page: 1,
        useHubSpot: true,
      })

      transformedTransactions = result.transfers.map(transfer => ({
        dwollaId: transfer.dwollaId,
        status: transfer.status,
        amount: transfer.amount,
        direction: transfer.direction,
        customerName: transfer.customerName,
        customerId: transfer.customerId,
        companyName: transfer.companyName,
        customerEmail: transfer.customerEmail,
        bankLastFour: transfer.bankLastFour,
        invoiceNumber: transfer.invoiceNumber,
        transactionType: transfer.transactionType,
        created: transfer.created,
        processedAt: transfer.processedAt,
        clearingDate: transfer.clearingDate,
        fees: transfer.fees,
        netAmount: transfer.netAmount,
        correlationId: transfer.correlationId,
        individualAchId: transfer.individualAchId,
        failureReason: transfer.failureReason,
        coverageMonth: transfer.coverageMonth,
      }))
    } catch (transferError) {
      logger.warn("TransferAdapter failed, falling back to database", transferError as Error)
      
      // Fallback to database query
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

      // Exclude test customer IDs
      const excludedTestCustomerIds = [
        "cust_x5aior80g",
        "cust_npuehcu3i",
        "cust_omdl5p79u",
      ]
      where.AND = [
        ...(where.AND || []),
        {
          NOT: [
            { customerId: { in: excludedTestCustomerIds } },
            { customerId: { startsWith: "cust_" } },
          ],
        },
      ]

      const transactions = await prisma.aCHTransaction.findMany({
        where,
        take: 10000,
        orderBy: {
          created: "desc",
        },
      })

      // Optimize coverage month retrieval - batch HubSpot calls
      let transactionsWithCoverageMonth: any[] = []
      
      try {
        // First, separate transactions that already have coverage month in metadata
        const transactionsWithMetadata = transactions.filter(t => (t.metadata as any)?.coverageMonth)
        const transactionsNeedingLookup = transactions.filter(t => !(t.metadata as any)?.coverageMonth)
        
        logger.info("Coverage month optimization stats", {
          totalTransactions: transactions.length,
          withMetadata: transactionsWithMetadata.length,
          needingLookup: transactionsNeedingLookup.length,
          operation: "export_coverage_optimization"
        })

        // Add transactions that already have metadata
        const processedWithMetadata = transactionsWithMetadata.map(transaction => ({
          ...transaction,
          amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
          fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
          netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
          coverageMonth: (transaction.metadata as any)?.coverageMonth,
        }))

        // For transactions needing HubSpot lookup, batch the operations and add timeout
        let processedNeedingLookup: any[] = []
        
        if (transactionsNeedingLookup.length > 0) {
          // Limit HubSpot lookups to prevent timeouts (max 100 transactions)
          const limitedTransactions = transactionsNeedingLookup.slice(0, 100)
          
          if (limitedTransactions.length < transactionsNeedingLookup.length) {
            logger.warn("Limited HubSpot lookups due to performance", {
              requested: transactionsNeedingLookup.length,
              limited: limitedTransactions.length,
              operation: "export_hubspot_limit"
            })
          }

          // Process in smaller batches with timeout
          const batchSize = 10
          const timeoutMs = 30000 // 30 second timeout
          
          for (let i = 0; i < limitedTransactions.length; i += batchSize) {
            const batch = limitedTransactions.slice(i, i + batchSize)
            
            try {
              const batchPromise = Promise.all(
                batch.map(async (transaction) => {
                  try {
                    const hubspotClient = new HubSpotClient()
                    
                    // Get the Dwolla transfer (with timeout)
                    const hubspotTransfer = await Promise.race([
                      hubspotClient.getDwollaTransferById(transaction.dwollaId),
                      new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("HubSpot lookup timeout")), 5000)
                      )
                    ]) as any

                    let coverageMonth = hubspotTransfer.properties.coverage_month || "Unknown"
                    
                    return {
                      ...transaction,
                      amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
                      fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
                      netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
                      coverageMonth,
                    }
                  } catch (error) {
                    logger.warn("Individual transaction HubSpot lookup failed", {
                      dwollaId: transaction.dwollaId,
                      error: error instanceof Error ? error.message : String(error),
                      operation: "export_individual_lookup_failed"
                    })
                    
                    return {
                      ...transaction,
                      amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
                      fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
                      netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
                      coverageMonth: "Unknown",
                    }
                  }
                })
              )

              // Add timeout to the entire batch
              const batchResults = await Promise.race([
                batchPromise,
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Batch timeout")), timeoutMs)
                )
              ]) as any[]

              processedNeedingLookup.push(...batchResults)
              
            } catch (error) {
              logger.error("Batch HubSpot lookup failed", {
                batchStart: i,
                batchSize: batch.length,
                error: error instanceof Error ? error.message : String(error),
                operation: "export_batch_lookup_failed"
              })
              
              // Add transactions with "Unknown" coverage month if batch fails
              const failedBatch = batch.map(transaction => ({
                ...transaction,
                amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
                fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
                netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
                coverageMonth: "Unknown",
              }))
              
              processedNeedingLookup.push(...failedBatch)
            }
          }

          // Add remaining transactions that were skipped due to limit
          if (transactionsNeedingLookup.length > 100) {
            const remaining = transactionsNeedingLookup.slice(100).map(transaction => ({
              ...transaction,
              amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
              fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
              netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
              coverageMonth: "Unknown",
            }))
            
            processedNeedingLookup.push(...remaining)
          }
        }

        transactionsWithCoverageMonth = [...processedWithMetadata, ...processedNeedingLookup]
        
        logger.info("Coverage month processing completed", {
          totalProcessed: transactionsWithCoverageMonth.length,
          withMetadata: processedWithMetadata.length,
          withHubspotLookup: processedNeedingLookup.length,
          operation: "export_coverage_processing_complete"
        })

      } catch (error) {
        logger.error("Coverage month processing failed entirely", {
          error: error instanceof Error ? error.message : String(error),
          operation: "export_coverage_processing_error"
        })
        
        // Fallback: return all transactions with "Unknown" coverage month
        transactionsWithCoverageMonth = transactions.map(transaction => ({
          ...transaction,
          amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
          fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
          netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
          coverageMonth: "Unknown",
        }))
      }

      transformedTransactions = transactionsWithCoverageMonth
    }

    // Apply additional filters
    let filteredTransactions = transformedTransactions

    if (validatedQuery.minAmount !== undefined || validatedQuery.maxAmount !== undefined) {
      filteredTransactions = filteredTransactions.filter(transaction => {
        if (validatedQuery.minAmount !== undefined && transaction.amount < validatedQuery.minAmount) {
          return false
        }
        if (validatedQuery.maxAmount !== undefined && transaction.amount > validatedQuery.maxAmount) {
          return false
        }
        return true
      })
    }

    if (validatedQuery.search) {
      const searchTerm = validatedQuery.search.toLowerCase()
      filteredTransactions = filteredTransactions.filter(transaction => 
        transaction.dwollaId?.toLowerCase().includes(searchTerm) ||
        transaction.customerName?.toLowerCase().includes(searchTerm) ||
        transaction.companyName?.toLowerCase().includes(searchTerm) ||
        transaction.correlationId?.toLowerCase().includes(searchTerm) ||
        transaction.invoiceNumber?.toLowerCase().includes(searchTerm)
      )
    }

    if (validatedQuery.direction && validatedQuery.direction !== "all") {
      filteredTransactions = filteredTransactions.filter(transaction => 
        transaction.direction === validatedQuery.direction
      )
    }

    // Generate export file
    let fileContent: string | Buffer
    let contentType: string
    let filename: string

    if (validatedQuery.format === "excel") {
      fileContent = generateExcel(filteredTransactions)
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      filename = `ach-transactions-${new Date().toISOString().split("T")[0]}.xlsx`
    } else {
      fileContent = generateCsv(filteredTransactions)
      contentType = "text/csv"
      filename = `ach-transactions-${new Date().toISOString().split("T")[0]}.csv`
    }

    // Log export
    logger.info("ACH transactions exported", {
      userId: session.user.id,
      format: validatedQuery.format,
      transactionCount: filteredTransactions.length,
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
        { 
          error: "Invalid query parameters", 
          message: "The request contains invalid parameters. Please check your filters and try again.",
          details: error.format() 
        },
        { status: 400 }
      )
    }

    // Enhanced error logging with more context
    logger.error("Error exporting ACH transactions", error as Error, {
      userId: session?.user?.id,
      queryParams: request.nextUrl.searchParams.toString(),
      operation: "export_critical_error"
    })

    // Check if it's a timeout error
    if (error instanceof Error && (
      error.message.includes('timeout') || 
      error.message.includes('TIMEOUT') ||
      error.name === 'TimeoutError'
    )) {
      return NextResponse.json({ 
        error: "Export timeout",
        message: "The export is taking longer than expected. This usually happens with large datasets. Please try with smaller date ranges or contact support if this persists.",
        suggestion: "Try filtering by a smaller date range or specific transaction statuses"
      }, { status: 408 })
    }

    // Check if it's a database connection error  
    if (error instanceof Error && (
      error.message.includes('connect') || 
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('database')
    )) {
      return NextResponse.json({ 
        error: "Database connection error",
        message: "Unable to connect to the database. Please try again in a few moments.",
        suggestion: "If this issue persists, please contact support"
      }, { status: 503 })
    }

    // Generic server error with helpful message
    return NextResponse.json({ 
      error: "Export failed", 
      message: "An unexpected error occurred while generating the export. Please try again, and if the problem persists, contact support.",
      suggestion: "Try refreshing the page and attempting the export again"
    }, { status: 500 })
  }
}
