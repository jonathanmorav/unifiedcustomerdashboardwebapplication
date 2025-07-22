"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ListMembershipCard } from "./list-membership-card"
import { ListTrendChart } from "./list-trend-chart"
import { ListStatsCard } from "./list-stats-card"
import { AlertCircleIcon, ListIcon, TrendingUpIcon, UsersIcon } from "lucide-react"
import { useSearchContext } from "@/contexts/search-context"
import type { HubSpotListMembership } from "@/lib/types/hubspot"

interface ListAnalyticsDashboardProps {
  className?: string
}

export function ListAnalyticsDashboard({ className }: ListAnalyticsDashboardProps) {
  const { result, isSearching } = useSearchContext()
  
  // Extract list data from search results
  const activeLists = result?.hubspot?.activeLists || []
  const companyName = result?.hubspot?.company?.name || "No Company Selected"

  if (isSearching) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ListIcon className="h-12 w-12 text-cakewalk-text-secondary mb-4" />
        <h3 className="text-cakewalk-h4 text-cakewalk-text-primary mb-2">No Company Selected</h3>
        <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
          Search for a company to view their list analytics and membership data.
        </p>
      </div>
    )
  }

  if (!activeLists || activeLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircleIcon className="h-12 w-12 text-cakewalk-warning mb-4" />
        <h3 className="text-cakewalk-h4 text-cakewalk-text-primary mb-2">No Active Lists Found</h3>
        <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
          {companyName} is not currently a member of any active lists.
        </p>
      </div>
    )
  }

  // Calculate statistics
  const dynamicLists = activeLists.filter(list => list.listType === "DYNAMIC")
  const staticLists = activeLists.filter(list => list.listType === "STATIC")
  
  // Mock trend data for demonstration
  const mockTrendData = activeLists.slice(0, 3).map(list => ({
    listId: list.listId,
    listName: list.listName,
    trends: [
      { date: "2025-01-15", memberCount: 150 },
      { date: "2025-01-16", memberCount: 155 },
      { date: "2025-01-17", memberCount: 162 },
      { date: "2025-01-18", memberCount: 168 },
      { date: "2025-01-19", memberCount: 175 },
      { date: "2025-01-20", memberCount: 182 },
      { date: "2025-01-21", memberCount: 190 },
    ]
  }))

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Header */}
      <div>
        <h2 className="text-cakewalk-h3 text-cakewalk-text-primary mb-2">
          List Analytics for {companyName}
        </h2>
        <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
          View active list memberships and historical trends for this company's contacts.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ListStatsCard
          icon={ListIcon}
          title="Total Lists"
          value={activeLists.length}
          description="Active list memberships"
        />
        <ListStatsCard
          icon={TrendingUpIcon}
          title="Dynamic Lists"
          value={dynamicLists.length}
          description="Auto-updating lists"
          trend={{ value: 12, isPositive: true }}
        />
        <ListStatsCard
          icon={UsersIcon}
          title="Static Lists"
          value={staticLists.length}
          description="Fixed membership lists"
        />
      </div>

      {/* Trend Analysis */}
      <Card className="shadow-cakewalk-medium border-cakewalk-border">
        <CardHeader>
          <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">
            Membership Trends
          </CardTitle>
          <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
            Historical member count trends for top lists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily" className="w-full">
            <TabsList className="grid grid-cols-3 max-w-md">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
            
            <TabsContent value="daily" className="mt-4">
              <div className="space-y-6">
                {mockTrendData.map((data) => (
                  <ListTrendChart
                    key={data.listId}
                    listName={data.listName}
                    data={data.trends}
                    timeframe="daily"
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="weekly" className="mt-4">
              <div className="text-cakewalk-body-sm text-cakewalk-text-secondary text-center py-8">
                Weekly trend data coming soon...
              </div>
            </TabsContent>
            
            <TabsContent value="monthly" className="mt-4">
              <div className="text-cakewalk-body-sm text-cakewalk-text-secondary text-center py-8">
                Monthly trend data coming soon...
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* List Memberships */}
      <div>
        <h3 className="text-cakewalk-h4 text-cakewalk-text-primary mb-4">
          Active List Memberships ({activeLists.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeLists.map((list) => (
            <ListMembershipCard
              key={list.listId}
              list={list}
            />
          ))}
        </div>
      </div>
    </div>
  )
}