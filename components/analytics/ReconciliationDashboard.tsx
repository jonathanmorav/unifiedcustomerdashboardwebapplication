"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  PlayCircle,
  AlertTriangle,
  ChevronRight,
  Info,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ReconciliationData {
  summary: {
    lastRunTime: Date
    lastRunStatus: "completed" | "running" | "failed"
    totalChecks: number
    discrepanciesFound: number
    discrepanciesResolved: number
    pendingResolution: number
    errorRate: number
    autoResolveRate: number
  }
  recentRuns: Array<{
    id: string
    startTime: Date
    endTime?: Date
    status: "completed" | "running" | "failed"
    checksPerformed: number
    discrepanciesFound: number
    discrepanciesResolved: number
    errorRate: number
  }>
  activeDiscrepancies: Array<{
    id: string
    resourceType: string
    resourceId: string
    checkName: string
    severity: "low" | "medium" | "high" | "critical"
    details: {
      field: string
      expected: any
      actual: any
    }
    detectedAt: Date
    autoResolvable: boolean
  }>
  recommendations: Array<{
    type: "warning" | "info" | "error"
    message: string
    action?: string
  }>
}

export const ReconciliationDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState("7d")
  const [isLoading, setIsLoading] = useState(true)
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    fetchReconciliationData()
  }, [timeRange])

  const fetchReconciliationData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/reconciliation?hours=${timeRange === "7d" ? 168 : 24}`)
      if (response.ok) {
        const data = await response.json()
        setReconciliationData(data)
      }
    } catch (error) {
      console.error("Failed to fetch reconciliation data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRunReconciliation = async () => {
    setIsRunning(true)
    try {
      const response = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRun: true }),
      })
      if (response.ok) {
        await fetchReconciliationData()
      }
    } catch (error) {
      console.error("Failed to run reconciliation:", error)
    } finally {
      setIsRunning(false)
    }
  }

  const handleResolveDiscrepancy = async (discrepancyId: string, resolution: string) => {
    try {
      const response = await fetch(`/api/reconciliation/discrepancies/${discrepancyId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution: { type: resolution } }),
      })
      if (response.ok) {
        await fetchReconciliationData()
      }
    } catch (error) {
      console.error("Failed to resolve discrepancy:", error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-cakewalk-error"
      case "high":
        return "text-orange-600"
      case "medium":
        return "text-cakewalk-warning"
      case "low":
        return "text-blue-600"
      default:
        return "text-cakewalk-text-secondary"
    }
  }

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "destructive"
      case "medium":
        return "warning"
      case "low":
        return "secondary"
      default:
        return "default"
    }
  }

  // Mock data for demonstration
  const mockData: ReconciliationData = {
    summary: {
      lastRunTime: new Date(Date.now() - 3600000),
      lastRunStatus: "completed",
      totalChecks: 15420,
      discrepanciesFound: 42,
      discrepanciesResolved: 38,
      pendingResolution: 4,
      errorRate: 0.27,
      autoResolveRate: 90.5,
    },
    recentRuns: [
      {
        id: "run-1",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 3300000),
        status: "completed",
        checksPerformed: 15420,
        discrepanciesFound: 42,
        discrepanciesResolved: 38,
        errorRate: 0.27,
      },
      {
        id: "run-2",
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 6900000),
        status: "completed",
        checksPerformed: 14850,
        discrepanciesFound: 35,
        discrepanciesResolved: 35,
        errorRate: 0.24,
      },
      {
        id: "run-3",
        startTime: new Date(Date.now() - 10800000),
        endTime: new Date(Date.now() - 10500000),
        status: "completed",
        checksPerformed: 15100,
        discrepanciesFound: 48,
        discrepanciesResolved: 45,
        errorRate: 0.32,
      },
    ],
    activeDiscrepancies: [
      {
        id: "disc-1",
        resourceType: "transfer",
        resourceId: "tr-123456",
        checkName: "amount_match",
        severity: "critical",
        details: {
          field: "amount",
          expected: 1250.00,
          actual: 1255.00,
        },
        detectedAt: new Date(Date.now() - 1800000),
        autoResolvable: false,
      },
      {
        id: "disc-2",
        resourceType: "transfer",
        resourceId: "tr-789012",
        checkName: "status_match",
        severity: "medium",
        details: {
          field: "status",
          expected: "completed",
          actual: "processing",
        },
        detectedAt: new Date(Date.now() - 2400000),
        autoResolvable: true,
      },
      {
        id: "disc-3",
        resourceType: "customer",
        resourceId: "cust-345678",
        checkName: "metadata_match",
        severity: "low",
        details: {
          field: "metadata.verified",
          expected: true,
          actual: false,
        },
        detectedAt: new Date(Date.now() - 3000000),
        autoResolvable: true,
      },
      {
        id: "disc-4",
        resourceType: "transfer",
        resourceId: "tr-901234",
        checkName: "existence",
        severity: "high",
        details: {
          field: "existence",
          expected: "exists",
          actual: "not_found",
        },
        detectedAt: new Date(Date.now() - 3600000),
        autoResolvable: false,
      },
    ],
    recommendations: [
      {
        type: "warning",
        message: "Error rate increased by 15% compared to last week",
        action: "Review recent system changes",
      },
      {
        type: "info",
        message: "90.5% of discrepancies were automatically resolved",
        action: "Consider enabling auto-resolution for more check types",
      },
      {
        type: "error",
        message: "4 critical discrepancies require immediate attention",
        action: "Review and resolve critical issues",
      },
    ],
  }

  const data = reconciliationData || mockData

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReconciliationData()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleRunReconciliation}
            disabled={isRunning || data.summary.lastRunStatus === "running"}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Run Reconciliation
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Last Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-sm font-medium text-cakewalk-text-primary">
                  {formatDistanceToNow(data.summary.lastRunTime, { addSuffix: true })}
                </p>
                <Badge
                  variant={data.summary.lastRunStatus === "completed" ? "success" : "destructive"}
                  className="mt-1"
                >
                  {data.summary.lastRunStatus}
                </Badge>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Error Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold text-cakewalk-text-primary">
                  {data.summary.errorRate}%
                </p>
                <Progress
                  value={100 - data.summary.errorRate}
                  className="mt-2 h-2"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Pending Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={`text-2xl font-bold ${
                data.summary.pendingResolution > 0 ? "text-cakewalk-warning" : "text-cakewalk-success"
              }`}>
                {data.summary.pendingResolution}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Auto-Resolve Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-success">
                {data.summary.autoResolveRate}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="space-y-2">
          {data.recommendations.map((rec, index) => (
            <Alert
              key={index}
              className={`${
                rec.type === "error"
                  ? "border-cakewalk-error bg-cakewalk-error/10"
                  : rec.type === "warning"
                  ? "border-cakewalk-warning bg-cakewalk-warning/10"
                  : "border-cakewalk-info bg-cakewalk-info/10"
              }`}
            >
              {rec.type === "error" ? (
                <AlertCircle className="h-4 w-4" />
              ) : rec.type === "warning" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertTitle className="text-sm font-medium">{rec.message}</AlertTitle>
              {rec.action && (
                <AlertDescription className="text-sm">{rec.action}</AlertDescription>
              )}
            </Alert>
          ))}
        </div>
      )}

      {/* Active Discrepancies */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-cakewalk-primary" />
            Active Discrepancies
          </CardTitle>
          <CardDescription>Issues requiring resolution</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data.activeDiscrepancies.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-cakewalk-text-secondary">
              <CheckCircle className="mr-2 h-5 w-5 text-cakewalk-success" />
              No active discrepancies
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activeDiscrepancies.map((discrepancy) => (
                  <TableRow key={discrepancy.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{discrepancy.resourceType}</p>
                        <p className="text-xs text-cakewalk-text-tertiary">
                          {discrepancy.resourceId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{discrepancy.checkName}</TableCell>
                    <TableCell>
                      <Badge variant={getSeverityBadgeVariant(discrepancy.severity) as any}>
                        {discrepancy.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>
                          <span className="text-cakewalk-text-secondary">Field:</span>{" "}
                          {discrepancy.details.field}
                        </p>
                        <p>
                          <span className="text-cakewalk-text-secondary">Expected:</span>{" "}
                          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
                            {JSON.stringify(discrepancy.details.expected)}
                          </code>
                        </p>
                        <p>
                          <span className="text-cakewalk-text-secondary">Actual:</span>{" "}
                          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
                            {JSON.stringify(discrepancy.details.actual)}
                          </code>
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-cakewalk-text-secondary">
                      {formatDistanceToNow(discrepancy.detectedAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {discrepancy.autoResolvable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveDiscrepancy(discrepancy.id, "auto")}
                        >
                          Auto-Resolve
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveDiscrepancy(discrepancy.id, "manual")}
                        >
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cakewalk-primary" />
            Recent Reconciliation Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checks</TableHead>
                <TableHead>Discrepancies</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Error Rate</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                data.recentRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(run.startTime, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "success"
                            : run.status === "running"
                            ? "warning"
                            : "destructive"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {run.checksPerformed.toLocaleString()}
                    </TableCell>
                    <TableCell>{run.discrepanciesFound}</TableCell>
                    <TableCell className="text-cakewalk-success">
                      {run.discrepanciesResolved}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          run.errorRate > 0.5
                            ? "text-cakewalk-error"
                            : run.errorRate > 0.2
                            ? "text-cakewalk-warning"
                            : "text-cakewalk-success"
                        }
                      >
                        {run.errorRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Download className="mr-1 h-4 w-4" />
                        Report
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