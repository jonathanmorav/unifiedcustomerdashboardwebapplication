"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"
import type { SearchType } from "@/lib/search/unified-search"
import { SearchHistory } from "@/lib/search/search-history-client"

interface SearchResult {
  searchTerm?: string
  summary: {
    found: boolean
    foundIn: ("hubspot" | "dwolla" | "both")[]
    searchType: string
    duration: string
  }
  hubspot?: any
  dwolla?: any
}

interface SearchContextType {
  isLoading: boolean
  error: Error | null
  result: SearchResult | null
  search: (searchTerm: string, searchType?: SearchType) => Promise<void>
  reset: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)

  const search = useCallback(async (searchTerm: string, searchType: SearchType = "auto") => {
    const startTime = Date.now()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ searchTerm, searchType }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Search failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        const resultWithSearchTerm = {
          ...data.data,
          searchTerm,
        }
        setResult(resultWithSearchTerm)
        
        // Add to client-side search history
        const duration = Date.now() - startTime
        
        // Create a UnifiedSearchResult-like object for the client-side history
        const searchResult = {
          results: {
            hubspot: data.data.hubspot ? [data.data.hubspot] : [],
            dwolla: data.data.dwolla ? [data.data.dwolla] : []
          },
          totalResults: (data.data.hubspot ? 1 : 0) + (data.data.dwolla ? 1 : 0),
          searchTerm,
          searchType,
          timestamp: new Date(),
          duration
        }
        
        SearchHistory.addEntry(
          searchTerm,
          searchType,
          searchResult as any,
          duration
        )
        
        // Dispatch custom event to notify components
        window.dispatchEvent(new CustomEvent('searchHistoryUpdated'))
      } else {
        throw new Error("Invalid response format")
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Search failed")
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return (
    <SearchContext.Provider value={{ isLoading, error, result, search, reset }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearchContext() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error("useSearchContext must be used within a SearchProvider")
  }
  return context
}