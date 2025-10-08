"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { BillingMetrics } from "@/components/billing/BillingMetrics"
import { TransactionTable } from "@/components/billing/TransactionTable"
import { BillingFilters, type BillingFilterValues } from "@/components/billing/BillingFilters"
import { useACHTransactions } from "@/hooks/use-ach-transactions"
import { TransactionDetailModal } from "@/components/billing/TransactionDetailModal"
import { Pagination } from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshingStatuses, setIsRefreshingStatuses] = useState(false)

  // Filter state
  const [filters, setFilters] = useState<BillingFilterValues>({
    dateRange: {
      start: null,
      end: null,
      preset: "month",
    },
    status: [],
    amountRange: {
      min: null,
      max: null,
    },
    direction: "all",
    searchQuery: "",
  })

  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false)

  // Use the ACH transactions hook
  const { transactions, metrics, isLoading, error, refresh, lastUpdated, totalCount, totalPages } =
    useACHTransactions(filters, currentPage, pageSize, {
      autoRefresh: true,
      refreshInterval: 30000, // 30 seconds
    })

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
    }
  }, [session, status, router])

  const handleRefresh = () => {
    refresh()
  }

  const handleFiltersChange = (newFilters: BillingFilterValues) => {
    // Check if date range changed
    if (
      newFilters.dateRange.start !== filters.dateRange.start ||
      newFilters.dateRange.end !== filters.dateRange.end ||
      newFilters.dateRange.preset !== filters.dateRange.preset
    ) {
      setCurrentPage(1) // Reset to first page when date filters change
    }
    setFilters(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({
      dateRange: { start: null, end: null, preset: "month" },
      status: [],
      amountRange: { min: null, max: null },
      direction: "all",
      searchQuery: "",
    })
    setCurrentPage(1) // Reset to first page when clearing filters
  }

  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction)
    setIsModalOpen(true)
  }

  const handleExport = async (format: "csv" | "excel" = "csv") => {
    if (isExporting) {
      toast.info("Export already in progress...")
      return
    }

    setIsExporting(true)
    
    try {
      toast.info(`Starting ${format.toUpperCase()} export...`, {
        description: "This may take a moment for large datasets"
      })

      // Build query params from current filters
      const params = new URLSearchParams()
      params.append("format", format)

      if (filters.status.length > 0) {
        params.append("status", filters.status.join(","))
      }

      if (filters.direction !== "all") {
        params.append("direction", filters.direction)
      }

      if (filters.dateRange.start) {
        params.append("startDate", filters.dateRange.start.toISOString())
      }

      if (filters.dateRange.end) {
        params.append("endDate", filters.dateRange.end.toISOString())
      }

      if (filters.amountRange.min !== null) {
        params.append("minAmount", filters.amountRange.min.toString())
      }

      if (filters.amountRange.max !== null) {
        params.append("maxAmount", filters.amountRange.max.toString())
      }

      if (filters.searchQuery) {
        params.append("search", filters.searchQuery)
      }

      const response = await fetch(`/api/ach/export?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 429) {
          const message = errorData.message || "Export rate limit exceeded. Please wait a few minutes before trying again."
          const retryAfter = errorData.retryAfter || "a few minutes"
          throw new Error(`${message} (Retry after: ${retryAfter})`)
        } else if (response.status === 401) {
          throw new Error("Authentication required. Please refresh the page and try again.")
        } else if (response.status === 408) {
          const message = errorData.message || "Export timeout occurred. Please try with smaller date ranges."
          const suggestion = errorData.suggestion || "Try filtering by a smaller date range"
          throw new Error(`${message}\n\nSuggestion: ${suggestion}`)
        } else if (response.status >= 500) {
          const message = errorData.message || "Server error occurred. Please try again in a few minutes."
          const suggestion = errorData.suggestion || "Try refreshing the page and attempting the export again"
          throw new Error(`${message}\n\nSuggestion: ${suggestion}`)
        } else {
          const message = errorData.message || errorData.error || `Export failed with status ${response.status}`
          const suggestion = errorData.suggestion ? `\n\nSuggestion: ${errorData.suggestion}` : ""
          throw new Error(`${message}${suggestion}`)
        }
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ach-transactions-${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${format.toUpperCase()} export completed successfully!`, {
        description: `File downloaded as ach-transactions-${new Date().toISOString().split("T")[0]}.${format}`
      })

    } catch (error) {
      console.error("Export error:", error)
      
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during export"
      
      toast.error("Export failed", {
        description: errorMessage,
        duration: 8000 // Longer duration for error messages
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleSync = async () => {
    try {
      setIsSyncing(true)

      const syncParams: Record<string, any> = {
        limit: 100,
      }

      // Add date filters if they exist
      if (filters.dateRange.start) {
        syncParams["startDate"] = filters.dateRange.start.toISOString()
      }

      if (filters.dateRange.end) {
        syncParams["endDate"] = filters.dateRange.end.toISOString()
      }

      const response = await fetch("/api/ach/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(syncParams),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Sync failed")
      }

      const result = await response.json()
      console.log("Sync completed:", result)

      // Show success message
      alert(`Sync completed! ${result.results?.synced || 0} transactions synced.`)

      // Refresh the data after sync
      refresh()
    } catch (error) {
      console.error("Sync error:", error)
      // Show more detailed error message
      if (error instanceof Error) {
        alert(`Sync failed: ${error.message}`)
      } else {
        alert("Sync failed. Please check console for details.")
      }
    } finally {
      setIsSyncing(false)
    }
  }

  const handleRefreshStatuses = async () => {
    try {
      setIsRefreshingStatuses(true)

      // Build params for status refresh based on current visible transactions
      const refreshParams: Record<string, any> = {
        statuses: ["pending", "processing"], // Focus on transactions that might have changed
        limit: 500, // Check up to 500 transactions
        concurrency: 5, // Reasonable concurrency for API calls
      }

      // If we have specific status filters, include those too
      if (filters.status.length > 0) {
        refreshParams.statuses = filters.status
      }

      // If we have date filters, we can add olderThanDays logic
      if (filters.dateRange.start) {
        const daysDiff = Math.floor(
          (new Date().getTime() - filters.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysDiff > 0) {
          refreshParams.olderThanDays = daysDiff
        }
      }

      const response = await fetch("/api/ach/refresh-statuses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(refreshParams),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Status refresh failed")
      }

      const result = await response.json()
      console.log("Status refresh completed:", result)

      // Show success message with details
      const { checked, updated, updatedByStatus } = result.results
      let message = `Status refresh completed! Checked ${checked} transactions, updated ${updated}.`
      
      if (updated > 0 && updatedByStatus) {
        const statusUpdates = Object.entries(updatedByStatus)
          .map(([status, count]) => `${count} → ${status}`)
          .join(", ")
        message += ` Updates: ${statusUpdates}`
      }

      alert(message)

      // Refresh the data after status refresh
      refresh()
    } catch (error) {
      console.error("Status refresh error:", error)
      // Show more detailed error message
      if (error instanceof Error) {
        alert(`Status refresh failed: ${error.message}`)
      } else {
        alert("Status refresh failed. Please check console for details.")
      }
    } finally {
      setIsRefreshingStatuses(false)
    }
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-cakewalk-alice-100">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-6">
        {/* Page Title and Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-cakewalk-text-primary">
              Customer ACH Payments
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Monitoring customer-initiated ACH payments to Cakewalk Benefits
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshStatuses}
              disabled={isRefreshingStatuses || isLoading}
              className={`flex items-center gap-2 ${isRefreshingStatuses ? "bg-cakewalk-info/10" : ""}`}
              title="Check Dwolla for status updates on pending/processing transactions"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingStatuses ? "animate-spin" : ""}`} />
              {isRefreshingStatuses ? "Refreshing Statuses..." : "Refresh Statuses"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={isExporting}
              className={`flex items-center gap-2 ${isExporting ? "bg-cakewalk-primary/10" : ""}`}
            >
              <Download className={`h-4 w-4 ${isExporting ? "animate-spin" : ""}`} />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || isLoading}
              className={`flex items-center gap-2 ${isSyncing ? "bg-cakewalk-primary/10" : ""}`}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync from Dwolla"}
            </Button>
          </div>
        </div>

        {/* Last Updated Indicator */}
        <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
          {isLoading && <span className="ml-2">(Refreshing...)</span>}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">
              Error loading transactions: {error}
            </p>
          </div>
        )}

        {/* Metrics Dashboard */}
        <BillingMetrics metrics={metrics} isLoading={isLoading} compactView={true} />

        {/* Tabs for Transactions and Analytics */}
        <Tabs defaultValue="transactions" className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions">
            {/* Filters Section */}
            <div className="mt-6">
              <BillingFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
                isCollapsed={isFilterCollapsed}
                onToggleCollapse={() => setIsFilterCollapsed(!isFilterCollapsed)}
              />
            </div>

            {/* Transactions Table */}
            <Card className="mt-6 shadow-cakewalk-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Transactions
                {totalCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                    (Showing {transactions.length} of {totalCount.toLocaleString()})
                  </span>
                )}
              </CardTitle>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {transactions.length > 0 && (
                  <span>
                    Page Total:{" "}
                    {transactions
                      .reduce((sum, t) => sum + t.amount, 0)
                      .toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TransactionTable
              transactions={transactions}
              isLoading={isLoading}
              totalAmount={metrics.totalVolume}
              onTransactionClick={handleTransactionClick}
              currentPage={currentPage}
              itemsPerPage={pageSize}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}{" "}
                  transactions
                </p>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onChange={setCurrentPage}
                  className="justify-end"
                />
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Transaction Detail Modal */}
        <TransactionDetailModal
          transaction={selectedTransaction}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedTransaction(null)
          }}
        />
      </main>
    </div>
  )
}
