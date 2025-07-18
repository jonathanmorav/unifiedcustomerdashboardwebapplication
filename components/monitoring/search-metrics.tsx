"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ActivityIcon, AlertCircleIcon, CheckCircleIcon, ClockIcon, ZapIcon } from "lucide-react"

interface SearchMetricsProps {
  responseTime?: number
  hubspotStatus?: "healthy" | "degraded" | "error"
  dwollaStatus?: "healthy" | "degraded" | "error"
  errorRate?: number
  isRateLimited?: boolean
}

export function SearchMetrics({
  responseTime,
  hubspotStatus = "healthy",
  dwollaStatus = "healthy",
  errorRate = 0,
  isRateLimited = false,
}: SearchMetricsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircleIcon className="text-cakewalk-success h-4 w-4" />
      case "degraded":
        return <AlertCircleIcon className="text-cakewalk-warning h-4 w-4" />
      case "error":
        return <AlertCircleIcon className="text-cakewalk-error h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {/* Response Time */}
          <div className="flex items-center gap-2">
            <ClockIcon className="text-cakewalk-text-secondary h-4 w-4" />
            <div>
              <p className="text-cakewalk-text-secondary text-xs">Response</p>
              <p className="text-sm font-medium">{responseTime ? `${responseTime}ms` : "—"}</p>
            </div>
          </div>

          {/* HubSpot Status */}
          <div className="flex items-center gap-2">
            <ActivityIcon className="text-cakewalk-text-secondary h-4 w-4" />
            <div>
              <p className="text-cakewalk-text-secondary text-xs">HubSpot</p>
              <div className="flex items-center gap-1">
                {getStatusIcon(hubspotStatus)}
                <span className="text-sm font-medium capitalize">{hubspotStatus}</span>
              </div>
            </div>
          </div>

          {/* Dwolla Status */}
          <div className="flex items-center gap-2">
            <ActivityIcon className="text-cakewalk-text-secondary h-4 w-4" />
            <div>
              <p className="text-cakewalk-text-secondary text-xs">Dwolla</p>
              <div className="flex items-center gap-1">
                {getStatusIcon(dwollaStatus)}
                <span className="text-sm font-medium capitalize">{dwollaStatus}</span>
              </div>
            </div>
          </div>

          {/* Error Rate */}
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="text-cakewalk-text-secondary h-4 w-4" />
            <div>
              <p className="text-cakewalk-text-secondary text-xs">Error Rate</p>
              <p className={`text-sm font-medium ${errorRate > 5 ? "text-cakewalk-error" : ""}`}>
                {errorRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Rate Limit Status */}
          <div className="flex items-center gap-2">
            <ZapIcon className="text-cakewalk-text-secondary h-4 w-4" />
            <div>
              <p className="text-cakewalk-text-secondary text-xs">Rate Limit</p>
              {isRateLimited ? (
                <Badge variant="destructive" className="text-xs">
                  Limited
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  OK
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Performance indicator */}
        {responseTime && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-cakewalk-text-secondary">Performance</span>
              <Badge
                className={
                  responseTime < 1000
                    ? "bg-cakewalk-success/10 text-cakewalk-success"
                    : responseTime < 3000
                      ? "bg-cakewalk-warning/10 text-cakewalk-warning"
                      : "bg-cakewalk-error/10 text-cakewalk-error"
                }
              >
                {responseTime < 1000 ? "Excellent" : responseTime < 3000 ? "Good" : "Slow"}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
