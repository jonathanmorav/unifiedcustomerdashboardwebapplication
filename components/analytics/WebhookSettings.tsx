"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle,
  Link,
  Copy,
  Plus,
  Pause,
  Play,
  Trash2,
  Calendar,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface WebhookSubscription {
  id: string
  url: string
  created: string
  paused: boolean
}

interface WebhookSyncData {
  subscriptions: WebhookSubscription[]
  recentActivity: Array<{
    eventType: string
    _count: number
  }>
  webhookUrl: string
}

export const WebhookSettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncData, setSyncData] = useState<WebhookSyncData | null>(null)
  const [syncTimeRange, setSyncTimeRange] = useState("24h")
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  })

  useEffect(() => {
    fetchWebhookStatus()
  }, [])

  const fetchWebhookStatus = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/webhooks/dwolla/sync")
      if (response.ok) {
        const data = await response.json()
        setSyncData(data)
      }
    } catch (error) {
      console.error("Failed to fetch webhook status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      let startDate: string | undefined
      let endDate: string | undefined

      if (syncTimeRange === "custom") {
        startDate = customDateRange.start
        endDate = customDateRange.end
      } else {
        const now = new Date()
        endDate = now.toISOString()
        
        switch (syncTimeRange) {
          case "1h":
            startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
            break
          case "24h":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
            break
          case "7d":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
            break
          case "30d":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            break
        }
      }

      const response = await fetch("/api/webhooks/dwolla/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          limit: 500,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSyncResult({
          type: "success",
          message: result.message || `Successfully synced ${result.summary.processed} webhook events`,
        })
        await fetchWebhookStatus()
      } else {
        setSyncResult({
          type: "error",
          message: result.error || "Failed to sync webhook events",
        })
      }
    } catch (error) {
      setSyncResult({
        type: "error",
        message: "An error occurred while syncing webhook events",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleCopyWebhookUrl = () => {
    if (syncData?.webhookUrl) {
      navigator.clipboard.writeText(syncData.webhookUrl)
      // You could add a toast notification here
    }
  }

  const handleToggleSubscription = async (subscriptionId: string, currentlyPaused: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/dwolla/subscription/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !currentlyPaused }),
      })

      if (response.ok) {
        await fetchWebhookStatus()
      }
    } catch (error) {
      console.error("Failed to toggle subscription:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-cakewalk-medium">
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-cakewalk-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-cakewalk-primary" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure your webhook endpoint to receive real-time events from Dwolla
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Webhook Endpoint URL</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={syncData?.webhookUrl || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-cakewalk-text-tertiary">
                Add this URL to your Dwolla webhook subscriptions
              </p>
            </div>

            {/* Active Subscriptions */}
            <div>
              <Label>Active Subscriptions</Label>
              <div className="mt-2 space-y-2">
                {syncData?.subscriptions.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p>No webhook subscriptions found.</p>
                        <p className="text-sm">To create one:</p>
                        <ol className="list-decimal list-inside text-sm space-y-1 ml-2">
                          <li>Log in to your Dwolla dashboard</li>
                          <li>Navigate to Applications → Webhooks</li>
                          <li>Create a subscription with the URL above</li>
                          <li>Set a webhook secret (save it for DWOLLA_WEBHOOK_SECRET)</li>
                        </ol>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  syncData?.subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{sub.url}</p>
                        <p className="text-xs text-cakewalk-text-tertiary">
                          Created {formatDistanceToNow(new Date(sub.created), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sub.paused ? "secondary" : "success"}>
                          {sub.paused ? "Paused" : "Active"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSubscription(sub.id, sub.paused)}
                        >
                          {sub.paused ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Historical Webhooks */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-cakewalk-primary" />
            Sync Historical Webhooks
          </CardTitle>
          <CardDescription>
            Import historical webhook events from Dwolla for analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Time Range</Label>
                <Select value={syncTimeRange} onValueChange={setSyncTimeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last hour</SelectItem>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {syncTimeRange === "custom" && (
                <>
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="datetime-local"
                      value={customDateRange.start}
                      onChange={(e) =>
                        setCustomDateRange({ ...customDateRange, start: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="datetime-local"
                      value={customDateRange.end}
                      onChange={(e) =>
                        setCustomDateRange({ ...customDateRange, end: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
            </div>

            {syncResult && (
              <Alert
                className={
                  syncResult.type === "success"
                    ? "border-cakewalk-success bg-cakewalk-success/10"
                    : "border-cakewalk-error bg-cakewalk-error/10"
                }
              >
                {syncResult.type === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{syncResult.message}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Webhook Events"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {syncData?.recentActivity && syncData.recentActivity.length > 0 && (
        <Card className="shadow-cakewalk-medium">
          <CardHeader>
            <CardTitle>Recent Webhook Activity (Last 24 Hours)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncData.recentActivity.map((activity) => (
                <div
                  key={activity.eventType}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{activity.eventType}</span>
                  <Badge variant="secondary">{activity._count} events</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}