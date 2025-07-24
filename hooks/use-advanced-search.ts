import { useState, useCallback } from "react"
import { AdvancedSearchParams, AdvancedSearchResult } from "@/lib/types/search"
import { AdvancedSearchEngine } from "@/lib/search/advanced-search"

export function useAdvancedSearch() {
  const [searchResults, setSearchResults] = useState<AdvancedSearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const search = useCallback(async (params: AdvancedSearchParams) => {
    setIsLoading(true)
    setError(null)

    try {
      const engine = new AdvancedSearchEngine()
      const results = await engine.advancedSearch(params)
      setSearchResults(results)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Search failed"))
      setSearchResults(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setSearchResults(null)
    setError(null)
  }, [])

  return {
    searchResults,
    isLoading,
    error,
    search,
    clearResults,
  }
}
