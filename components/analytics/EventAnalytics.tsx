"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Filter,
  Download,
  BarChart3,
  Calendar,
  ChevronRight,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface EventData {
  summary: {
    totalEvents: number
    successfulEvents: number
    failedEvents: number
    processingRate: number
    avgProcessingTime: number
  }
  eventTypes: Array<{
    type: string
    count: number
    successRate: number
    avgProcessingTime: number
    trend: number
  }>
  recentEvents: Array<{
    id: string
    eventType: string
    resourceType: string
    resourceId: string
    status: string
    processingTime: number
    timestamp: Date
    error?: string
  }>
  hourlyVolume: Array<{
    hour: string
    count: number
  }>
}

export const EventAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState("24h")
  const [eventTypeFilter, setEventTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [eventData, setEventData] = useState<EventData | null>(null)

  useEffect(() => {
    fetchEventData()
  }, [timeRange, eventTypeFilter])

  const fetchEventData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/analytics/events?timeRange=${timeRange}&eventType=${eventTypeFilter}`
      )
      if (response.ok) {
        const data = await response.json()
        setEventData(data)
      }
    } catch (error) {
      console.error("Failed to fetch event data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-cakewalk-success"
      case "failed":
        return "text-cakewalk-error"
      case "processing":
        return "text-cakewalk-warning"
      default:
        return "text-cakewalk-text-secondary"
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success"
      case "failed":
        return "destructive"
      case "processing":
        return "warning"
      default:
        return "secondary"
    }
  }

  // Mock data for demonstration
  const mockData: EventData = {
    summary: {
      totalEvents: 125430,
      successfulEvents: 122850,
      failedEvents: 2580,
      processingRate: 97.9,
      avgProcessingTime: 145,
    },
    eventTypes: [
      {
        type: "transfer_created",
        count: 45230,
        successRate: 99.2,
        avgProcessingTime: 120,
        trend: 12.5,
      },
      {
        type: "transfer_completed",
        count: 42100,
        successRate: 100,
        avgProcessingTime: 85,
        trend: 8.3,
      },
      {
        type: "customer_created",
        count: 12450,
        successRate: 98.5,
        avgProcessingTime: 230,
        trend: -2.1,
      },
      {
        type: "customer_verified",
        count: 11200,
        successRate: 95.8,
        avgProcessingTime: 450,
        trend: 5.7,
      },
      {
        type: "transfer_failed",
        count: 2580,
        successRate: 100,
        avgProcessingTime: 95,
        trend: -15.3,
      },
    ],
    recentEvents: Array.from({ length: 10 }, (_, i) => ({
      id: `event-${i}`,
      eventType: ["transfer_created", "transfer_completed", "customer_created", "customer_verified"][
        Math.floor(Math.random() * 4)
      ],
      resourceType: ["transfer", "customer"][Math.floor(Math.random() * 2)],
      resourceId: `res-${Math.random().toString(36).substr(2, 9)}`,
      status: ["completed", "processing", "failed"][Math.floor(Math.random() * 3)],
      processingTime: Math.floor(Math.random() * 500) + 50,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
    })),
    hourlyVolume: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      count: Math.floor(Math.random() * 8000) + 2000,
    })),
  }

  const data = eventData || mockData

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="transfer">Transfer events</SelectItem>
              <SelectItem value="customer">Customer events</SelectItem>
              <SelectItem value="funding_source">Funding source events</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Events
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-text-primary">
                {data.summary.totalEvents.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold text-cakewalk-success">
                  {data.summary.processingRate}%
                </p>
                <Progress
                  value={data.summary.processingRate}
                  className="mt-2 h-2"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Failed Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-error">
                {data.summary.failedEvents.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Avg Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-text-primary">
                {data.summary.avgProcessingTime}ms
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Event Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-text-primary">
                {data.eventTypes.length}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Types Breakdown */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cakewalk-primary" />
            Event Types Breakdown
          </CardTitle>
          <CardDescription>Performance metrics by event type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : (
              data.eventTypes.map((eventType) => (
                <div
                  key={eventType.type}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-cakewalk-text-primary">
                        {eventType.type}
                      </p>
                      <Badge variant="secondary">{eventType.count.toLocaleString()}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-cakewalk-text-secondary">
                      <span>Success: {eventType.successRate}%</span>
                      <span>Avg: {eventType.avgProcessingTime}ms</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {eventType.trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-cakewalk-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-cakewalk-error" />
                    )}
                    <span
                      className={`text-sm ${
                        eventType.trend > 0 ? "text-cakewalk-success" : "text-cakewalk-error"
                      }`}
                    >
                      {eventType.trend > 0 ? "+" : ""}
                      {eventType.trend}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events Table */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cakewalk-primary" />
            Recent Events
          </CardTitle>
          <CardDescription>Latest webhook events processed</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processing Time</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                data.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.eventType}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{event.resourceType}</p>
                        <p className="text-xs text-cakewalk-text-tertiary">
                          {event.resourceId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(event.status) as any}>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={event.processingTime > 500 ? "text-cakewalk-warning" : ""}>
                        {event.processingTime}ms
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-cakewalk-text-secondary">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}