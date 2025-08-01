import { HubSpotService } from "@/lib/api/hubspot/service"
import { DwollaService, DwollaFormatter } from "@/lib/api/dwolla/service"
import type { HubSpotCustomerData } from "@/lib/types/hubspot"
import type { DwollaCustomerData } from "@/lib/types/dwolla"
import type { Logger } from "@/lib/api/dwolla/service"

// Search types
export type SearchType = "email" | "name" | "business_name" | "dwolla_id" | "auto"

// Unified search parameters
export interface UnifiedSearchParams {
  searchTerm: string
  searchType?: SearchType
  signal?: AbortSignal
}

// Search results
export interface UnifiedSearchResult {
  searchTerm: string
  searchType: SearchType
  timestamp: Date
  duration: number
  hubspot: {
    success: boolean
    data?: HubSpotCustomerData
    error?: string
    duration: number
  }
  dwolla: {
    success: boolean
    data?: DwollaCustomerData
    error?: string
    duration: number
  }

}

// Search type detection patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DWOLLA_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class UnifiedSearchEngine {
  private hubspotService: HubSpotService
  private dwollaService: DwollaService

  constructor(
    private logger: Logger = console,
    hubspotService?: HubSpotService,
    dwollaService?: DwollaService
  ) {
    this.hubspotService = hubspotService || new HubSpotService()
    this.dwollaService = dwollaService || new DwollaService()
  }

  /**
   * Execute unified search across both HubSpot and Dwolla
   */
  async search(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
    const startTime = Date.now()

    // Detect search type if not specified
    const searchType = this.detectSearchType(params.searchTerm, params.searchType)

    this.logger.info("UnifiedSearch: Starting parallel search", {
      searchTerm: params.searchTerm.substring(0, 3) + "***", // Log partial for privacy
      searchType,
    })

    // Execute searches in parallel
    console.log(`[DEBUG] Executing searches with searchType: ${searchType}`)
    const [hubspotResult, dwollaResult] = await Promise.allSettled([
      this.searchHubSpot(params.searchTerm, searchType, params.signal),
      this.searchDwolla(params.searchTerm, searchType, params.signal),
    ])
    
    console.log(`[DEBUG] Search results - HubSpot: ${hubspotResult.status}, Dwolla: ${dwollaResult.status}`)

    const endTime = Date.now()
    const duration = endTime - startTime

    // Format results with error catching
    let hubspotFormatted, dwollaFormatted
    try {
      console.log(`[DEBUG] Formatting HubSpot result...`)
      hubspotFormatted = this.formatHubSpotResult(hubspotResult)
      console.log(`[DEBUG] HubSpot formatted successfully`)
    } catch (error) {
      console.error(`[DEBUG] Error formatting HubSpot result:`, error)
      throw error
    }
    
    try {
      console.log(`[DEBUG] Formatting Dwolla result...`)
      dwollaFormatted = this.formatDwollaResult(dwollaResult)
      console.log(`[DEBUG] Dwolla formatted successfully`)
    } catch (error) {
      console.error(`[DEBUG] Error formatting Dwolla result:`, error)
      throw error
    }

    const result: UnifiedSearchResult = {
      searchTerm: params.searchTerm,
      searchType,
      timestamp: new Date(),
      duration,
      hubspot: hubspotFormatted,
      dwolla: dwollaFormatted,
    }

    this.logger.info("UnifiedSearch: Search completed", {
      duration,
      hubspotSuccess: result.hubspot.success,
      dwollaSuccess: result.dwolla.success,
    })

    return result
  }

  /**
   * Search for customers by Dwolla ID (searches both systems)
   */
  async searchByDwollaId(dwollaId: string, signal?: AbortSignal): Promise<UnifiedSearchResult> {
    return this.search({
      searchTerm: dwollaId,
      searchType: "dwolla_id",
      signal,
    })
  }

  /**
   * Get formatted results for display
   */
  formatForDisplay(result: UnifiedSearchResult): {
    summary: {
      found: boolean
      foundIn: ("hubspot" | "dwolla" | "both")[]
      searchType: string
      duration: string
    }
    hubspot?: {
      company: any // eslint-disable-line @typescript-eslint/no-explicit-any
      summaryOfBenefits: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      monthlyInvoices: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      activeLists: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      error?: string
    }
    dwolla?: {
      customer: any // eslint-disable-line @typescript-eslint/no-explicit-any
      fundingSources: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      transfers: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      notificationCount: number
      notifications: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
      error?: string
    }
  } {
    const foundIn: ("hubspot" | "dwolla" | "both")[] = []
    if (result.hubspot.success && result.hubspot.data) foundIn.push("hubspot")
    if (result.dwolla.success && result.dwolla.data) foundIn.push("dwolla")

    const display: any = {
      summary: {
        found: foundIn.length > 0,
        foundIn: foundIn.length === 2 ? ["both"] : foundIn,
        searchType: result.searchType,
        duration: `${result.duration}ms`,
      },
    }

    // Add HubSpot data if available
    if (result.hubspot.success && result.hubspot.data) {
      const formatted = this.hubspotService.formatCustomerData(result.hubspot.data)

      // Debug logging
      console.log("UnifiedSearch formatForDisplay - Raw HubSpot data:", result.hubspot.data)
      console.log("UnifiedSearch formatForDisplay - Formatted company:", formatted.company)
      console.log(
        "UnifiedSearch formatForDisplay - onboardingStatus:",
        formatted.company.onboardingStatus
      )
      console.log(
        "UnifiedSearch formatForDisplay - onboardingStep:",
        formatted.company.onboardingStep
      )

      display.hubspot = {
        company: formatted.company,
        summaryOfBenefits: formatted.summaryOfBenefits,
        monthlyInvoices: formatted.monthlyInvoices,
        activeLists: formatted.activeLists,
        data: result.hubspot.data, // Include raw data
      }
    } else if (result.hubspot.error) {
      display.hubspot = { error: result.hubspot.error }
    }

    // Add Dwolla data if available
    if (result.dwolla.success && result.dwolla.data) {
      console.log(`[DEBUG] About to format Dwolla data...`)
      try {
        const formatted = DwollaFormatter.format(result.dwolla.data)
        console.log(`[DEBUG] Dwolla data formatted successfully`)
        display.dwolla = {
          customer: formatted.customer,
          fundingSources: formatted.fundingSources,
          transfers: formatted.transfers,
          notificationCount: formatted.notificationCount,
          notifications: formatted.notifications, // ✅ Added missing notifications array
        }
      } catch (error) {
        console.error(`[DEBUG] Error in DwollaFormatter.format:`, error)
        console.error(`[DEBUG] Dwolla data that caused error:`, JSON.stringify(result.dwolla.data, null, 2))
        throw error
      }
    } else if (result.dwolla.error) {
      display.dwolla = { error: result.dwolla.error }
    }

    return display
  }

  /**
   * Detect search type from search term
   */
  private detectSearchType(searchTerm: string, providedType?: SearchType): SearchType {
    if (providedType && providedType !== "auto") {
      return providedType
    }

    const trimmed = searchTerm.trim()

    // Check for email
    if (EMAIL_REGEX.test(trimmed)) {
      return "email"
    }

    // Check for Dwolla ID (UUID format)
    if (DWOLLA_ID_REGEX.test(trimmed)) {
      return "dwolla_id"
    }

    // Check if it looks like a business name (contains common business suffixes)
    const businessSuffixes =
      /\b(inc|llc|corp|corporation|company|co|ltd|limited|group|partners|enterprise)\b/i
    if (businessSuffixes.test(trimmed)) {
      return "business_name"
    }

    // Default to name search
    return "name"
  }

  /**
   * Search HubSpot
   */
  private async searchHubSpot(
    searchTerm: string,
    searchType: SearchType,
    signal?: AbortSignal
  ): Promise<{ data?: HubSpotCustomerData; duration: number }> {
    const startTime = Date.now()

    try {
      // HubSpot doesn't have AbortSignal support yet, but we can check if aborted
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError")
      }

      const effectiveSearchType = searchType === "auto" ? "name" : searchType
      console.log(`[DEBUG] HubSpot search: term="${searchTerm}", type="${effectiveSearchType}"`)
      
      const data = await this.hubspotService.searchCustomer({
        searchTerm,
        searchType: effectiveSearchType,
      })

      console.log(`[DEBUG] HubSpot result: ${data ? 'found data' : 'no data'}`)
      return {
        data: data || undefined,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * Search Dwolla
   */
  private async searchDwolla(
    searchTerm: string,
    searchType: SearchType,
    signal?: AbortSignal
  ): Promise<{ data?: DwollaCustomerData; duration: number }> {
    const startTime = Date.now()

    // Map search type for Dwolla (Dwolla doesn't have business_name)
    let dwollaSearchType: "email" | "name" | "dwolla_id" = "name"
    if (searchType === "email") {
      dwollaSearchType = "email"
    } else if (searchType === "dwolla_id") {
      dwollaSearchType = "dwolla_id"
    } else {
      dwollaSearchType = "name"
    }

    console.log(`[DEBUG] Dwolla search: term="${searchTerm}", type="${dwollaSearchType}"`)
    
    const data = await this.dwollaService.searchCustomer({
      searchTerm,
      searchType: dwollaSearchType,
      signal,
    })

    console.log(`[DEBUG] Dwolla result: ${data ? 'found data' : 'no data'}`)
    return {
      data: data || undefined,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    console.error(`[DEBUG] Dwolla search error:`, error)
    throw error
  }

  /**
   * Format HubSpot search result from Promise.allSettled
   */
  private formatHubSpotResult(
    result: PromiseSettledResult<{ data?: HubSpotCustomerData; duration: number }>
  ): UnifiedSearchResult["hubspot"] {
    if (result.status === "fulfilled") {
      return {
        success: true,
        data: result.value.data,
        duration: result.value.duration,
      }
    } else {
      // Handle different error types
      const error = result.reason
      let errorMessage = "Unknown error"

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "Search cancelled"
        } else {
          errorMessage = error.message
        }
      } else if (typeof error === "string") {
        errorMessage = error
      }

      this.logger.error(`UnifiedSearch: HubSpot search failed`, {
        error: errorMessage,
      })

      return {
        success: false,
        error: errorMessage,
        duration: 0,
      }
    }
  }

  /**
   * Format Dwolla search result from Promise.allSettled
   */
  private formatDwollaResult(
    result: PromiseSettledResult<{ data?: DwollaCustomerData; duration: number }>
  ): UnifiedSearchResult["dwolla"] {
    if (result.status === "fulfilled") {
      return {
        success: true,
        data: result.value.data,
        duration: result.value.duration,
      }
    } else {
      // Handle different error types
      const error = result.reason
      let errorMessage = "Unknown error"

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "Search cancelled"
        } else {
          errorMessage = error.message
        }
      } else if (typeof error === "string") {
        errorMessage = error
      }

      this.logger.error(`UnifiedSearch: Dwolla search failed`, {
        error: errorMessage,
      })

      return {
        success: false,
        error: errorMessage,
        duration: 0,
      }
    }
  }
}

/**
 * Create a singleton instance
 */
let searchEngineInstance: UnifiedSearchEngine | null = null

export function getUnifiedSearchEngine(logger?: Logger): UnifiedSearchEngine {
  if (!searchEngineInstance) {
    searchEngineInstance = new UnifiedSearchEngine(logger)
  }
  return searchEngineInstance
}
