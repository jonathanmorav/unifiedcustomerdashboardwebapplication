"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Eye,
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
  onMetricClick?: (filterType: 'processed' | 'pending' | 'failed') => void
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
  onClick?: () => void
  clickable?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = "default",
  isLoading = false,
  onClick,
  clickable = false,
}) => {
  const colorClasses = {
    default: "text-cakewalk-text-primary",
    success: "text-cakewalk-success",
    warning: "text-cakewalk-warning",
    danger: "text-cakewalk-error",
  }

  const CardComponent = clickable ? Button : Card
  const cardProps = clickable ? {
    variant: "ghost" as const,
    className: "w-full h-auto p-0 shadow-cakewalk-medium transition-shadow hover:shadow-lg",
    onClick,
  } : {
    className: "shadow-cakewalk-medium transition-shadow hover:shadow-lg",
  }

  return (
    <CardComponent {...cardProps}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-cakewalk-text-secondary">
          {title}
          {clickable && <Eye className="h-4 w-4 text-cakewalk-text-tertiary" />}
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
    </CardComponent>
  )
}

export const BillingMetrics: React.FC<BillingMetricsProps> = ({
  metrics,
  isLoading = false,
  compactView = false,
  onMetricClick,
}) => {
  // If compactView and onMetricClick provided, show the three main KPIs
  if (compactView && onMetricClick) {
    const kpiMetrics = [
      {
        title: "Total Processed",
        value: formatCurrency(metrics.processedAmount || 0),
        icon: <CheckCircle className="h-5 w-5" />,
        color: "success" as const,
        filterType: 'processed' as const,
      },
      {
        title: "Total Pending", 
        value: formatCurrency(metrics.pendingAmount),
        icon: <Clock className="h-5 w-5" />,
        color: "warning" as const,
        filterType: 'pending' as const,
      },
      {
        title: "Failed",
        value: formatCurrency(metrics.failedAmount),
        icon: <XCircle className="h-5 w-5" />,
        color: "danger" as const,
        filterType: 'failed' as const,
      },
    ]

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpiMetrics.map((metric) => (
          <MetricCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            color={metric.color}
            isLoading={isLoading}
            clickable={true}
            onClick={() => onMetricClick(metric.filterType)}
          />
        ))}
      </div>
    )
  }

  // Original metrics display for non-compact view
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
                  {(100 - metrics.successRate).toFixed(1)}% of transactions failed today. Review failed transactions for
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
