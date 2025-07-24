"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  AlertTriangle,
  ChevronRight,
  Eye,
} from "lucide-react"
import { formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns"

interface JourneyData {
  summary: {
    activeJourneys: number
    completedToday: number
    failedToday: number
    abandonedToday: number
    avgCompletionTime: number
    successRate: number
  }
  journeyTypes: Array<{
    name: string
    active: number
    completed: number
    failed: number
    abandoned: number
    avgDuration: number
    successRate: number
  }>
  activeJourneys: Array<{
    id: string
    type: string
    resourceId: string
    resourceType: string
    status: "active" | "stuck"
    progress: number
    currentStep: string
    startTime: Date
    estimatedCompletion?: Date
    riskFactors?: string[]
  }>
  stuckJourneys: Array<{
    id: string
    type: string
    resourceId: string
    lastActivity: Date
    stuckDuration: number
    currentStep: string
    recommendation: string
  }>
}

export const JourneyAnalytics: React.FC = () => {
  const [journeyTypeFilter, setJourneyTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null)
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null)

  useEffect(() => {
    fetchJourneyData()
  }, [journeyTypeFilter, statusFilter])

  const fetchJourneyData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/analytics/journeys?type=${journeyTypeFilter}&status=${statusFilter}`
      )
      if (response.ok) {
        const data = await response.json()
        setJourneyData(data)
      }
    } catch (error) {
      console.error("Failed to fetch journey data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-cakewalk-success"
      case "stuck":
        return "text-cakewalk-error"
      default:
        return "text-cakewalk-text-secondary"
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success"
      case "stuck":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const formatDurationMs = (ms: number) => {
    const duration = intervalToDuration({ start: 0, end: ms })
    if (duration.days && duration.days > 0) {
      return `${duration.days}d ${duration.hours}h`
    }
    if (duration.hours && duration.hours > 0) {
      return `${duration.hours}h ${duration.minutes}m`
    }
    return `${duration.minutes}m`
  }

  // Mock data for demonstration
  const mockData: JourneyData = {
    summary: {
      activeJourneys: 342,
      completedToday: 1250,
      failedToday: 45,
      abandonedToday: 23,
      avgCompletionTime: 3600000, // 1 hour in ms
      successRate: 94.5,
    },
    journeyTypes: [
      {
        name: "Customer Onboarding",
        active: 125,
        completed: 450,
        failed: 12,
        abandoned: 8,
        avgDuration: 1800000, // 30 minutes
        successRate: 95.2,
      },
      {
        name: "Transfer Process",
        active: 89,
        completed: 650,
        failed: 18,
        abandoned: 5,
        avgDuration: 900000, // 15 minutes
        successRate: 96.8,
      },
      {
        name: "Verification Flow",
        active: 78,
        completed: 120,
        failed: 10,
        abandoned: 7,
        avgDuration: 7200000, // 2 hours
        successRate: 88.9,
      },
      {
        name: "Micro-deposit Verification",
        active: 50,
        completed: 30,
        failed: 5,
        abandoned: 3,
        avgDuration: 172800000, // 48 hours
        successRate: 82.1,
      },
    ],
    activeJourneys: [
      {
        id: "journey-1",
        type: "Customer Onboarding",
        resourceId: "cust-123",
        resourceType: "customer",
        status: "active",
        progress: 75,
        currentStep: "Funding Source Verification",
        startTime: new Date(Date.now() - 1800000),
        estimatedCompletion: new Date(Date.now() + 900000),
      },
      {
        id: "journey-2",
        type: "Transfer Process",
        resourceId: "trans-456",
        resourceType: "transfer",
        status: "stuck",
        progress: 40,
        currentStep: "Processing",
        startTime: new Date(Date.now() - 3600000),
        riskFactors: ["Processing longer than expected", "Multiple retry attempts"],
      },
      {
        id: "journey-3",
        type: "Verification Flow",
        resourceId: "cust-789",
        resourceType: "customer",
        status: "stuck",
        progress: 60,
        currentStep: "Document Review",
        startTime: new Date(Date.now() - 7200000),
        riskFactors: ["No activity for 2 hours", "Manual review required"],
      },
    ],
    stuckJourneys: [
      {
        id: "journey-3",
        type: "Verification Flow",
        resourceId: "cust-789",
        lastActivity: new Date(Date.now() - 7200000),
        stuckDuration: 7200000,
        currentStep: "Document Review",
        recommendation: "Manual intervention required - check document upload status",
      },
      {
        id: "journey-4",
        type: "Micro-deposit Verification",
        resourceId: "cust-101",
        lastActivity: new Date(Date.now() - 86400000),
        stuckDuration: 86400000,
        currentStep: "Awaiting Deposit Confirmation",
        recommendation: "Send reminder to customer to verify micro-deposits",
      },
    ],
  }

  const data = journeyData || mockData

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2">
        <Select value={journeyTypeFilter} onValueChange={setJourneyTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Journey type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All journeys</SelectItem>
            <SelectItem value="onboarding">Customer Onboarding</SelectItem>
            <SelectItem value="transfer">Transfer Process</SelectItem>
            <SelectItem value="verification">Verification Flow</SelectItem>
            <SelectItem value="microdeposit">Micro-deposit Verification</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="stuck">Stuck</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Active Journeys
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-text-primary">
                {data.summary.activeJourneys}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-success">
                {data.summary.completedToday}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Failed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-error">
                {data.summary.failedToday}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Abandoned
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-warning">
                {data.summary.abandonedToday}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-text-primary">
                {formatDurationMs(data.summary.avgCompletionTime)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-cakewalk-medium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cakewalk-text-secondary">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-cakewalk-success">
                {data.summary.successRate}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journey Types Performance */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cakewalk-primary" />
            Journey Performance by Type
          </CardTitle>
          <CardDescription>Success rates and completion times</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))
            ) : (
              data.journeyTypes.map((journey) => (
                <div
                  key={journey.name}
                  className="rounded-lg border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-cakewalk-text-primary">{journey.name}</h4>
                      <div className="mt-1 flex items-center gap-4 text-sm text-cakewalk-text-secondary">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {journey.active} active
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDurationMs(journey.avgDuration)} avg
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-cakewalk-success">
                        {journey.successRate}%
                      </p>
                      <p className="text-xs text-cakewalk-text-tertiary">success rate</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress value={journey.successRate} className="h-2" />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs">
                    <span className="text-cakewalk-success">
                      <CheckCircle className="mr-1 inline h-3 w-3" />
                      {journey.completed} completed
                    </span>
                    <span className="text-cakewalk-error">
                      <XCircle className="mr-1 inline h-3 w-3" />
                      {journey.failed} failed
                    </span>
                    <span className="text-cakewalk-warning">
                      <AlertCircle className="mr-1 inline h-3 w-3" />
                      {journey.abandoned} abandoned
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Journeys Table */}
      <Card className="shadow-cakewalk-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cakewalk-primary" />
            Active Journeys
          </CardTitle>
          <CardDescription>Currently in-progress customer journeys</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journey Type</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Current Step</TableHead>
                <TableHead>Duration</TableHead>
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
                data.activeJourneys.map((journey) => (
                  <TableRow key={journey.id}>
                    <TableCell className="font-medium">{journey.type}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{journey.resourceType}</p>
                        <p className="text-xs text-cakewalk-text-tertiary">
                          {journey.resourceId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(journey.status) as any}>
                        {journey.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <Progress value={journey.progress} className="h-2" />
                        <p className="mt-1 text-xs text-cakewalk-text-tertiary">
                          {journey.progress}%
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{journey.currentStep}</p>
                        {journey.riskFactors && journey.riskFactors.length > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-cakewalk-warning" />
                            <p className="text-xs text-cakewalk-warning">
                              {journey.riskFactors.length} risk{journey.riskFactors.length > 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-cakewalk-text-secondary">
                      {formatDistanceToNow(journey.startTime, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedJourney(journey.id)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stuck Journeys Alert */}
      {data.stuckJourneys.length > 0 && (
        <Alert className="border-cakewalk-warning bg-cakewalk-warning/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">
              {data.stuckJourneys.length} journey{data.stuckJourneys.length > 1 ? "s" : ""} require attention
            </div>
            <div className="mt-2 space-y-2">
              {data.stuckJourneys.map((stuck) => (
                <div key={stuck.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{stuck.type}</span> - {stuck.resourceId}
                    <p className="text-xs text-cakewalk-text-tertiary mt-1">
                      {stuck.recommendation}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}