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

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

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
    try {
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
        throw new Error("Export failed")
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
    } catch (error) {
      console.error("Export error:", error)
      // You could add a toast notification here
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              ACH Transaction Tracking
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Real-time monitoring of ACH draft executions
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
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
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
