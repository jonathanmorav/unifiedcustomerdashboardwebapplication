"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"
import type { SearchType } from "@/lib/search/unified-search"

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