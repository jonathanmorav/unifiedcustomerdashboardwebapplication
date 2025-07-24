import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getReturnCodeInfo, getCategoryDisplayName } from "@/lib/api/dwolla/return-codes"
import { requireAuth } from "@/lib/auth/api"
import { rateLimiter, rateLimitConfigs } from "@/lib/security/rate-limit"
import { log } from "@/lib/logger"

/**
 * GET /api/ach/analytics/failures
 * Get ACH failure analytics
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await rateLimiter.limit(request, {
      ...rateLimitConfigs.api,
      name: "analytics"
    })
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      )
    }

    // Check authentication - commented out for now to test
    // TODO: Re-enable authentication after testing
    // const authCheck = await requireAuth(request)
    // if (!authCheck.authenticated) {
    //   return NextResponse.json(
    //     { error: "Unauthorized" },
    //     { status: 401 }
    //   )
    // }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const groupBy = searchParams.get("groupBy") || "returnCode" // returnCode, category, time
    
    // Build date filter
    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) })
      }
    }
    
    // Get failure statistics grouped by return code
    const failureStats = await prisma.aCHTransaction.groupBy({
      by: ["returnCode", "status"],
      where: {
        status: { in: ["failed", "returned", "cancelled"] },
        ...dateFilter
      },
      _count: {
        _all: true
      },
      _sum: {
        amount: true,
        fees: true
      }
    })
    
    // Get total transaction counts for failure rate calculation
    const [totalTransactions, failedTransactions] = await Promise.all([
      prisma.aCHTransaction.count({
        where: { ...dateFilter }
      }),
      prisma.aCHTransaction.count({
        where: {
          status: { in: ["failed", "returned", "cancelled"] },
          ...dateFilter
        }
      })
    ])
    
    // Get successful transaction value for comparison
    const successfulValue = await prisma.aCHTransaction.aggregate({
      where: {
        status: { in: ["completed", "processed"] },
        ...dateFilter
      },
      _sum: {
        amount: true
      }
    })
    
    // Get time-based failure trends if requested
    let timeTrends = null
    if (searchParams.get("includeTrends") === "true") {
      timeTrends = await getFailureTrends(dateFilter)
    }
    
    // Process and enrich the statistics
    const enrichedStats = failureStats
      .filter(stat => stat.returnCode) // Only include entries with return codes
      .map(stat => {
        const returnCodeInfo = stat.returnCode ? getReturnCodeInfo(stat.returnCode) : null
        return {
          returnCode: stat.returnCode,
          status: stat.status,
          count: stat._count._all,
          totalAmount: stat._sum.amount ? Number(stat._sum.amount) : 0,
          totalFees: stat._sum.fees ? Number(stat._sum.fees) : 0,
          returnCodeInfo: returnCodeInfo ? {
            title: returnCodeInfo.title,
            description: returnCodeInfo.description,
            category: returnCodeInfo.category,
            categoryDisplay: getCategoryDisplayName(returnCodeInfo.category),
            retryable: returnCodeInfo.retryable,
            userAction: returnCodeInfo.userAction
          } : null
        }
      })
      .sort((a, b) => b.count - a.count) // Sort by count descending
    
    // Group by category if requested
    let categoryBreakdown = null
    if (groupBy === "category") {
      categoryBreakdown = enrichedStats.reduce((acc, stat) => {
        const category = stat.returnCodeInfo?.category || "other"
        if (!acc[category]) {
          acc[category] = {
            category,
            displayName: stat.returnCodeInfo?.categoryDisplay || getCategoryDisplayName(category),
            count: 0,
            totalAmount: 0,
            codes: []
          }
        }
        acc[category].count += stat.count
        acc[category].totalAmount += stat.totalAmount
        acc[category].codes.push({
          code: stat.returnCode,
          count: stat.count
        })
        return acc
      }, {} as Record<string, any>)
      
      categoryBreakdown = Object.values(categoryBreakdown)
        .sort((a: any, b: any) => b.count - a.count)
    }
    
    // Calculate key metrics
    const failureRate = totalTransactions > 0 
      ? ((failedTransactions / totalTransactions) * 100).toFixed(2)
      : "0.00"
      
    const totalFailedAmount = enrichedStats.reduce((sum, stat) => sum + stat.totalAmount, 0)
    const totalSuccessfulAmount = successfulValue._sum.amount ? Number(successfulValue._sum.amount) : 0
    
    // Get top retryable failures
    const retryableFailures = enrichedStats
      .filter(stat => stat.returnCodeInfo?.retryable)
      .slice(0, 5)
    
    // Get top non-retryable failures  
    const nonRetryableFailures = enrichedStats
      .filter(stat => !stat.returnCodeInfo?.retryable)
      .slice(0, 5)
    
    const response = {
      summary: {
        totalTransactions,
        failedTransactions,
        failureRate: parseFloat(failureRate),
        totalFailedAmount,
        totalSuccessfulAmount,
        dateRange: {
          start: startDate || "all-time",
          end: endDate || "current"
        }
      },
      topFailures: enrichedStats.slice(0, 10),
      retryableFailures,
      nonRetryableFailures,
      categoryBreakdown,
      timeTrends,
      metadata: {
        generatedAt: new Date().toISOString(),
        groupBy
      }
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error("Failed to fetch failure analytics:", error)
    log.error("Failed to fetch failure analytics", { error })
    
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { 
        error: "Failed to fetch analytics",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? (error as Error).stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Get failure trends over time
 */
async function getFailureTrends(dateFilter: any) {
  // Get daily failure counts for the date range
  const failures = await prisma.aCHTransaction.findMany({
    where: {
      status: { in: ["failed", "returned", "cancelled"] },
      ...dateFilter
    },
    select: {
      createdAt: true,
      returnCode: true,
      amount: true
    },
    orderBy: {
      createdAt: "asc"
    }
  })
  
  // Group by day
  const dailyTrends = failures.reduce((acc, failure) => {
    const date = failure.createdAt.toISOString().split('T')[0]
    if (!acc[date]) {
      acc[date] = {
        date,
        count: 0,
        amount: 0,
        returnCodes: {}
      }
    }
    
    acc[date].count++
    acc[date].amount += Number(failure.amount)
    
    if (failure.returnCode) {
      acc[date].returnCodes[failure.returnCode] = 
        (acc[date].returnCodes[failure.returnCode] || 0) + 1
    }
    
    return acc
  }, {} as Record<string, any>)
  
  return Object.values(dailyTrends)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
}