'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/format-currency';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface BillingMetrics {
  totalVolume: number;
  successRate: number;
  pendingAmount: number;
  failedAmount: number;
  todayCount: number;
  averageTransaction: number;
  processedAmount?: number;
  returnedAmount?: number;
  totalFees?: number;
  netAmount?: number;
}

interface BillingMetricsProps {
  metrics: BillingMetrics;
  isLoading?: boolean;
  compactView?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'default' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'default',
  isLoading = false,
}) => {
  const colorClasses = {
    default: 'text-gray-900 dark:text-white',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400',
  };

  return (
    <Card className="shadow-cakewalk-medium hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center justify-between">
          {title}
          {icon && <span className="text-gray-400">{icon}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>
              {value}
            </p>
            {trend && (
              <div className="flex items-center mt-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const BillingMetrics: React.FC<BillingMetricsProps> = ({
  metrics,
  isLoading = false,
  compactView = false,
}) => {
  // Calculate additional metrics
  const failureRate = metrics.successRate ? (100 - metrics.successRate).toFixed(1) : '0';
  
  const primaryMetrics = [
    {
      title: 'Total Volume',
      value: formatCurrency(metrics.totalVolume),
      icon: <DollarSign className="h-4 w-4" />,
      color: 'default' as const,
    },
    {
      title: 'Success Rate',
      value: `${metrics.successRate}%`,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'success' as const,
      trend: { value: 2.5, isPositive: true }, // Mock trend data
    },
    {
      title: 'Pending',
      value: formatCurrency(metrics.pendingAmount),
      icon: <Clock className="h-4 w-4" />,
      color: 'warning' as const,
    },
    {
      title: 'Failed',
      value: formatCurrency(metrics.failedAmount),
      icon: <XCircle className="h-4 w-4" />,
      color: 'danger' as const,
    },
    {
      title: "Today's Activity",
      value: metrics.todayCount,
      icon: <Activity className="h-4 w-4" />,
      color: 'default' as const,
    },
    {
      title: 'Avg Transaction',
      value: formatCurrency(metrics.averageTransaction),
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'default' as const,
    },
  ];

  const secondaryMetrics = [
    {
      title: 'Processed',
      value: formatCurrency(metrics.processedAmount || 0),
      color: 'success' as const,
    },
    {
      title: 'Returned',
      value: formatCurrency(metrics.returnedAmount || 0),
      color: 'warning' as const,
    },
    {
      title: 'Total Fees',
      value: formatCurrency(metrics.totalFees || 0),
      color: 'default' as const,
    },
    {
      title: 'Net Amount',
      value: formatCurrency(metrics.netAmount || metrics.totalVolume),
      color: 'default' as const,
    },
  ];

  if (compactView) {
    // Show only primary metrics in compact view
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {primaryMetrics.map((metric) => (
          <MetricCard
            key={metric.title}
            {...metric}
            isLoading={isLoading}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {primaryMetrics.map((metric) => (
          <MetricCard
            key={metric.title}
            {...metric}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Secondary Metrics - Optional expanded view */}
      {!compactView && metrics.processedAmount !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {secondaryMetrics.map((metric) => (
            <MetricCard
              key={metric.title}
              {...metric}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Alert Section */}
      {!isLoading && metrics.failedAmount > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Failed Transactions Alert
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {failureRate}% of transactions failed today. Review failed transactions for potential issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};