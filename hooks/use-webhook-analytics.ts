import { useState, useEffect, useCallback } from "react"

interface WebhookMetrics {
  // Event metrics
  totalEvents: number
  eventsPerMinute: number
  processingRate: number
  avgLatency: number
  errorRate: number
  
  // Journey metrics
  activeJourneys: number
  journeySuccessRate: number
  avgJourneyDuration: number
  stuckJourneys: number
  
  // Reconciliation metrics
  pendingReconciliations: number
  discrepancyRate: number
  autoResolvedCount: number
  
  // Anomaly metrics
  activeAnomalies: number
  criticalAnomalies: number
  
  // Volume metrics by type
  eventsByType: Record<string, number>
  transferVolume: number
  customerEvents: number
}

interface UseWebhookAnalyticsOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useWebhookAnalytics(options: UseWebhookAnalyticsOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options
  
  const [metrics, setMetrics] = useState<WebhookMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/analytics/metrics", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch metrics")
      }

      const data = await response.json()
      setMetrics(data.metrics)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchMetrics()
  }, [fetchMetrics])

  // Initial fetch
  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return

    const interval = setInterval(() => {
      fetchMetrics()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchMetrics])

  return {
    metrics,
    isLoading,
    error,
    refresh,
    lastUpdated,
  }
}