import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUnifiedSearchEngine } from "@/lib/search/unified-search"
import { SearchHistoryManager } from "@/lib/search/search-history"
import { z } from "zod"
import { log } from "@/lib/logger"
import { withErrorHandler } from "@/lib/middleware/error-handler"
import { AuthenticationError, ValidationError, SystemError } from "@/lib/errors"
import { CorrelationTracking } from "@/lib/security/correlation"

// Request validation schema
const searchRequestSchema = z.object({
  searchTerm: z.string().min(1).max(200),
  searchType: z.enum(["email", "name", "business_name", "dwolla_id", "auto"]).optional(),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  console.log("[CLARITY DEBUG] Search API called")
  const correlationId = await CorrelationTracking.getCorrelationId()

  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    throw new AuthenticationError("Authentication required", { correlationId })
  }

  // Parse and validate request body
  const body = await request.json()
  const validation = searchRequestSchema.safeParse(body)

  if (!validation.success) {
    throw new ValidationError("Invalid search request", validation.error.flatten().fieldErrors, {
      correlationId,
      userId: session.user.email,
    })
  }

  const { searchTerm, searchType = "auto" } = validation.data

  // Create abort controller for request cancellation
  const controller = new AbortController()

  // Set timeout for search (30 seconds)
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    // Check for demo mode
    const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.HUBSPOT_API_KEY

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
      log.error("Failed to save search history", {
        error: err instanceof Error ? err.message : "Unknown error",
        userId: session.user.email,
        searchTerm,
        correlationId,
        operation: "search_history_save",
      })
    })

    return NextResponse.json({
      success: true,
      data: displayResult,
      searchId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId,
    })
  } finally {
    clearTimeout(timeoutId)
  }
})

// GET endpoint for search history
export const GET = withErrorHandler(async (request: NextRequest) => {
  const correlationId = await CorrelationTracking.getCorrelationId()

  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    throw new AuthenticationError("Authentication required", { correlationId })
  }

  // Get query parameters
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "20")
  const searchType = searchParams.get("searchType") || undefined

  // Validate limit
  if (limit < 1 || limit > 100) {
    throw new ValidationError(
      "Invalid limit parameter",
      { limit: ["Limit must be between 1 and 100"] },
      { correlationId, userId: session.user.email }
    )
  }

  // Get search history
  const history = SearchHistoryManager.getHistory({
    userId: session.user.email,
    searchType,
    limit,
  })

  return NextResponse.json({
    success: true,
    data: history,
    correlationId,
  })
})
