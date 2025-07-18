import { useState, useCallback } from "react"
import { SearchType } from "@/lib/search/unified-search"

interface SearchResult {
  searchTerm?: string
  summary: {
    found: boolean
    foundIn: ("hubspot" | "dwolla" | "both")[]
    searchType: string
    duration: string
  }
  hubspot?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  dwolla?: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface UseSearchOptions {
  onSuccess?: (result: SearchResult) => void
  onError?: (error: Error) => void
}

export function useSearch(options: UseSearchOptions = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const search = useCallback(
    async (searchTerm: string, searchType: SearchType = "auto") => {
      // Cancel any pending search
      if (abortController) {
        abortController.abort()
      }

      // Create new abort controller
      const controller = new AbortController()
      setAbortController(controller)

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ searchTerm, searchType }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Search failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.success && data.data) {
          // Add searchTerm to the result
          const resultWithSearchTerm = {
            ...data.data,
            searchTerm,
          }
          setResult(resultWithSearchTerm)
          options.onSuccess?.(resultWithSearchTerm)
        } else {
          throw new Error("Invalid response format")
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Search was cancelled, don't update state
          return
        }

        const error = err instanceof Error ? err : new Error("Search failed")
        setError(error)
        options.onError?.(error)
      } finally {
        setIsLoading(false)
        setAbortController(null)
      }
    },
    [abortController, options]
  )

  const cancel = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setIsLoading(false)
      setAbortController(null)
    }
  }, [abortController])

  const reset = useCallback(() => {
    cancel()
    setResult(null)
    setError(null)
  }, [cancel])

  return {
    search,
    cancel,
    reset,
    isLoading,
    error,
    result,
  }
}
