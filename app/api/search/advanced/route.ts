import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAdvancedSearchEngine } from "@/lib/search/advanced-search"
import { SearchHistoryManager } from "@/lib/search/search-history"
import { z } from "zod"
import type { AdvancedSearchParams } from "@/lib/types/search"
import { log } from "@/lib/logger"

// Request validation schema for advanced search
const advancedSearchSchema = z.object({
  searchTerm: z.string().min(1).max(200),
  searchType: z.enum(["email", "name", "business_name", "dwolla_id", "auto"]).optional(),
  filters: z
    .object({
      customerStatus: z
        .array(z.enum(["active", "inactive", "verified", "unverified", "suspended"]))
        .optional(),
      transferStatus: z
        .array(z.enum(["completed", "pending", "failed", "cancelled", "processed"]))
        .optional(),
      fundingSourceStatus: z.array(z.enum(["verified", "unverified"])).optional(),
      createdDateRange: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
      modifiedDateRange: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
      transferDateRange: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
      transferAmountRange: z
        .object({
          min: z.number(),
          max: z.number(),
          currency: z.string().optional(),
        })
        .optional(),
      benefitAmountRange: z
        .object({
          min: z.number(),
          max: z.number(),
          currency: z.string().optional(),
        })
        .optional(),
      hasFailedTransfers: z.boolean().optional(),
      hasUnverifiedFunding: z.boolean().optional(),
      hasPendingInvoices: z.boolean().optional(),
      searchIn: z.enum(["hubspot", "dwolla", "both"]).optional(),
    })
    .optional(),
  sort: z
    .object({
      field: z.enum([
        "relevance",
        "date_created",
        "date_modified",
        "amount",
        "customer_name",
        "company_name",
        "status",
      ]),
      order: z.enum(["asc", "desc"]),
    })
    .optional(),
  pagination: z
    .object({
      page: z.number().min(1),
      pageSize: z.number().min(1).max(100),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  let session: any
  try {
    // Check authentication
    session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = advancedSearchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const searchParams: AdvancedSearchParams = {
      ...validation.data,
      searchType: validation.data.searchType || "auto",
      pagination: validation.data.pagination || { page: 1, pageSize: 20 },
    }

    // Create abort controller for request cancellation
    const controller = new AbortController()

    // Set timeout for search (30 seconds)
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      // Check for demo mode
      const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.HUBSPOT_API_KEY

      let result

      if (isDemoMode) {
        // Use mock data for demo
        const { mockSearchResult } = await import("@/lib/search/mock-data")
        result = {
          ...mockSearchResult,
          searchTerm: searchParams.searchTerm,
          searchType: searchParams.searchType!,
          timestamp: new Date(),
          appliedFilters: searchParams.filters,
          pagination: searchParams.pagination
            ? {
                currentPage: searchParams.pagination.page,
                pageSize: searchParams.pagination.pageSize,
                totalResults: 42,
                totalPages: Math.ceil(42 / searchParams.pagination.pageSize),
              }
            : undefined,
        }
      } else {
        // Execute real advanced search
        const searchEngine = getAdvancedSearchEngine()
        searchParams.signal = controller.signal
        result = await searchEngine.advancedSearch(searchParams)
      }

      // Save to search history (non-blocking)
      const historyEntry = {
        searchTerm: result.searchTerm,
        searchType: result.searchType,
        timestamp: result.timestamp,
        duration: result.duration,
        hubspot: {
          success: result.hubspot.success,
          error: result.hubspot.error,
          duration: result.hubspot.duration,
        },
        dwolla: {
          success: result.dwolla.success,
          error: result.dwolla.error,
          duration: result.dwolla.duration,
        },
      }

      SearchHistoryManager.saveSearch(historyEntry as any, session.user.email).catch((err) => {
        log.error("Failed to save search history", err as Error, {
          userId: session.user.email,
          searchTerm: result.searchTerm,
          operation: "advanced_search_history",
        })
      })

      return NextResponse.json({
        success: true,
        data: result,
        searchId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    log.error("Advanced search API error", error as Error, {
      userId: session?.user?.email,
      operation: "advanced_search",
    })

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Search timeout" }, { status: 408 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint for available filter options
export async function GET(request: NextRequest) {
  let session: any
  try {
    // Check authentication
    session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Return available filter options
    // In a real implementation, these would be fetched from the database
    const filterOptions = {
      customerStatus: [
        { value: "active", label: "Active", count: 150 },
        { value: "inactive", label: "Inactive", count: 45 },
        { value: "verified", label: "Verified", count: 120 },
        { value: "unverified", label: "Unverified", count: 30 },
        { value: "suspended", label: "Suspended", count: 5 },
      ],
      transferStatus: [
        { value: "completed", label: "Completed", count: 500 },
        { value: "pending", label: "Pending", count: 25 },
        { value: "failed", label: "Failed", count: 10 },
        { value: "cancelled", label: "Cancelled", count: 5 },
        { value: "processed", label: "Processed", count: 100 },
      ],
      fundingSourceStatus: [
        { value: "verified", label: "Verified", count: 180 },
        { value: "unverified", label: "Unverified", count: 20 },
      ],
      dateRanges: [
        {
          label: "Today",
          value: { start: new Date().toISOString(), end: new Date().toISOString() },
        },
        {
          label: "Last 7 days",
          value: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        },
        {
          label: "Last 30 days",
          value: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        },
      ],
    }

    return NextResponse.json({
      success: true,
      data: filterOptions,
    })
  } catch (error) {
    log.error("Filter options API error", error as Error, {
      userId: session?.user?.email,
      operation: "advanced_search_filters",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
