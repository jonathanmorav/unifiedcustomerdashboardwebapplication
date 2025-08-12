import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { ApplicationError } from "@/lib/errors"
import { DwollaClient, DwollaAPIError } from "@/lib/api/dwolla/client"
import { prisma } from "@/lib/db"
import { createEndpointRateLimiter } from "@/lib/security/middleware/rate-limit-middleware"

// Rate limiter for status refresh endpoint
const refreshStatusRateLimiter = createEndpointRateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 3, // 3 status refreshes per 2 minutes
})

interface RefreshStatusesRequest {
  statuses?: string[]
  olderThanDays?: number
  transactionIds?: string[]
  concurrency?: number
  limit?: number
}

function normalizeStatus(dwollaStatus: string): string {
  // Map any Dwolla/legacy statuses to our canonical set
  if (dwollaStatus === "completed") return "processed"
  return dwollaStatus
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await refreshStatusRateLimiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body: RefreshStatusesRequest = await request.json().catch(() => ({}))
    const {
      statuses = ["pending", "processing"], // Default to refreshing pending/processing statuses
      olderThanDays = 0, // By default, check all transactions regardless of age
      transactionIds = [], // Optional: specific transaction IDs to refresh
      concurrency = 5, // Concurrent API calls to Dwolla
      limit = 1000, // Max transactions to process in one request
    } = body

    // Check if we should use demo mode
    const isDemoMode =
      process.env.DEMO_MODE === "true" ||
      !process.env.DWOLLA_KEY ||
      !process.env.DWOLLA_SECRET ||
      !process.env.DWOLLA_MASTER_ACCOUNT_ID

    if (isDemoMode) {
      logger.info("Demo mode detected - simulating status refresh", {
        userId: session.user.id,
        statuses,
        olderThanDays,
        transactionIds: transactionIds.length,
      })

      // In demo mode, simulate some status updates
      const demoTransactions = await prisma.aCHTransaction.findMany({
        where: {
          status: { in: statuses },
          ...(transactionIds.length > 0 ? { dwollaId: { in: transactionIds } } : {}),
        },
        select: { id: true, dwollaId: true, status: true },
        take: Math.min(limit, 10), // Limit demo updates
      })

      let updated = 0
      for (const transaction of demoTransactions) {
        // Randomly update some statuses for demo
        if (Math.random() < 0.3) {
          // 30% chance to update
          const newStatus = ["processed", "failed", "returned"][Math.floor(Math.random() * 3)]
          await prisma.aCHTransaction.update({
            where: { id: transaction.id },
            data: {
              status: newStatus,
              lastUpdated: new Date(),
              ...(newStatus === "processed" ? { processedAt: new Date() } : {}),
            },
          })
          updated++
        }
      }

      return NextResponse.json({
        message: "Status refresh completed (demo mode)",
        results: {
          checked: demoTransactions.length,
          updated,
          demo: true,
        },
      })
    }

    const client = new DwollaClient()

    // Build filter for transactions to refresh
    const whereClause: any = {
      status: { in: statuses },
    }

    if (transactionIds.length > 0) {
      whereClause.dwollaId = { in: transactionIds }
    }

    if (olderThanDays > 0) {
      whereClause.created = {
        lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000),
      }
    }

    // Fetch transactions to refresh
    logger.info("Fetching transactions to refresh statuses", {
      userId: session.user.id,
      filter: whereClause,
      limit,
    })

    const toRefresh = await prisma.aCHTransaction.findMany({
      where: whereClause,
      select: { id: true, dwollaId: true, status: true, created: true },
      orderBy: { created: "desc" }, // Process newer transactions first
      take: limit,
    })

    logger.info(`Found ${toRefresh.length} transactions to check`, {
      userId: session.user.id,
      transactionCount: toRefresh.length,
    })

    if (toRefresh.length === 0) {
      return NextResponse.json({
        message: "No transactions found matching criteria",
        results: {
          checked: 0,
          updated: 0,
          errors: [],
        },
      })
    }

    let checked = 0
    let updated = 0
    const errors: string[] = []
    const updatedByStatus: Record<string, number> = {}

    // Process transactions with concurrency control
    const queue = [...toRefresh]
    const workers = Math.min(concurrency, 10) // Cap at 10 concurrent workers

    async function worker(workerId: number): Promise<void> {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break

        try {
          logger.debug(`Worker ${workerId} checking transaction ${item.dwollaId}`)
          
          // Fetch latest status from Dwolla
          const transfer = await client.getTransfer(item.dwollaId)
          const newStatus = normalizeStatus(transfer.status)

          // Only update if status actually changed
          if (newStatus !== item.status) {
            await prisma.aCHTransaction.update({
              where: { dwollaId: item.dwollaId },
              data: {
                status: newStatus,
                lastUpdated: new Date(),
                processedAt: newStatus === "processed" ? new Date(transfer.created) : null,
              },
            })
            updated++
            updatedByStatus[newStatus] = (updatedByStatus[newStatus] || 0) + 1
            
            logger.info(`Updated transaction ${item.dwollaId}: ${item.status} → ${newStatus}`, {
              dwollaId: item.dwollaId,
              oldStatus: item.status,
              newStatus,
            })
          }
        } catch (error) {
          if (error instanceof DwollaAPIError && error.status === 404) {
            logger.warn(`Dwolla transfer not found (dwollaId=${item.dwollaId}). Skipping.`)
          } else {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            errors.push(`Error refreshing ${item.dwollaId}: ${errorMessage}`)
            logger.error(`Error refreshing transaction ${item.dwollaId}`, error as Error)
          }
        } finally {
          checked++
          if (checked % 50 === 0) {
            logger.info(`Progress: ${checked}/${toRefresh.length} checked, ${updated} updated`)
          }
        }
      }
    }

    // Run workers in parallel
    await Promise.all(Array.from({ length: workers }, (_, i) => worker(i + 1)))

    const results = {
      checked,
      updated,
      updatedByStatus,
      errors,
      processedAt: new Date().toISOString(),
    }

    logger.info("Transaction status refresh completed", {
      userId: session.user.id,
      results,
    })

    return NextResponse.json({
      message: "Transaction status refresh completed",
      results,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return NextResponse.json(error.toClientResponse(), { status: error.statusCode })
    }

    logger.error("Error refreshing transaction statuses", error as Error)
    return NextResponse.json(
      {
        error: "Failed to refresh transaction statuses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
