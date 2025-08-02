import { UnifiedSearchResult } from "./unified-search"

export interface SearchHistoryEntry {
  id: string
  searchTerm: string
  searchType: string
  timestamp: Date
  duration: number
  foundInHubspot: boolean
  foundInDwolla: boolean
  totalResults: number
  tags?: string[]
}

export class SearchHistory {
  private static readonly STORAGE_KEY = "search_history"
  private static readonly MAX_ENTRIES = 50

  static getHistory(): SearchHistoryEntry[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const entries = JSON.parse(stored)
      // Convert timestamp strings back to Date objects
      return entries.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }))
    } catch (error) {
      console.error("Failed to load search history:", error)
      return []
    }
  }

  static addEntry(
    searchTerm: string,
    searchType: string,
    results: UnifiedSearchResult,
    duration: number
  ): void {
    try {
      const history = this.getHistory()

      // Calculate total results based on actual data structure
      const hubspotResults = results.hubspot.success && results.hubspot.data ? 1 : 0
      const dwollaResults = results.dwolla.success && results.dwolla.data ? 1 : 0
      const totalResults = hubspotResults + dwollaResults

      const newEntry: SearchHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        searchTerm,
        searchType,
        timestamp: new Date(),
        duration,
        foundInHubspot: results.hubspot.success && results.hubspot.data !== undefined,
        foundInDwolla: results.dwolla.success && results.dwolla.data !== undefined,
        totalResults,
        tags: this.generateTags(results),
      }

      // Add to beginning of array
      history.unshift(newEntry)

      // Keep only the most recent entries
      const trimmedHistory = history.slice(0, this.MAX_ENTRIES)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory))

      // Log search metrics in development
      if (process.env.NODE_ENV === "development") {
        console.debug("Search added to history", {
          searchTerm,
          searchType,
          duration,
          totalResults,
          operation: "search_history_add",
        })
      }
    } catch (error) {
      console.error("Failed to save search history:", error)
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.info("Search history cleared", {
        operation: "search_history_clear",
      })
    } catch (error) {
      console.error("Failed to clear search history:", error)
    }
  }

  static removeEntry(id: string): void {
    try {
      const history = this.getHistory()
      const filtered = history.filter((entry) => entry.id !== id)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error("Failed to remove search history entry:", error)
    }
  }

  static getFrequentSearches(limit: number = 5): string[] {
    const history = this.getHistory()
    const searchCounts = new Map<string, number>()

    history.forEach((entry) => {
      const count = searchCounts.get(entry.searchTerm) || 0
      searchCounts.set(entry.searchTerm, count + 1)
    })

    return Array.from(searchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term)
  }

  static getRecentSearches(limit: number = 10): SearchHistoryEntry[] {
    return this.getHistory().slice(0, limit)
  }

  static getSearchStats() {
    const history = this.getHistory()
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const last24Hours = history.filter((entry) => entry.timestamp > oneDayAgo)
    const lastWeek = history.filter((entry) => entry.timestamp > oneWeekAgo)

    const avgDuration =
      history.reduce((sum, entry) => sum + entry.duration, 0) / history.length || 0

    return {
      totalSearches: history.length,
      searchesLast24Hours: last24Hours.length,
      searchesLastWeek: lastWeek.length,
      averageDuration: Math.round(avgDuration),
      frequentSearches: this.getFrequentSearches(5),
    }
  }

  private static generateTags(results: UnifiedSearchResult): string[] {
    const tags: string[] = []

    // Add HubSpot tags if data exists
    if (results.hubspot.success && results.hubspot.data) {
      tags.push("hubspot:customer")
      // Check for specific data types in HubSpot result
      if (results.hubspot.data.summaryOfBenefits?.length > 0) {
        tags.push("hubspot:benefits")
      }
      if (results.hubspot.data.monthlyInvoices && results.hubspot.data.monthlyInvoices.length > 0) {
        tags.push("hubspot:invoices")
      }

    }

    // Add Dwolla tags if data exists
    if (results.dwolla.success && results.dwolla.data) {
      tags.push("dwolla:customer")
      if (results.dwolla.data.fundingSources?.length > 0) {
        tags.push("dwolla:funding")
      }
      if (results.dwolla.data.transfers?.length > 0) {
        tags.push("dwolla:transfers")
      }
    }

    // Calculate if we have results
    const hasResults = (results.hubspot.success && results.hubspot.data) || 
                      (results.dwolla.success && results.dwolla.data)

    if (!hasResults) {
      tags.push("no-results")
    }

    return tags
  }

  static exportAsCSV(): string {
    const history = this.getHistory()
    const headers = [
      "Timestamp",
      "Search Term",
      "Search Type",
      "Duration (ms)",
      "Results Count",
      "Status"
    ]

    const rows = history.map(entry => {
      const resultCount = (entry.foundInHubspot ? 1 : 0) + 
                         (entry.foundInDwolla ? 1 : 0)
      const status = entry.foundInHubspot || entry.foundInDwolla ? "Success" : "No Results"
      
      return [
        entry.timestamp.toISOString(),
        entry.searchTerm,
        entry.searchType,
        entry.duration.toString(),
        resultCount.toString(),
        status
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    return csvContent
  }
}
