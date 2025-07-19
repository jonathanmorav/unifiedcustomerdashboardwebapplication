import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SearchHistoryManager } from "@/lib/search/search-history"
import { log } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const limit = parseInt(searchParams.get("limit") || "5")

    // Validate parameters
    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Get suggestions from search history
    const suggestions = SearchHistoryManager.getSuggestions(query, session.user.email, limit)

    return NextResponse.json({
      success: true,
      data: suggestions,
    })
  } catch (error) {
    log.error("Search suggestions API error", error as Error, {
      userId: session?.user?.email,
      query,
      operation: 'search_suggestions'
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
