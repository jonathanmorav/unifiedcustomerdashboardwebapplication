"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ClockIcon, DownloadIcon, TrashIcon } from "lucide-react"
import { useSearchHistory } from "@/hooks/use-search-history"
import { SearchHistory as SearchHistoryManager } from "@/lib/search/search-history-client"
import { toast } from "sonner"

export function SearchHistory() {
  const { history, isLoading, error, clearHistory } = useSearchHistory()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const csv = SearchHistoryManager.exportAsCSV()
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `search-history-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("Failed to export search history")
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Search History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Search History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-cakewalk-error">Failed to load search history</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Search History
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={history.length === 0 || isExporting}
            >
              <DownloadIcon className="mr-1 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              disabled={history.length === 0}
            >
              <TrashIcon className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="py-8 text-center text-cakewalk-text-secondary">
            No search history yet. Start searching to see your history here.
          </p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="bg-cakewalk-bg-alice-200 hover:bg-cakewalk-bg-alice-300 flex items-center justify-between rounded-lg p-3 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{entry.searchTerm}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {entry.searchType}
                    </Badge>
                    <span className="text-xs text-cakewalk-text-secondary">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-cakewalk-text-secondary">
                      • {entry.duration}ms
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {entry.foundInHubspot && (
                    <Badge className="bg-cakewalk-success text-white">HubSpot</Badge>
                  )}
                  {entry.foundInDwolla && (
                    <Badge className="bg-cakewalk-primary text-white">Dwolla</Badge>
                  )}
                  {!entry.foundInHubspot && !entry.foundInDwolla && (
                    <Badge variant="secondary">Not found</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
