"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, Database, Globe, Server, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"

interface HealthData {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: ComponentHealth
    hubspot: ComponentHealth
    dwolla: ComponentHealth
    memory: ComponentHealth
  }
}

interface ComponentHealth {
  status: "up" | "down" | "degraded"
  responseTime?: number
  message?: string
  details?: Record<string, any>
}

export function SystemStatus() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/health")
      if (!response.ok) {
        throw new Error("Failed to fetch health data")
      }
      const data = await response.json()
      setHealth(data)
      setError(null)
    } catch (err) {
      setError("Failed to load system status")
      toast.error("Failed to load system status")
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: "up" | "down" | "degraded") => {
    switch (status) {
      case "up":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case "down":
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusBadge = (status: "healthy" | "degraded" | "unhealthy") => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500">Healthy</Badge>
      case "degraded":
        return <Badge className="bg-yellow-500">Degraded</Badge>
      case "unhealthy":
        return <Badge className="bg-red-500">Unhealthy</Badge>
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)

    return parts.join(" ") || "< 1m"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            {error || "No data available"}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          {getStatusBadge(health.status)}
        </div>
        <div className="text-sm text-muted-foreground">
          Version {health.version} • Uptime: {formatUptime(health.uptime)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Database Status */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5" />
            <div>
              <div className="font-medium">Database</div>
              <div className="text-sm text-muted-foreground">{health.checks.database.message}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health.checks.database.responseTime && (
              <span className="text-sm text-muted-foreground">
                {health.checks.database.responseTime}ms
              </span>
            )}
            {getStatusIcon(health.checks.database.status)}
          </div>
        </div>

        {/* HubSpot Status */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5" />
            <div>
              <div className="font-medium">HubSpot API</div>
              <div className="text-sm text-muted-foreground">{health.checks.hubspot.message}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health.checks.hubspot.responseTime && (
              <span className="text-sm text-muted-foreground">
                {health.checks.hubspot.responseTime}ms
              </span>
            )}
            {getStatusIcon(health.checks.hubspot.status)}
          </div>
        </div>

        {/* Dwolla Status */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5" />
            <div>
              <div className="font-medium">Dwolla API</div>
              <div className="text-sm text-muted-foreground">{health.checks.dwolla.message}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health.checks.dwolla.responseTime && (
              <span className="text-sm text-muted-foreground">
                {health.checks.dwolla.responseTime}ms
              </span>
            )}
            {getStatusIcon(health.checks.dwolla.status)}
          </div>
        </div>

        {/* Memory Status */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5" />
            <div>
              <div className="font-medium">Memory</div>
              <div className="text-sm text-muted-foreground">{health.checks.memory.message}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health.checks.memory.details && (
              <span className="text-sm text-muted-foreground">
                {health.checks.memory.details.heapUsed}MB / {health.checks.memory.details.heapTotal}
                MB ({health.checks.memory.details.percentUsed}%)
              </span>
            )}
            {getStatusIcon(health.checks.memory.status)}
          </div>
        </div>

        {/* Last Updated */}
        <div className="pt-2 text-center text-xs text-muted-foreground">
          Last updated: {new Date(health.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
