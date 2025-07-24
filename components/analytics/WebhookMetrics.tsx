"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  Users,
  RefreshCw,
} from "lucide-react"

interface WebhookMetrics {
  totalEvents: number
  eventsPerMinute: number
  processingRate: number
  avgLatency: number
  errorRate: number
  activeJourneys: number
  journeySuccessRate: number
  pendingReconciliations: number
  activeAnomalies: number
}

interface WebhookMetricsProps {
  metrics: WebhookMetrics | null
  isLoading?: boolean
}

interface MetricCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: "default" | "success" | "warning" | "danger"
  isLoading?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = "default",
  isLoading = false,
}) => {
  const colorClasses = {
    default: "text-cakewalk-text-primary",
    success: "text-cakewalk-success",
    warning: "text-cakewalk-warning",
    danger: "text-cakewalk-error",
  }

  return (
    <Card className="shadow-cakewalk-medium transition-shadow hover:shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-cakewalk-text-secondary">
          {title}
          {icon && <span className="text-cakewalk-text-tertiary">{icon}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
            {trend && (
              <div className="mt-1 flex items-center">
                {trend.isPositive ? (
                  <TrendingUp className="mr-1 h-4 w-4 text-cakewalk-success" />
                ) : (
                  <TrendingDown className="mr-1 h-4 w-4 text-cakewalk-error" />
                )}
                <span
                  className={`text-xs ${
                    trend.isPositive ? "text-cakewalk-success" : "text-cakewalk-error"
                  }`}
                >
                  {trend.isPositive ? "+" : ""}
                  {trend.value}%
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export const WebhookMetrics: React.FC<WebhookMetricsProps> = ({ metrics, isLoading = false }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatLatency = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`
    }
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Events"
        value={formatNumber(metrics?.totalEvents || 0)}
        icon={<Activity className="h-4 w-4" />}
        color="default"
        isLoading={isLoading}
      />

      <MetricCard
        title="Events/Min"
        value={formatNumber(metrics?.eventsPerMinute || 0)}
        icon={<Zap className="h-4 w-4" />}
        color="default"
        isLoading={isLoading}
        trend={{
          value: 12.5,
          isPositive: true,
        }}
      />

      <MetricCard
        title="Processing Rate"
        value={`${metrics?.processingRate || 0}%`}
        icon={<CheckCircle className="h-4 w-4" />}
        color={metrics?.processingRate && metrics.processingRate >= 95 ? "success" : "warning"}
        isLoading={isLoading}
      />

      <MetricCard
        title="Avg Latency"
        value={formatLatency(metrics?.avgLatency || 0)}
        icon={<Clock className="h-4 w-4" />}
        color={metrics?.avgLatency && metrics.avgLatency > 1000 ? "warning" : "success"}
        isLoading={isLoading}
      />

      <MetricCard
        title="Error Rate"
        value={`${metrics?.errorRate || 0}%`}
        icon={<XCircle className="h-4 w-4" />}
        color={metrics?.errorRate && metrics.errorRate > 5 ? "danger" : "success"}
        isLoading={isLoading}
        trend={{
          value: 0.5,
          isPositive: false,
        }}
      />

      <MetricCard
        title="Active Journeys"
        value={formatNumber(metrics?.activeJourneys || 0)}
        icon={<Users className="h-4 w-4" />}
        color="default"
        isLoading={isLoading}
      />

      <MetricCard
        title="Pending Reconciliations"
        value={formatNumber(metrics?.pendingReconciliations || 0)}
        icon={<RefreshCw className="h-4 w-4" />}
        color={metrics?.pendingReconciliations && metrics.pendingReconciliations > 10 ? "warning" : "default"}
        isLoading={isLoading}
      />

      <MetricCard
        title="Active Anomalies"
        value={formatNumber(metrics?.activeAnomalies || 0)}
        icon={<AlertCircle className="h-4 w-4" />}
        color={metrics?.activeAnomalies && metrics.activeAnomalies > 0 ? "danger" : "success"}
        isLoading={isLoading}
      />
    </div>
  )
}