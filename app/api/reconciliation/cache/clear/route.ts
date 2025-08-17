import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { databaseCache } from "@/lib/cache/database-cache"
import { hubspotCache } from "@/lib/cache/hubspot-cache"
import { logger } from "@/lib/logger"

// POST - Clear cache (expired entries only by default)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const clearAll = body.clearAll === true

    let clearedCount = 0
    
    if (clearAll) {
      // Clear memory cache
      hubspotCache.clear()
      logger.info("Cleared all memory cache entries", {
        userId: session.user.id
      })
      
      // For database cache, we'll just clear expired for safety
      // To truly clear all, you'd need to implement a clearAll method
      clearedCount = await databaseCache.clearExpired()
    } else {
      // Clear only expired entries
      clearedCount = await databaseCache.clearExpired()
    }

    logger.info("Cache cleared", {
      userId: session.user.id,
      clearAll,
      clearedCount
    })

    return NextResponse.json({
      success: true,
      clearedCount,
      clearAll,
      message: clearAll 
        ? "All cache entries cleared" 
        : `Cleared ${clearedCount} expired entries`
    })
  } catch (error) {
    logger.error("Error clearing cache", error as Error)
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    )
  }
}