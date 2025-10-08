"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Play, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  DollarSign,
  Users,
  Building2,
  Clock
} from 'lucide-react'
import { formatCurrency } from '@/utils/format-currency'
import { getAllCarriers } from '@/lib/reconciliation/policy-carrier-mapping'
import type { 
  ReconciliationJobResponse, 
  ReconciliationReport,
  ValidationResult,
  CarrierRemittanceFile 
} from '@/lib/types/reconciliation'

interface ReconciliationTabProps {
  className?: string
}

// Helper functions moved outside component
const getStatusBadge = (status: string) => {
  const variants = {
    pending: { variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
    running: { variant: "secondary" as const, icon: RefreshCw, color: "text-blue-600" },
    completed: { variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
    failed: { variant: "destructive" as const, icon: XCircle, color: "text-red-600" }
  }

  const config = variants[status as keyof typeof variants] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${config.color}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleString()
}

export function ReconciliationTab({ className = "" }: ReconciliationTabProps) {
  const [jobs, setJobs] = useState<ReconciliationJobResponse[]>([])
  const [currentJob, setCurrentJob] = useState<ReconciliationJobResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for starting new reconciliation
  const [billingPeriod, setBillingPeriod] = useState('')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [selectedCarrier, setSelectedCarrier] = useState<string>('')

  const carriers = getAllCarriers()

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    // Auto-refresh running jobs every 5 seconds
    const interval = setInterval(() => {
      if (jobs.some(job => job.status === 'running' || job.status === 'pending')) {
        fetchJobs()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobs])

  const fetchJobs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/reconciliation/premium')
      const data = await response.json()

      if (response.ok) {
        setJobs(data.jobs || [])
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch reconciliation jobs')
      }
    } catch (err) {
      setError('Network error while fetching jobs')
    } finally {
      setIsLoading(false)
    }
  }

  const startReconciliation = async () => {
    if (!billingPeriod.trim()) {
      setError('Billing period is required')
      return
    }

    try {
      setIsRunning(true)
      setError(null)

      const requestBody: any = {
        billingPeriod: billingPeriod.trim()
      }

      if (dateRange.start && dateRange.end) {
        requestBody.dateRange = {
          start: dateRange.start,
          end: dateRange.end
        }
      }

      const response = await fetch('/api/reconciliation/premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (response.ok) {
        setCurrentJob(data)
        fetchJobs() // Refresh job list
        
        // Reset form
        setBillingPeriod('')
        setDateRange({ start: '', end: '' })
      } else {
        setError(data.error || 'Failed to start reconciliation')
      }
    } catch (err) {
      setError('Network error while starting reconciliation')
    } finally {
      setIsRunning(false)
    }
  }

  const downloadCarrierFile = async (jobId: string, carrier: string) => {
    try {
      const response = await fetch(`/api/reconciliation/premium/export?jobId=${jobId}&carrier=${carrier}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${carrier}_remittance_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        setError('Failed to download carrier file')
      }
    } catch (err) {
      setError('Network error while downloading file')
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cakewalk-text-primary">Premium Reconciliation</h2>
          <p className="text-cakewalk-text-secondary mt-1">
            Reconcile processed payments with policy premiums and generate carrier remittance reports
          </p>
        </div>
        <Button onClick={fetchJobs} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Start New Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Start New Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="billingPeriod">Billing Period *</Label>
              <Input
                id="billingPeriod"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
                placeholder="e.g., 2024-01"
                disabled={isRunning}
              />
            </div>
            <div>
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                disabled={isRunning}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                disabled={isRunning}
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button 
              onClick={startReconciliation} 
              disabled={isRunning || !billingPeriod.trim()}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Reconciliation
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reconciliation Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-cakewalk-text-secondary" />
              <span className="ml-2 text-cakewalk-text-secondary">Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-cakewalk-text-secondary">
              No reconciliation jobs found. Start your first reconciliation above.
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.jobId}
                  job={job}
                  onDownload={downloadCarrierFile}
                  onSelect={() => setCurrentJob(job)}
                  isSelected={currentJob?.jobId === job.jobId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details */}
      {currentJob && currentJob.report && (
        <ReportDetails 
          job={currentJob} 
          onDownload={downloadCarrierFile}
        />
      )}
    </div>
  )
}

interface JobCardProps {
  job: ReconciliationJobResponse
  onDownload: (jobId: string, carrier: string) => void
  onSelect: () => void
  isSelected: boolean
}

function JobCard({ job, onDownload, onSelect, isSelected }: JobCardProps) {
  const config = (job as any).config || {}
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-cakewalk-primary' : 'hover:shadow-md'}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {config.billingPeriod || 'Unknown Period'}
              </span>
              {getStatusBadge(job.status)}
            </div>
            <p className="text-sm text-cakewalk-text-secondary">
              Started: {formatDate(job.startedAt)}
              {job.completedAt && ` • Completed: ${formatDate(job.completedAt)}`}
            </p>
            {job.report && (
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(job.report.totalCollected)}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {job.report.totalAccountsProcessed} accounts
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {job.report.reconciliationSummary.totalEmployeesCovered} employees
                </span>
              </div>
            )}
          </div>
          
          {job.status === 'running' && (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-600">Processing...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ReportDetailsProps {
  job: ReconciliationJobResponse
  onDownload: (jobId: string, carrier: string) => void
}

function ReportDetails({ job, onDownload }: ReportDetailsProps) {
  const { report, validationResult } = job
  if (!report) return null

  return (
    <div className="space-y-6">
      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {validationResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                  {validationResult.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription>{error.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
              
              {validationResult.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-600 mb-2">Warnings:</h4>
                  {validationResult.warnings.map((warning, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {validationResult.isValid && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>All validations passed successfully.</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Total Collected</p>
                <p className="text-lg font-semibold">{formatCurrency(report.totalCollected)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Accounts Processed</p>
                <p className="text-lg font-semibold">{report.totalAccountsProcessed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Employees Covered</p>
                <p className="text-lg font-semibold">{report.reconciliationSummary.totalEmployeesCovered}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Total Policies</p>
                <p className="text-lg font-semibold">{report.reconciliationSummary.totalPolicies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Remittances */}
      <Card>
        <CardHeader>
          <CardTitle>Carrier Remittances</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Total Due</TableHead>
                <TableHead>Policy Types</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.carrierRemittances.map((carrier) => (
                <TableRow key={carrier.carrier}>
                  <TableCell className="font-medium">{carrier.carrier}</TableCell>
                  <TableCell>{formatCurrency(carrier.totalDue)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {carrier.policyDetails.map((policy) => (
                        <Badge key={policy.policyType} variant="outline" className="text-xs">
                          {policy.policyType} ({policy.count})
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownload(job.jobId, carrier.carrier)}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Export
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}