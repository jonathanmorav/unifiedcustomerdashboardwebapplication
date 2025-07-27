"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Clock, Search, X, PlayCircle, Loader2 } from "lucide-react"
import { SearchHistory } from "@/lib/search/search-history-client"
import { formatDistanceToNow } from "date-fns"
import { useSearchContext } from "@/contexts/search-context"

interface RecentSearch {
  id: string
  query: string
  type: string
  timestamp: string
}

export function RecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const { search, isLoading } = useSearchContext()

  useEffect(() => {
    const loadRecentSearches = () => {
      const history = SearchHistory.getRecentSearches(5)
      const formattedSearches = history.map((entry) => ({
        id: entry.id,
        query: entry.searchTerm,
        type: entry.searchType,
        timestamp: formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }),
      }))
      setRecentSearches(formattedSearches)
    }

    // Load on mount
    loadRecentSearches()

    // Set up interval to refresh timestamps
    const interval = setInterval(loadRecentSearches, 30000) // Refresh every 30 seconds

    // Listen for custom event when new search is added
    const handleSearchUpdate = () => loadRecentSearches()
    window.addEventListener("searchHistoryUpdated", handleSearchUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener("searchHistoryUpdated", handleSearchUpdate)
    }
  }, [])

  const handleRemove = (id: string) => {
    SearchHistory.removeEntry(id)
    setRecentSearches((prev) => prev.filter((search) => search.id !== id))
  }

  const handleRerunSearch = async (searchQuery: string, searchType: string) => {
    if (search && !isLoading) {
      await search(searchQuery, searchType as any)
    }
  }
  return (
    <Card className="border-cakewalk-border shadow-cakewalk-medium transition-colors duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-cakewalk-h4 text-cakewalk-text-primary">
          <Clock className="h-5 w-5 text-cakewalk-primary" />
          Recent Searches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentSearches.length === 0 ? (
          <p className="py-4 text-center text-cakewalk-body-xs text-cakewalk-text-secondary">
            No recent searches yet
          </p>
        ) : (
          recentSearches.map((search) => (
            <div
              key={search.id}
              className="group flex items-center justify-between rounded-xl bg-cakewalk-alice-200 p-3 transition-all duration-200 hover:bg-cakewalk-alice-300 hover:shadow-sm"
            >
              <div 
                className={`flex flex-1 items-center gap-2 ${
                  isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
                onClick={() => !isLoading && handleRerunSearch(search.query, search.type)}
                title={isLoading ? "Search in progress..." : `Click to re-run search: ${search.query}`}
              >
                <Search className="h-4 w-4 text-cakewalk-text-secondary" />
                <div className="flex-1">
                  <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {search.query}
                  </p>
                  <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                    {search.timestamp}
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 text-cakewalk-primary animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 text-cakewalk-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(search.id)
                }}
                title="Remove from recent searches"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
