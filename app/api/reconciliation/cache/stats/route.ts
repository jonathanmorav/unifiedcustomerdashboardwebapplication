import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { databaseCache } from "@/lib/cache/database-cache"
import { logger } from "@/lib/logger"

// GET - Get cache statistics
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const stats = await databaseCache.getStats()
    
    if (!stats) {
      return NextResponse.json({ 
        error: "Failed to get cache statistics" 
      }, { status: 500 })
    }

    logger.info("Cache statistics retrieved", {
      userId: session.user.id,
      stats
    })

    return NextResponse.json(stats)
  } catch (error) {
    logger.error("Error getting cache stats", error as Error)
    return NextResponse.json(
      { error: "Failed to get cache statistics" },
      { status: 500 }
    )
  }
}