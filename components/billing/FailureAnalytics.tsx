"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Info,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronRight
} from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { getCategoryDisplayName } from "@/lib/api/dwolla/return-codes"
import { FailedTransactionsModal } from "./FailedTransactionsModal"

interface FailureAnalyticsProps {
  dateRange?: {
    from: Date
    to: Date
  }
}

interface AnalyticsData {
  summary: {
    totalTransactions: number
    failedTransactions: number
    failureRate: number
    totalFailedAmount: number
    totalSuccessfulAmount: number
  }
  topFailures: Array<{
    returnCode: string
    count: number
    totalAmount: number
    returnCodeInfo: {
      title: string
      description: string
      category: string
      categoryDisplay: string
      retryable: boolean
    }
  }>
  retryableFailures: any[]
  nonRetryableFailures: any[]
  categoryBreakdown: Array<{
    category: string
    displayName: string
    count: number
    totalAmount: number
    codes: Array<{ code: string; count: number }>
  }>
}

export const FailureAnalytics: React.FC<FailureAnalyticsProps> = ({ dateRange }) => {
  const [showTransactionsModal, setShowTransactionsModal] = useState(false)
  const [transactionFilter, setTransactionFilter] = useState<{
    type: 'returnCode' | 'category' | 'retryable' | 'nonRetryable'
    value: string
  } | undefined>()
  
  // Sample data for demo
  const sampleData: AnalyticsData = {
    summary: {
      totalTransactions: 1250,
      failedTransactions: 45,
      failureRate: 3.6,
      totalFailedAmount: 125400,
      totalSuccessfulAmount: 3456789
    },
    topFailures: [
      {
        returnCode: "R01",
        count: 15,
        totalAmount: 45230,
        returnCodeInfo: {
          title: "Insufficient Funds",
          description: "Available balance is not sufficient to cover the debit entry",
          category: "funding",
          categoryDisplay: "Funding Issues",
          retryable: true
        }
      },
      {
        returnCode: "R02",
        count: 8,
        totalAmount: 28900,
        returnCodeInfo: {
          title: "Account Closed",
          description: "Previously active account has been closed by customer or RDFI",
          category: "account",
          categoryDisplay: "Account Issues",
          retryable: false
        }
      },
      {
        returnCode: "R03",
        count: 6,
        totalAmount: 18600,
        returnCodeInfo: {
          title: "No Account/Unable to Locate",
          description: "Account number structure is valid but does not pass validation",
          category: "account",
          categoryDisplay: "Account Issues",
          retryable: false
        }
      },
      {
        returnCode: "R07",
        count: 5,
        totalAmount: 12340,
        returnCodeInfo: {
          title: "Authorization Revoked by Customer",
          description: "Customer revoked authorization previously provided",
          category: "authorization",
          categoryDisplay: "Authorization Issues",
          retryable: false
        }
      },
      {
        returnCode: "R10",
        count: 4,
        totalAmount: 8900,
        returnCodeInfo: {
          title: "Customer Advises Not Authorized",
          description: "Customer claims the debit was not authorized",
          category: "authorization",
          categoryDisplay: "Authorization Issues",
          retryable: false
        }
      }
    ],
    retryableFailures: [
      {
        returnCode: "R01",
        count: 15,
        totalAmount: 45230,
        returnCodeInfo: {
          title: "Insufficient Funds",
          description: "Available balance is not sufficient to cover the debit entry",
          category: "funding",
          categoryDisplay: "Funding Issues",
          retryable: true,
          userAction: "Check account balance and retry when funds are available"
        }
      },
      {
        returnCode: "R09",
        count: 3,
        totalAmount: 5430,
        returnCodeInfo: {
          title: "Uncollected Funds",
          description: "Sufficient balance exists but funds are not yet collected",
          category: "funding",
          categoryDisplay: "Funding Issues",
          retryable: true,
          userAction: "Wait for funds to clear (typically 2-5 business days) then retry"
        }
      }
    ],
    nonRetryableFailures: [
      {
        returnCode: "R02",
        count: 8,
        totalAmount: 28900,
        returnCodeInfo: {
          title: "Account Closed",
          description: "Previously active account has been closed",
          category: "account",
          categoryDisplay: "Account Issues",
          retryable: false,
          userAction: "Obtain new account information from customer immediately"
        }
      },
      {
        returnCode: "R07",
        count: 5,
        totalAmount: 12340,
        returnCodeInfo: {
          title: "Authorization Revoked by Customer",
          description: "Customer revoked authorization",
          category: "authorization",
          categoryDisplay: "Authorization Issues",
          retryable: false,
          userAction: "Stop debiting this account immediately. Update customer status."
        }
      },
      {
        returnCode: "R16",
        count: 2,
        totalAmount: 3200,
        returnCodeInfo: {
          title: "Account Frozen",
          description: "Account is frozen due to legal action or OFAC match",
          category: "compliance",
          categoryDisplay: "Compliance/Legal",
          retryable: false,
          userAction: "Do not retry - account is under legal restriction. Consult legal/compliance."
        }
      }
    ],
    categoryBreakdown: [
      {
        category: "account",
        displayName: "Account Issues",
        count: 14,
        totalAmount: 47500,
        codes: [
          { code: "R02", count: 8 },
          { code: "R03", count: 6 }
        ]
      },
      {
        category: "funding",
        displayName: "Funding Issues",
        count: 18,
        totalAmount: 50660,
        codes: [
          { code: "R01", count: 15 },
          { code: "R09", count: 3 }
        ]
      },
      {
        category: "authorization",
        displayName: "Authorization Issues",
        count: 9,
        totalAmount: 21240,
        codes: [
          { code: "R07", count: 5 },
          { code: "R10", count: 4 }
        ]
      },
      {
        category: "compliance",
        displayName: "Compliance/Legal",
        count: 2,
        totalAmount: 3200,
        codes: [
          { code: "R16", count: 2 }
        ]
      },
      {
        category: "data",
        displayName: "Data/Format Errors",
        count: 2,
        totalAmount: 2800,
        codes: [
          { code: "R04", count: 1 },
          { code: "R13", count: 1 }
        ]
      }
    ]
  }

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(sampleData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Use sample data for now
    // fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (dateRange?.from) {
        params.append("startDate", dateRange.from.toISOString())
      }
      if (dateRange?.to) {
        params.append("endDate", dateRange.to.toISOString())
      }
      params.append("groupBy", "category")
      params.append("includeTrends", "false")
      
      const response = await fetch(`/api/ach/analytics/failures?${params}`)
      if (!response.ok) {
        const errorData = await response.json()
        console.error("Analytics API error:", response.status, errorData)
        throw new Error(errorData.details || `Failed to fetch analytics: ${response.status}`)
      }
      
      const data = await response.json()
      setAnalytics(data)
    } catch (err) {
      console.error("Analytics error:", err)
      setError("Failed to load failure analytics")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || "Unable to load failure analytics"}
        </AlertDescription>
      </Alert>
    )
  }

  const { summary, topFailures, retryableFailures, nonRetryableFailures, categoryBreakdown } = analytics

  // Determine failure rate status
  const getFailureRateStatus = (rate: number) => {
    if (rate < 1) return { color: "text-green-600", icon: CheckCircle, label: "Excellent" }
    if (rate < 3) return { color: "text-yellow-600", icon: AlertTriangle, label: "Normal" }
    return { color: "text-red-600", icon: AlertCircle, label: "High" }
  }

  const failureRateStatus = getFailureRateStatus(summary.failureRate)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Failure Rate</CardTitle>
            <CardDescription className="text-xs">
              Failed transactions vs total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div>
                <span className={`text-2xl font-bold ${failureRateStatus.color}`}>
                  {summary.failureRate}%
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <failureRateStatus.icon className={`h-3 w-3 ${failureRateStatus.color}`} />
                  <span className={`text-xs ${failureRateStatus.color}`}>
                    {failureRateStatus.label}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {summary.failedTransactions.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  of {summary.totalTransactions.toLocaleString()}
                </p>
              </div>
            </div>
            <Progress 
              value={summary.failureRate} 
              className="mt-3 h-2"
              indicatorClassName={
                summary.failureRate < 1 ? "bg-green-500" :
                summary.failureRate < 3 ? "bg-yellow-500" : "bg-red-500"
              }
            />
            {summary.failedTransactions > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 w-full justify-between"
                onClick={() => {
                  setTransactionFilter(undefined)
                  setShowTransactionsModal(true)
                }}
              >
                View all failed transactions
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Failed Amount</CardTitle>
            <CardDescription className="text-xs">
              Total value of failed transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalFailedAmount)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              vs {formatCurrency(summary.totalSuccessfulAmount)} successful
            </p>
            <div className="mt-3 text-xs">
              <span className="text-gray-600">Impact: </span>
              <span className="font-medium">
                {((summary.totalFailedAmount / (summary.totalFailedAmount + summary.totalSuccessfulAmount)) * 100).toFixed(1)}%
              </span>
              <span className="text-gray-600"> of total volume</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Retry Opportunity</CardTitle>
            <CardDescription className="text-xs">
              Transactions that can be retried
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {retryableFailures.length}
                </p>
                <p className="text-xs text-gray-500">
                  Worth {formatCurrency(
                    retryableFailures.reduce((sum, f) => sum + f.totalAmount, 0)
                  )}
                </p>
              </div>
            </div>
            {retryableFailures.length > 0 && (
              <>
                <Alert className="mt-3 border-blue-200 bg-blue-50 p-2">
                  <Info className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    Consider implementing automatic retry logic
                  </AlertDescription>
                </Alert>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full justify-between"
                  onClick={() => {
                    setTransactionFilter({ type: 'retryable', value: 'true' })
                    setShowTransactionsModal(true)
                  }}
                >
                  View retryable transactions
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown && categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Failures by Category</CardTitle>
            <CardDescription>
              Grouped by failure type to identify patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryBreakdown.map((category) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category.displayName}</span>
                      <Badge variant="outline" className="text-xs">
                        {category.count} failures
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-600">
                      {formatCurrency(category.totalAmount)}
                    </span>
                  </div>
                  <div className="ml-4 flex flex-wrap gap-1">
                    {category.codes.slice(0, 5).map((code) => (
                      <Badge 
                        key={code.code} 
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-gray-200"
                        onClick={() => {
                          setTransactionFilter({ type: 'returnCode', value: code.code })
                          setShowTransactionsModal(true)
                        }}
                      >
                        {code.code} ({code.count})
                      </Badge>
                    ))}
                    {category.codes.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{category.codes.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Return Codes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Return Codes</CardTitle>
            <CardDescription>
              Most common failure reasons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topFailures.slice(0, 5).map((failure, idx) => (
                <div key={failure.returnCode} className="space-y-1">
                  <div 
                    className="flex items-start justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded"
                    onClick={() => {
                      setTransactionFilter({ type: 'returnCode', value: failure.returnCode })
                      setShowTransactionsModal(true)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {failure.returnCode}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">
                          {failure.returnCodeInfo.title}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {failure.returnCodeInfo.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{failure.count}</p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(failure.totalAmount)}
                      </p>
                    </div>
                  </div>
                  {idx < topFailures.length - 1 && <div className="border-b" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Action Required</CardTitle>
            <CardDescription>
              Non-retryable failures needing attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nonRetryableFailures.length === 0 ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  No critical failures requiring immediate action
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {nonRetryableFailures.slice(0, 5).map((failure) => (
                  <div 
                    key={failure.returnCode} 
                    className="rounded-md border border-red-200 bg-red-50 p-3 cursor-pointer hover:border-red-300"
                    onClick={() => {
                      setTransactionFilter({ type: 'returnCode', value: failure.returnCode })
                      setShowTransactionsModal(true)
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            {failure.returnCode}
                          </Badge>
                          <span className="text-sm font-medium">
                            {failure.count} transactions
                          </span>
                        </div>
                        <p className="text-xs text-gray-700">
                          {failure.returnCodeInfo.userAction}
                        </p>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Required Summary Bar */}
      {nonRetryableFailures.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-900">
                    {nonRetryableFailures.reduce((sum, f) => sum + f.count, 0)} transactions require immediate attention
                  </p>
                  <p className="text-sm text-orange-700">
                    These failures cannot be automatically retried and need manual review
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => {
                  setTransactionFilter({ type: 'nonRetryable', value: 'true' })
                  setShowTransactionsModal(true)
                }}
              >
                Review Now
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Transactions Modal */}
      <FailedTransactionsModal
        isOpen={showTransactionsModal}
        onClose={() => setShowTransactionsModal(false)}
        filter={transactionFilter}
      />
    </div>
  )
}