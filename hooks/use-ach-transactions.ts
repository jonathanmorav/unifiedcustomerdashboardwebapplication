import { useState, useEffect, useCallback } from "react"
import { BillingFilterValues } from "@/components/billing/BillingFilters"

interface UseACHTransactionsOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface TransactionMetrics {
  totalVolume: number
  successRate: number
  pendingAmount: number
  failedAmount: number
  todayCount: number
  averageTransaction: number
  processedAmount: number
  returnedAmount: number
  totalFees: number
  netAmount: number
}

interface UseACHTransactionsReturn {
  transactions: any[]
  metrics: TransactionMetrics
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  lastUpdated: Date
  totalCount: number
  currentPage: number
  totalPages: number
}

export function useACHTransactions(
  filters: BillingFilterValues,
  page: number = 1,
  limit: number = 50,
  options: UseACHTransactionsOptions = {}
): UseACHTransactionsReturn {
  const [transactions, setTransactions] = useState<any[]>([])
  const [metrics, setMetrics] = useState<TransactionMetrics>({
    totalVolume: 0,
    successRate: 0,
    pendingAmount: 0,
    failedAmount: 0,
    todayCount: 0,
    averageTransaction: 0,
    processedAmount: 0,
    returnedAmount: 0,
    totalFees: 0,
    netAmount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams()

    params.append("page", page.toString())
    params.append("limit", limit.toString())

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

    return params.toString()
  }, [filters, page, limit])

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const queryString = buildQueryParams()
      const response = await fetch(`/api/ach/transactions?${queryString}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch transactions")
      }

      const data = await response.json()

      setTransactions(data.transactions || [])
      setTotalCount(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 0)

      // Use server-side calculated metrics
      if (data.metrics) {
        const { statusCounts = {}, statusAmounts = {} } = data.metrics
        const total = data.metrics.totalCount || 0
        const processed = statusCounts.processed || 0

        setMetrics({
          totalVolume: data.metrics.totalAmount || 0,
          successRate: total > 0 ? Math.round((processed / total) * 100) : 0,
          pendingAmount: statusAmounts.pending || 0,
          failedAmount: statusAmounts.failed || 0,
          todayCount: data.metrics.todayCount || 0,
          averageTransaction: total > 0 ? data.metrics.totalAmount / total : 0,
          processedAmount: statusAmounts.processed || 0,
          returnedAmount: statusAmounts.returned || 0,
          totalFees: data.metrics.totalFees || 0,
          netAmount: data.metrics.totalNetAmount || 0,
        })
      }

      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error fetching transactions:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryParams])

  // Initial fetch and when dependencies change
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Auto-refresh if enabled
  useEffect(() => {
    if (!options.autoRefresh) return

    const interval = setInterval(() => {
      fetchTransactions()
    }, options.refreshInterval || 30000) // Default 30 seconds

    return () => clearInterval(interval)
  }, [fetchTransactions, options.autoRefresh, options.refreshInterval])

  return {
    transactions,
    metrics,
    isLoading,
    error,
    refresh: fetchTransactions,
    lastUpdated,
    totalCount,
    currentPage: page,
    totalPages,
  }
}
