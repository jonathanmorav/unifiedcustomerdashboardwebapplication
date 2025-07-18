import { useState, useEffect, useCallback } from "react"

interface SearchHistoryEntry {
  id: string
  searchTerm: string
  searchType: string
  timestamp: string
  duration: number
  foundInHubspot: boolean
  foundInDwolla: boolean
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchHistory = useCallback(async (limit = 20) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/search?limit=${limit}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && Array.isArray(data.data)) {
        setHistory(data.data)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch history")
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    // In the current implementation, clearing is done client-side
    // In production, this would call an API endpoint
    setHistory([])
  }, [])

  // Fetch history on mount
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return {
    history,
    isLoading,
    error,
    fetchHistory,
    clearHistory,
  }
}

export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=5`)

      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setSuggestions(data.data)
        }
      }
    } catch (err) {
      // Fail silently for suggestions
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    suggestions,
    isLoading,
    fetchSuggestions,
  }
}
