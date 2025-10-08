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
  // Lightweight debug signal without PII
  log.debug("Search API called")
  const correlationId = await CorrelationTracking.getCorrelationId()

  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    throw new AuthenticationError("Authentication required", correlationId ? { correlationId } : undefined)
  }

  // Parse and validate request body
  const body = await request.json()
  const validation = searchRequestSchema.safeParse(body)

  if (!validation.success) {
    throw new ValidationError("Invalid search request", validation.error.flatten().fieldErrors, {
      correlationId: correlationId || undefined,
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
    const masked = searchTerm.substring(0, 3) + "***"
    log.debug("Search request", { type: searchType, demoMode: isDemoMode, termMasked: masked })

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
      log.debug("Search completed; formatting for display")
      try {
        displayResult = searchEngine.formatForDisplay(result)
        log.debug("Display formatting completed")
      } catch (error) {
        log.error("Error in formatForDisplay", error as Error)
        throw error
      }
    }

    // Save to search history (non-blocking)
    SearchHistoryManager.saveSearch(result, session.user.email).catch((err) => {
      log.error("Failed to save search history", err instanceof Error ? err : new Error("Unknown error"), {
        userId: session.user.email,
        searchTerm,
        correlationId: correlationId || undefined,
        operation: "search_history_save",
      })
    })

    return NextResponse.json({
      success: true,
      data: displayResult,
      searchId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId: correlationId || undefined,
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
    throw new AuthenticationError("Authentication required", correlationId ? { correlationId } : undefined)
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
      { correlationId: correlationId || undefined, userId: session.user.email }
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
    correlationId: correlationId || undefined,
  })
})
