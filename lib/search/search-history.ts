import { UnifiedSearchResult } from "./unified-search"

export interface SearchHistoryEntry {
  id: string
  searchTerm: string
  searchType: string
  timestamp: Date
  duration: number
  foundInHubspot: boolean
  foundInDwolla: boolean
  userId: string
}

export interface SearchHistoryFilter {
  userId?: string
  searchType?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

export class SearchHistoryManager {
  private static STORAGE_KEY = "unified_search_history"
  private static MAX_HISTORY_SIZE = 100

  /**
   * Save search result to history
   */
  static async saveSearch(
    result: UnifiedSearchResult,
    userId: string
  ): Promise<SearchHistoryEntry> {
    const entry: SearchHistoryEntry = {
      id: crypto.randomUUID(),
      searchTerm: result.searchTerm,
      searchType: result.searchType,
      timestamp: result.timestamp,
      duration: result.duration,
      foundInHubspot: result.hubspot.success && !!result.hubspot.data,
      foundInDwolla: result.dwolla.success && !!result.dwolla.data,
      userId,
    }

    // In a real application, this would save to a database
    // For now, we'll use localStorage as a placeholder
    if (typeof window !== "undefined") {
      try {
        const history = this.getHistory()
        history.unshift(entry)

        // Limit history size
        if (history.length > this.MAX_HISTORY_SIZE) {
          history.splice(this.MAX_HISTORY_SIZE)
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history))
      } catch (error) {
        console.error("Failed to save search history:", error)
      }
    }

    return entry
  }

  /**
   * Get search history with optional filters
   */
  static getHistory(filter?: SearchHistoryFilter): SearchHistoryEntry[] {
    if (typeof window === "undefined") {
      return []
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      let history: SearchHistoryEntry[] = JSON.parse(stored)

      // Convert stored dates back to Date objects
      history = history.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }))

      // Apply filters
      if (filter) {
        if (filter.userId) {
          history = history.filter((entry) => entry.userId === filter.userId)
        }

        if (filter.searchType) {
          history = history.filter((entry) => entry.searchType === filter.searchType)
        }

        if (filter.startDate) {
          history = history.filter((entry) => entry.timestamp >= filter.startDate!)
        }

        if (filter.endDate) {
          history = history.filter((entry) => entry.timestamp <= filter.endDate!)
        }

        if (filter.limit) {
          history = history.slice(0, filter.limit)
        }
      }

      return history
    } catch (error) {
      console.error("Failed to load search history:", error)
      return []
    }
  }

  /**
   * Get recent successful searches
   */
  static getRecentSuccessful(userId: string, limit = 10): SearchHistoryEntry[] {
    return this.getHistory({
      userId,
      limit,
    }).filter((entry) => entry.foundInHubspot || entry.foundInDwolla)
  }

  /**
   * Get search suggestions based on partial input
   */
  static getSuggestions(partial: string, userId: string, limit = 5): string[] {
    const lowerPartial = partial.toLowerCase()
    const history = this.getHistory({ userId })

    const suggestions = new Set<string>()

    for (const entry of history) {
      if (entry.searchTerm.toLowerCase().includes(lowerPartial)) {
        suggestions.add(entry.searchTerm)
        if (suggestions.size >= limit) break
      }
    }

    return Array.from(suggestions)
  }

  /**
   * Clear search history for a user
   */
  static clearHistory(userId?: string): void {
    if (typeof window === "undefined") return

    try {
      if (!userId) {
        // Clear all history
        localStorage.removeItem(this.STORAGE_KEY)
      } else {
        // Clear only specific user's history
        const history = this.getHistory()
        const filtered = history.filter((entry) => entry.userId !== userId)
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))
      }
    } catch (error) {
      console.error("Failed to clear search history:", error)
    }
  }

  /**
   * Export search history as CSV
   */
  static exportAsCSV(filter?: SearchHistoryFilter): string {
    const history = this.getHistory(filter)

    const headers = [
      "Timestamp",
      "Search Term",
      "Search Type",
      "Duration (ms)",
      "Found in HubSpot",
      "Found in Dwolla",
    ]

    const rows = history.map((entry) => [
      entry.timestamp.toISOString(),
      `"${entry.searchTerm.replace(/"/g, '""')}"`,
      entry.searchType,
      entry.duration.toString(),
      entry.foundInHubspot ? "Yes" : "No",
      entry.foundInDwolla ? "Yes" : "No",
    ])

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }
}
