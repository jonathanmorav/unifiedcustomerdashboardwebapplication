"use client"

import { useState } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Activity, Settings } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WebhookMetrics } from "@/components/analytics/WebhookMetrics"
import { EventAnalytics } from "@/components/analytics/EventAnalytics"
import { JourneyAnalytics } from "@/components/analytics/JourneyAnalytics"
import { ReconciliationDashboard } from "@/components/analytics/ReconciliationDashboard"
import { RealtimeMonitoring } from "@/components/analytics/RealtimeMonitoring"
import { useWebhookAnalytics } from "@/hooks/use-webhook-analytics"

export default function WebhookAnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Use webhook analytics hook
  const { metrics, isLoading, error, refresh, lastUpdated } = useWebhookAnalytics({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
  }

  const handleExport = async (format: "csv" | "json") => {
    try {
      const response = await fetch(`/api/analytics/export?format=${format}&type=${activeTab}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `webhook-analytics-${activeTab}-${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Export error:", error)
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
              Webhook Analytics
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Real-time monitoring and analysis of webhook events
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/analytics/webhooks/settings")}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
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
              Error loading analytics: {error}
            </p>
          </div>
        )}

        {/* Overview Metrics */}
        <WebhookMetrics metrics={metrics} isLoading={isLoading} />

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="journeys">Journeys</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="realtime">Real-time</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6">
              {/* System Health Card */}
              <Card className="shadow-cakewalk-medium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cakewalk-primary" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-cakewalk-text-secondary">Processing Rate</p>
                      <p className="text-2xl font-bold text-cakewalk-success">
                        {metrics?.processingRate || 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-cakewalk-text-secondary">Average Latency</p>
                      <p className="text-2xl font-bold text-cakewalk-text-primary">
                        {metrics?.avgLatency || 0}ms
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-cakewalk-text-secondary">Error Rate</p>
                      <p className="text-2xl font-bold text-cakewalk-error">
                        {metrics?.errorRate || 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-cakewalk-medium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
                      Active Journeys
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-cakewalk-text-primary">
                      {metrics?.activeJourneys || 0}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-cakewalk-medium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
                      Pending Reconciliations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-cakewalk-warning">
                      {metrics?.pendingReconciliations || 0}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-cakewalk-medium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
                      Active Anomalies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-cakewalk-error">
                      {metrics?.activeAnomalies || 0}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-cakewalk-medium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
                      Journey Success Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-cakewalk-success">
                      {metrics?.journeySuccessRate || 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <EventAnalytics />
          </TabsContent>

          <TabsContent value="journeys" className="mt-6">
            <JourneyAnalytics />
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-6">
            <ReconciliationDashboard />
          </TabsContent>

          <TabsContent value="realtime" className="mt-6">
            <RealtimeMonitoring />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}