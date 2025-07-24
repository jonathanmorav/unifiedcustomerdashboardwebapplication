import { useState, useCallback, useEffect } from "react"
import { SavedSearch } from "@/lib/types/search"
import { toast } from "sonner"

export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchSavedSearches()
  }, [])

  const fetchSavedSearches = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/search/saved")
      if (response.ok) {
        const searches = await response.json()
        setSavedSearches(searches)
      }
    } catch (error) {
      toast.error("Failed to load saved searches")
    } finally {
      setIsLoading(false)
    }
  }

  const saveSearch = useCallback(
    async (search: Omit<SavedSearch, "id" | "userId" | "createdAt" | "updatedAt">) => {
      try {
        const response = await fetch("/api/search/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(search),
        })

        if (response.ok) {
          const newSearch = await response.json()
          setSavedSearches((prev) => [...prev, newSearch])
          return newSearch
        }
      } catch (error) {
        toast.error("Failed to save search")
        throw error
      }
    },
    []
  )

  const loadSavedSearch = useCallback(
    async (id: string) => {
      const search = savedSearches.find((s) => s.id === id)
      if (search) {
        // Update use count
        await fetch(`/api/search/saved/${id}/use`, { method: "POST" })
        return search
      }
      return null
    },
    [savedSearches]
  )

  const deleteSavedSearch = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/search/saved/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setSavedSearches((prev) => prev.filter((s) => s.id !== id))
      }
    } catch (error) {
      toast.error("Failed to delete saved search")
      throw error
    }
  }, [])

  return {
    savedSearches,
    saveSearch,
    loadSavedSearch,
    deleteSavedSearch,
    isLoading,
  }
}
