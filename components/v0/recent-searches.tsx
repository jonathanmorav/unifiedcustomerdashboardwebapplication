"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Clock, Search, X } from "lucide-react"
import { SearchHistory } from "@/lib/search/search-history-client"
import { formatDistanceToNow } from "date-fns"

interface RecentSearch {
  id: string
  query: string
  type: string
  timestamp: string
}

export function RecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])

  useEffect(() => {
    const loadRecentSearches = () => {
      const history = SearchHistory.getRecentSearches(5)
      const formattedSearches = history.map(entry => ({
        id: entry.id,
        query: entry.searchTerm,
        type: entry.searchType,
        timestamp: formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
      }))
      setRecentSearches(formattedSearches)
    }

    // Load on mount
    loadRecentSearches()

    // Set up interval to refresh timestamps
    const interval = setInterval(loadRecentSearches, 30000) // Refresh every 30 seconds

    // Listen for custom event when new search is added
    const handleSearchUpdate = () => loadRecentSearches()
    window.addEventListener('searchHistoryUpdated', handleSearchUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('searchHistoryUpdated', handleSearchUpdate)
    }
  }, [])

  const handleRemove = (id: string) => {
    SearchHistory.removeEntry(id)
    setRecentSearches(prev => prev.filter(search => search.id !== id))
  }
  return (
    <Card className="shadow-cakewalk-medium border-cakewalk-border transition-colors duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary flex items-center gap-2">
          <Clock className="h-5 w-5 text-cakewalk-primary" />
          Recent Searches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentSearches.length === 0 ? (
          <p className="text-cakewalk-body-xs text-cakewalk-text-secondary text-center py-4">
            No recent searches yet
          </p>
        ) : (
          recentSearches.map((search) => (
            <div
              key={search.id}
              className="flex items-center justify-between p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-cakewalk-text-secondary" />
                <div>
                  <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">{search.query}</p>
                  <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">{search.timestamp}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => handleRemove(search.id)}
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
