"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DownloadIcon, RefreshCwIcon, PrinterIcon, ShareIcon, BookmarkIcon } from "lucide-react"
import { toast } from "sonner"
import { exportToCSV, exportToJSON } from "@/utils/export-helpers"

interface ActionBarProps {
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  onRefresh: () => void
  isLoading: boolean
}

export function ActionBar({ data, onRefresh, isLoading }: ActionBarProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCSV = () => {
    setIsExporting(true)
    try {
      const filename = `customer-data-${new Date().toISOString().split("T")[0]}`
      exportToCSV(data, filename)
      toast.success("Data exported as CSV")
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportJSON = () => {
    setIsExporting(true)
    try {
      const filename = `customer-data-${new Date().toISOString().split("T")[0]}`
      exportToJSON(data, filename)
      toast.success("Data exported as JSON")
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
    toast.success("Print dialog opened")
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied to clipboard")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleBookmark = () => {
    // In a real app, this would save to user's bookmarks
    toast.info("Bookmarking feature coming soon")
  }

  return (
    <div className="bg-cakewalk-bg-alice-100 flex flex-wrap items-center gap-2 rounded-lg p-4">
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
        <RefreshCwIcon className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        Refresh
      </Button>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={!data || isExporting}
        >
          <DownloadIcon className="mr-1 h-4 w-4" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportJSON}
          disabled={!data || isExporting}
        >
          <DownloadIcon className="mr-1 h-4 w-4" />
          JSON
        </Button>
      </div>

      <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data}>
        <PrinterIcon className="mr-1 h-4 w-4" />
        Print
      </Button>

      <Button variant="outline" size="sm" onClick={handleShare}>
        <ShareIcon className="mr-1 h-4 w-4" />
        Share
      </Button>

      <Button variant="outline" size="sm" onClick={handleBookmark} disabled={!data}>
        <BookmarkIcon className="mr-1 h-4 w-4" />
        Bookmark
      </Button>
    </div>
  )
}
