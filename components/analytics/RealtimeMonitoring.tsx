"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Activity,
  AlertCircle,
  Zap,
  Pause,
  Play,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface RealtimeEvent {
  id: string
  eventType: string
  resourceType: string
  resourceId: string
  status: "success" | "processing" | "failed"
  timestamp: Date
  processingTime?: number
  metadata?: Record<string, any>
}

interface RealtimeAnomaly {
  id: string
  type: "threshold" | "pattern" | "deviation"
  severity: "low" | "medium" | "high" | "critical"
  metric: string
  value: number
  expectedRange: { min: number; max: number }
  message: string
  timestamp: Date
}

interface RealtimeMetrics {
  eventsPerSecond: number
  avgLatency: number
  errorRate: number
  activeConnections: number
  queueDepth: number
  throughput: {
    current: number
    trend: "up" | "down" | "stable"
    change: number
  }
}

export const RealtimeMonitoring: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [eventFilter, setEventFilter] = useState("all")
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [anomalies, setAnomalies] = useState<RealtimeAnomaly[]>([])
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    eventsPerSecond: 0,
    avgLatency: 0,
    errorRate: 0,
    activeConnections: 0,
    queueDepth: 0,
    throughput: {
      current: 0,
      trend: "stable",
      change: 0,
    },
  })
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventStreamRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!isPaused) {
      connectToEventStream()
    } else {
      disconnectEventStream()
    }

    return () => {
      disconnectEventStream()
    }
  }, [isPaused])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, autoScroll])

  const connectToEventStream = () => {
    // In production, this would connect to a real SSE endpoint
    // For demo, we'll simulate real-time events
    simulateRealtimeEvents()
  }

  const disconnectEventStream = () => {
    if (eventStreamRef.current) {
      eventStreamRef.current.close()
      eventStreamRef.current = null
    }
  }

  const simulateRealtimeEvents = () => {
    const interval = setInterval(() => {
      if (isPaused) {
        clearInterval(interval)
        return
      }

      // Simulate new events
      const newEvent: RealtimeEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventType: [
          "transfer_created",
          "transfer_completed",
          "customer_created",
          "customer_verified",
          "transfer_failed",
        ][Math.floor(Math.random() * 5)],
        resourceType: ["transfer", "customer", "funding_source"][Math.floor(Math.random() * 3)],
        resourceId: `res-${Math.random().toString(36).substr(2, 9)}`,
        status: Math.random() > 0.9 ? "failed" : Math.random() > 0.7 ? "processing" : "success",
        timestamp: new Date(),
        processingTime: Math.floor(Math.random() * 200) + 50,
      }

      setEvents((prev) => [...prev.slice(-50), newEvent]) // Keep last 50 events

      // Update metrics
      setMetrics((prev) => ({
        eventsPerSecond: Math.random() * 50 + 20,
        avgLatency: Math.floor(Math.random() * 50) + 80,
        errorRate: Math.random() * 5,
        activeConnections: Math.floor(Math.random() * 20) + 10,
        queueDepth: Math.floor(Math.random() * 100),
        throughput: {
          current: Math.random() * 1000 + 500,
          trend: Math.random() > 0.5 ? "up" : Math.random() > 0.3 ? "down" : "stable",
          change: Math.random() * 20 - 10,
        },
      }))

      // Occasionally add anomalies
      if (Math.random() > 0.95) {
        const newAnomaly: RealtimeAnomaly = {
          id: `anom-${Date.now()}`,
          type: ["threshold", "pattern", "deviation"][Math.floor(Math.random() * 3)] as any,
          severity: ["low", "medium", "high", "critical"][Math.floor(Math.random() * 4)] as any,
          metric: ["error_rate", "latency", "throughput"][Math.floor(Math.random() * 3)],
          value: Math.random() * 100,
          expectedRange: { min: 0, max: 50 },
          message: "Anomaly detected in system metrics",
          timestamp: new Date(),
        }
        setAnomalies((prev) => [newAnomaly, ...prev.slice(0, 4)]) // Keep last 5 anomalies
      }
    }, 500) // Generate events every 500ms

    // Store interval reference for cleanup
    eventStreamRef.current = { close: () => clearInterval(interval) } as any
  }

  const getEventIcon = (eventType: string) => {
    if (eventType.includes("failed")) return <XCircle className="h-4 w-4 text-cakewalk-error" />
    if (eventType.includes("processing")) return <Clock className="h-4 w-4 text-cakewalk-warning" />
    return <CheckCircle className="h-4 w-4 text-cakewalk-success" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-cakewalk-success"
      case "processing":
        return "text-cakewalk-warning"
      case "failed":
        return "text-cakewalk-error"
      default:
        return "text-cakewalk-text-secondary"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-cakewalk-error text-white"
      case "high":
        return "bg-orange-500 text-white"
      case "medium":
        return "bg-cakewalk-warning text-white"
      case "low":
        return "bg-blue-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const filteredEvents = events.filter((event) => {
    if (eventFilter === "all") return true
    if (eventFilter === "errors") return event.status === "failed"
    if (eventFilter === "processing") return event.status === "processing"
    return event.eventType.includes(eventFilter)
  })

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
            />
            <Label htmlFor="auto-scroll" className="text-sm">
              Auto-scroll
            </Label>
          </div>

          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="errors">Errors only</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="transfer">Transfers</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm text-cakewalk-text-secondary">
          <Activity className="h-4 w-4" />
          <span className={isPaused ? "text-cakewalk-warning" : "text-cakewalk-success"}>
            {isPaused ? "Paused" : "Live"}
          </span>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Events/sec
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cakewalk-text-primary">
              {metrics.eventsPerSecond.toFixed(1)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cakewalk-text-primary">
              {metrics.avgLatency}ms
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Error Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${
              metrics.errorRate > 5 ? "text-cakewalk-error" : "text-cakewalk-success"
            }`}>
              {metrics.errorRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cakewalk-text-primary">
              {metrics.activeConnections}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-cakewalk-text-primary">
                {metrics.throughput.current.toFixed(0)}
              </p>
              {metrics.throughput.trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-cakewalk-success" />
              ) : metrics.throughput.trend === "down" ? (
                <TrendingDown className="h-4 w-4 text-cakewalk-error" />
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <Card className="shadow-cakewalk-medium border-cakewalk-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cakewalk-warning">
              <AlertTriangle className="h-5 w-5" />
              Active Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.map((anomaly) => (
                <Alert
                  key={anomaly.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={getSeverityColor(anomaly.severity)}>
                      {anomaly.severity}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{anomaly.message}</p>
                      <p className="text-xs text-cakewalk-text-tertiary">
                        {anomaly.metric}: {anomaly.value.toFixed(2)} (expected: {anomaly.expectedRange.min}-{anomaly.expectedRange.max})
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-cakewalk-text-tertiary">
                    {formatDistanceToNow(anomaly.timestamp, { addSuffix: true })}
                  </span>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Stream */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-cakewalk-primary" />
            Live Event Stream
          </CardTitle>
          <CardDescription>
            Real-time webhook events ({filteredEvents.length} events)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-md border p-4" ref={scrollRef}>
            <div className="space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-cakewalk-text-secondary">
                  {isPaused ? "Stream paused" : "No events matching filter"}
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      {getEventIcon(event.eventType)}
                      <div>
                        <p className="text-sm font-medium">{event.eventType}</p>
                        <p className="text-xs text-cakewalk-text-tertiary">
                          {event.resourceType} • {event.resourceId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {event.processingTime && (
                        <span className="text-xs text-cakewalk-text-secondary">
                          {event.processingTime}ms
                        </span>
                      )}
                      <Badge
                        variant={
                          event.status === "success"
                            ? "success"
                            : event.status === "failed"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {event.status}
                      </Badge>
                      <span className="text-xs text-cakewalk-text-tertiary">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}