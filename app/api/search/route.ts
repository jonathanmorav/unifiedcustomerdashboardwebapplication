import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUnifiedSearchEngine } from "@/lib/search/unified-search"
import { SearchHistoryManager } from "@/lib/search/search-history"
import { z } from "zod"

// Request validation schema
const searchRequestSchema = z.object({
  searchTerm: z.string().min(1).max(200),
  searchType: z.enum(["email", "name", "business_name", "dwolla_id", "auto"]).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = searchRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { searchTerm, searchType = "auto" } = validation.data

    // Create abort controller for request cancellation
    const controller = new AbortController()

    // Set timeout for search (30 seconds)
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      // Check for demo mode
      const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.HUBSPOT_ACCESS_TOKEN

      let result
      let displayResult
      
      if (isDemoMode) {
        // Use mock data for demo
        const { mockSearchResult } = await import("@/lib/search/mock-data")
        result = {
          ...mockSearchResult,
          searchTerm,
          searchType,
          timestamp: new Date(),
        }
        const searchEngine = getUnifiedSearchEngine()
        displayResult = searchEngine.formatForDisplay(result)
      } else {
        // Execute real unified search
        const searchEngine = getUnifiedSearchEngine()
        result = await searchEngine.search({
          searchTerm,
          searchType,
          signal: controller.signal,
        })
        displayResult = searchEngine.formatForDisplay(result)
      }

      // Save to search history (non-blocking)
      SearchHistoryManager.saveSearch(result, session.user.email).catch((err) => {
        console.error("Failed to save search history:", err)
      })

      return NextResponse.json({
        success: true,
        data: displayResult,
        searchId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error("Search API error:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Search timeout" }, { status: 408 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint for search history
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")
    const searchType = searchParams.get("searchType") || undefined

    // Get search history
    const history = SearchHistoryManager.getHistory({
      userId: session.user.email,
      searchType,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error("Search history API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
