import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { ApplicationError } from "@/lib/errors"
import { DwollaClient } from "@/lib/api/dwolla/client"
import { ACHTransactionSync } from "@/lib/api/dwolla/ach-sync"
import { createEndpointRateLimiter } from "@/lib/security/middleware/rate-limit-middleware"

// Rate limiter for sync endpoint
const syncRateLimiter = createEndpointRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 syncs per minute
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await syncRateLimiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow admin users to sync
    // TODO: Add proper role checking once implemented
    // if (session.user.role !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Forbidden - Admin access required' },
    //     { status: 403 }
    //   );
    // }

    // Parse request body
    const body = await request.json()
    const { limit = 100, startDate, endDate, customerId, syncAll = false } = body

    // Validate dates and options
    const syncOptions: any = { }
    
    // If syncAll is true, don't set a limit to fetch all transactions
    if (!syncAll) {
      syncOptions.limit = limit
    }

    if (startDate) {
      syncOptions.startDate = new Date(startDate)
      if (isNaN(syncOptions.startDate.getTime())) {
        return NextResponse.json({ error: "Invalid startDate format" }, { status: 400 })
      }
    }

    if (endDate) {
      syncOptions.endDate = new Date(endDate)
      if (isNaN(syncOptions.endDate.getTime())) {
        return NextResponse.json({ error: "Invalid endDate format" }, { status: 400 })
      }
    }

    if (customerId) {
      syncOptions.customerId = customerId
    }

    // Create Dwolla client and sync service
    const dwollaClient = new DwollaClient()
    const syncService = new ACHTransactionSync(dwollaClient)

    // Log sync start
    logger.info("Starting ACH transaction sync", {
      userId: session.user.id,
      syncOptions,
    })

    // Perform sync
    const results = await syncService.syncTransactions(syncOptions)

    // Log sync completion
    logger.info("ACH transaction sync completed", {
      userId: session.user.id,
      results,
    })

    return NextResponse.json({
      message: "Sync completed successfully",
      results,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return NextResponse.json(error.toClientResponse(), { status: error.statusCode })
    }

    logger.error("Error syncing ACH transactions", { error })
    return NextResponse.json({ error: "Failed to sync transactions" }, { status: 500 })
  }
}
