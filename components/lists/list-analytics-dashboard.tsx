"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ListMembershipCard } from "./list-membership-card"
import { ListTrendChart } from "./list-trend-chart"
import { ListStatsCard } from "./list-stats-card"
import { AlertCircleIcon, ListIcon, TrendingUpIcon, UsersIcon, RefreshCwIcon } from "lucide-react"
import { useSession } from "next-auth/react"

interface ListData {
  listId: number
  name: string
  listType: "STATIC" | "DYNAMIC"
  membershipCount: number
  createdAt: string
  updatedAt: string
  trend: number | null
  previousCount?: number
}

interface ListAnalyticsDashboardProps {
  className?: string
}

export function ListAnalyticsDashboard({ className }: ListAnalyticsDashboardProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [lists, setLists] = useState<ListData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isCollectingSnapshot, setIsCollectingSnapshot] = useState(false)
  const [historyData, setHistoryData] = useState<any>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  )

  // Fetch all lists
  const fetchLists = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/lists")
      if (!response.ok) {
        throw new Error("Failed to fetch lists")
      }

      const data = await response.json()
      if (data.success && data.data) {
        setLists(data.data.lists)
      } else {
        throw new Error(data.error || "Failed to fetch lists")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch lists")
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch historical data
  const fetchHistory = async (days: number) => {
    try {
      const response = await fetch(`/api/lists/history?days=${days}`)
      if (!response.ok) {
        throw new Error("Failed to fetch history")
      }

      const data = await response.json()
      if (data.success && data.data) {
        setHistoryData(data.data)
      }
    } catch (err) {
      console.error("Failed to fetch history:", err)
    }
  }

  // Collect snapshot
  const collectSnapshot = async () => {
    try {
      setIsCollectingSnapshot(true)

      const response = await fetch("/api/lists/snapshot", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to collect snapshot")
      }

      const data = await response.json()
      if (data.success) {
        // Refresh lists and history
        await fetchLists()
        await fetchHistory(
          selectedTimeframe === "daily" ? 7 : selectedTimeframe === "weekly" ? 30 : 90
        )
      }
    } catch (err) {
      console.error("Failed to collect snapshot:", err)
    } finally {
      setIsCollectingSnapshot(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchLists()
      fetchHistory(7) // Default to 7 days
    }
  }, [session])

  useEffect(() => {
    const days = selectedTimeframe === "daily" ? 7 : selectedTimeframe === "weekly" ? 30 : 90
    fetchHistory(days)
  }, [selectedTimeframe])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircleIcon className="mb-4 h-12 w-12 text-cakewalk-error" />
        <h3 className="mb-2 text-cakewalk-h4 text-cakewalk-text-primary">Error Loading Lists</h3>
        <p className="mb-4 text-cakewalk-body-sm text-cakewalk-text-secondary">{error}</p>
        <Button onClick={fetchLists} variant="outline" size="sm">
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  if (!lists || lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ListIcon className="mb-4 h-12 w-12 text-cakewalk-text-secondary" />
        <h3 className="mb-2 text-cakewalk-h4 text-cakewalk-text-primary">No Lists Found</h3>
        <p className="mb-4 text-cakewalk-body-sm text-cakewalk-text-secondary">
          No HubSpot lists found in your account.
        </p>
        <Button
          onClick={collectSnapshot}
          variant="outline"
          size="sm"
          disabled={isCollectingSnapshot}
        >
          <RefreshCwIcon className={`mr-2 h-4 w-4 ${isCollectingSnapshot ? "animate-spin" : ""}`} />
          {isCollectingSnapshot ? "Collecting..." : "Collect Initial Data"}
        </Button>
      </div>
    )
  }

  // Calculate statistics
  const dynamicLists = lists.filter((list) => list.listType === "DYNAMIC")
  const staticLists = lists.filter((list) => list.listType === "STATIC")
  const totalMembers = lists.reduce((sum, list) => sum + list.membershipCount, 0)

  // Get top lists by member count
  const topLists = [...lists].sort((a, b) => b.membershipCount - a.membershipCount).slice(0, 5)

  // Prepare trend data from history
  const trendData =
    historyData?.lists?.slice(0, 3).map((list: any) => ({
      listId: list.listId,
      listName: list.listName,
      trends: list.history || [],
    })) || []

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="mb-2 text-cakewalk-h3 text-cakewalk-text-primary">
            HubSpot List Analytics
          </h2>
          <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
            View all HubSpot lists with member counts and historical trends.
          </p>
        </div>
        <Button
          onClick={collectSnapshot}
          variant="outline"
          size="sm"
          disabled={isCollectingSnapshot}
        >
          <RefreshCwIcon className={`mr-2 h-4 w-4 ${isCollectingSnapshot ? "animate-spin" : ""}`} />
          {isCollectingSnapshot ? "Collecting..." : "Collect Snapshot"}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <ListStatsCard
          icon={ListIcon}
          title="Total Lists"
          value={lists.length}
          description="All lists in account"
        />
        <ListStatsCard
          icon={TrendingUpIcon}
          title="Dynamic Lists"
          value={dynamicLists.length}
          description="Auto-updating lists"
        />
        <ListStatsCard
          icon={UsersIcon}
          title="Static Lists"
          value={staticLists.length}
          description="Fixed membership lists"
        />
        <ListStatsCard
          icon={UsersIcon}
          title="Total Members"
          value={totalMembers.toLocaleString()}
          description="Across all lists"
        />
      </div>

      {/* Trend Analysis */}
      <Card className="border-cakewalk-border shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">
            Membership Trends
          </CardTitle>
          <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
            {trendData.length > 0
              ? "Historical member count trends for top lists"
              : "Start collecting snapshots to see historical trends"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedTimeframe}
            onValueChange={(value) => setSelectedTimeframe(value as any)}
            className="w-full"
          >
            <TabsList className="grid max-w-md grid-cols-3">
              <TabsTrigger value="daily">Daily (7 days)</TabsTrigger>
              <TabsTrigger value="weekly">Weekly (30 days)</TabsTrigger>
              <TabsTrigger value="monthly">Monthly (90 days)</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTimeframe} className="mt-4">
              {trendData.length > 0 ? (
                <div className="space-y-6">
                  {trendData.map((data: any) => (
                    <ListTrendChart
                      key={data.listId}
                      listName={data.listName}
                      data={data.trends}
                      timeframe={selectedTimeframe}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-cakewalk-body-sm text-cakewalk-text-secondary">
                  {historyData
                    ? "No historical data available for this timeframe."
                    : "Collecting initial data..."}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* All Lists */}
      <div>
        <h3 className="mb-4 text-cakewalk-h4 text-cakewalk-text-primary">
          All Lists ({lists.length})
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lists.map((list) => (
            <div key={list.listId} className="relative">
              <ListMembershipCard
                list={{
                  listId: list.listId,
                  listName: list.name,
                  listType: list.listType,
                  membershipTimestamp: list.updatedAt,
                }}
              />
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <Badge variant="secondary" className="text-cakewalk-body-xxs">
                  {list.membershipCount.toLocaleString()} members
                </Badge>
                {list.trend !== null && (
                  <Badge
                    variant={list.trend >= 0 ? "default" : "destructive"}
                    className={`text-cakewalk-body-xxs ${
                      list.trend >= 0
                        ? "bg-cakewalk-success-light text-cakewalk-success-dark"
                        : "bg-cakewalk-error/10 text-cakewalk-error"
                    } border-0`}
                  >
                    {list.trend >= 0 ? "+" : ""}
                    {list.trend.toFixed(1)}%
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
