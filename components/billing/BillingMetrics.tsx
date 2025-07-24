"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/utils/format-currency"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react"

interface BillingMetrics {
  totalVolume: number
  successRate: number
  pendingAmount: number
  failedAmount: number
  todayCount: number
  averageTransaction: number
  processedAmount?: number
  returnedAmount?: number
  totalFees?: number
  netAmount?: number
}

interface BillingMetricsProps {
  metrics: BillingMetrics
  isLoading?: boolean
  compactView?: boolean
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
                <span className={`text-xs ${trend.isPositive ? "text-cakewalk-success" : "text-cakewalk-error"}`}>
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

export const BillingMetrics: React.FC<BillingMetricsProps> = ({
  metrics,
  isLoading = false,
  compactView = false,
}) => {
  // Calculate additional metrics
  const failureRate = metrics.successRate ? (100 - metrics.successRate).toFixed(1) : "0"

  const primaryMetrics = [
    {
      title: "Total Volume",
      value: formatCurrency(metrics.totalVolume),
      icon: <DollarSign className="h-4 w-4" />,
      color: "default" as const,
    },
    {
      title: "Success Rate",
      value: `${metrics.successRate}%`,
      icon: <CheckCircle className="h-4 w-4" />,
      color: "success" as const,
      trend: { value: 2.5, isPositive: true }, // Mock trend data
    },
    {
      title: "Pending",
      value: formatCurrency(metrics.pendingAmount),
      icon: <Clock className="h-4 w-4" />,
      color: "warning" as const,
    },
    {
      title: "Failed",
      value: formatCurrency(metrics.failedAmount),
      icon: <XCircle className="h-4 w-4" />,
      color: "danger" as const,
    },
    {
      title: "Today's Activity",
      value: metrics.todayCount,
      icon: <Activity className="h-4 w-4" />,
      color: "default" as const,
    },
    {
      title: "Avg Transaction",
      value: formatCurrency(metrics.averageTransaction),
      icon: <TrendingUp className="h-4 w-4" />,
      color: "default" as const,
    },
  ]

  const secondaryMetrics = [
    {
      title: "Processed",
      value: formatCurrency(metrics.processedAmount || 0),
      color: "success" as const,
    },
    {
      title: "Returned",
      value: formatCurrency(metrics.returnedAmount || 0),
      color: "warning" as const,
    },
    {
      title: "Total Fees",
      value: formatCurrency(metrics.totalFees || 0),
      color: "default" as const,
    },
    {
      title: "Net Amount",
      value: formatCurrency(metrics.netAmount || metrics.totalVolume),
      color: "default" as const,
    },
  ]

  if (compactView) {
    // Show only primary metrics in compact view
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {primaryMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} isLoading={isLoading} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Primary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {primaryMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} isLoading={isLoading} />
        ))}
      </div>

      {/* Secondary Metrics - Optional expanded view */}
      {!compactView && metrics.processedAmount !== undefined && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {secondaryMetrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} isLoading={isLoading} />
          ))}
        </div>
      )}

      {/* Alert Section */}
      {!isLoading && metrics.failedAmount > 0 && (
        <Card className="border-cakewalk-error bg-cakewalk-error-light dark:border-cakewalk-error dark:bg-cakewalk-error-light">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-cakewalk-error" />
              <div>
                <p className="text-sm font-medium text-cakewalk-error">
                  Failed Transactions Alert
                </p>
                <p className="text-sm text-cakewalk-error">
                  {failureRate}% of transactions failed today. Review failed transactions for
                  potential issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
