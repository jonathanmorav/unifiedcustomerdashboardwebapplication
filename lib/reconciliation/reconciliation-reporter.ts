import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { ReconciliationJob, ReconciliationCheck, ReconciliationDiscrepancy } from '@prisma/client'

// Define proper interface for reconciliation metrics
interface ReconciliationMetrics {
  totalChecks: number
  discrepanciesFound: number
  discrepanciesResolved: number
  [key: string]: any // Allow for additional properties
}

interface ReconciliationReport {
  summary: {
    runId: string
    startTime: Date
    endTime: Date
    duration: number
    status: string
    totalChecks: number
    totalDiscrepancies: number
    resolvedDiscrepancies: number
    unresolvedDiscrepancies: number
    criticalIssues: number
    errorRate: number
  }
  discrepanciesByType: Record<string, number>
  discrepanciesBySeverity: Record<string, number>
  topIssues: Array<{
    checkName: string
    count: number
    severity: string
    examples: Array<{
      resourceId: string
      details: any
    }>
  }>
  trends: {
    discrepancyRate: number
    comparisonToPrevious: number
    resolutionRate: number
  }
  recommendations: string[]
}

export class ReconciliationReporter {
  async generateReport(runId: string): Promise<ReconciliationReport> {
    const run = await prisma.reconciliationJob.findUnique({
      where: { id: runId }
    })
    
    if (!run) {
      throw new Error('Reconciliation run not found')
    }
    
    const metrics = (run.results as ReconciliationMetrics) || {}
    const duration = run.completedAt 
      ? run.completedAt.getTime() - (run.startedAt?.getTime() || run.createdAt.getTime())
      : Date.now() - (run.startedAt?.getTime() || run.createdAt.getTime())
    
    // Calculate summary
    const summary = {
      runId: run.id,
      startTime: run.startedAt || run.createdAt,
      endTime: run.completedAt || new Date(),
      duration,
      status: run.status,
      totalChecks: metrics.totalChecks || 0,
      totalDiscrepancies: metrics.discrepanciesFound || 0,
      resolvedDiscrepancies: metrics.discrepanciesResolved || 0,
      unresolvedDiscrepancies: (metrics.discrepanciesFound || 0) - (metrics.discrepanciesResolved || 0),
      criticalIssues: 0, // Severity field not available in current schema
      errorRate: metrics.totalChecks > 0 
        ? ((metrics.discrepanciesFound || 0) / metrics.totalChecks) * 100
        : 0
    }
    
    // Get discrepancies from checks related to this job
    const checks = await prisma.reconciliationCheck.findMany({
      where: {
        metadata: {
          path: ['jobId'],
          equals: runId
        }
      },
      include: {
        discrepancies: true
      }
    })
    
    const allDiscrepancies = checks.flatMap(check => check.discrepancies)
    
    // Group discrepancies
    const discrepanciesByType = this.groupByField(allDiscrepancies, 'resourceType')
    const discrepanciesBySeverity: Record<string, number> = {}
    
    // Get top issues
    const topIssues = this.getTopIssues(allDiscrepancies)
    
    // Calculate trends
    const trends = await this.calculateTrends(run)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, topIssues, trends)
    
    return {
      summary,
      discrepanciesByType,
      discrepanciesBySeverity,
      topIssues,
      trends,
      recommendations
    }
  }
  
  private groupByField(
    discrepancies: ReconciliationDiscrepancy[],
    field: keyof ReconciliationDiscrepancy
  ): Record<string, number> {
    const grouped: Record<string, number> = {}
    
    for (const discrepancy of discrepancies) {
      const key = String(discrepancy[field])
      grouped[key] = (grouped[key] || 0) + 1
    }
    
    return grouped
  }
  
  private getTopIssues(
    discrepancies: ReconciliationDiscrepancy[]
  ): ReconciliationReport['topIssues'] {
    // Group by check name
    const issueGroups = new Map<string, ReconciliationDiscrepancy[]>()
    
    for (const discrepancy of discrepancies) {
      const key = discrepancy.resourceType
      if (!issueGroups.has(key)) {
        issueGroups.set(key, [])
      }
      issueGroups.get(key)!.push(discrepancy)
    }
    
    // Convert to array and sort by count
    const topIssues = Array.from(issueGroups.entries())
      .map(([checkName, items]) => ({
        checkName,
        count: items.length,
        severity: 'unknown', // Severity not available in current schema
        examples: items.slice(0, 3).map(item => ({
          resourceId: item.resourceId,
          details: item.notes || ''
        }))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10
    
    return topIssues
  }
  
  private async calculateTrends(
    currentRun: ReconciliationJob & { discrepancies?: any[] }
  ): Promise<ReconciliationReport['trends']> {
    // Get previous run
    const previousRun = await prisma.reconciliationJob.findFirst({
      where: {
        id: { not: currentRun.id },
        startedAt: { lt: currentRun.startedAt || currentRun.createdAt },
        status: 'completed'
      },
      orderBy: { startedAt: 'desc' }
    })
    
    const currentMetrics = (currentRun.results as ReconciliationMetrics) || {}
    const previousMetrics = (previousRun?.results as ReconciliationMetrics) || {}
    
    // Calculate current discrepancy rate
    const currentDiscrepancyRate = currentMetrics.totalChecks > 0
      ? (currentMetrics.discrepanciesFound / currentMetrics.totalChecks) * 100
      : 0
    
    // Calculate previous discrepancy rate
    const previousDiscrepancyRate = previousMetrics?.totalChecks > 0
      ? (previousMetrics.discrepanciesFound / previousMetrics.totalChecks) * 100
      : 0
    
    // Calculate resolution rate
    const resolutionRate = currentMetrics.discrepanciesFound > 0
      ? (currentMetrics.discrepanciesResolved / currentMetrics.discrepanciesFound) * 100
      : 100
    
    return {
      discrepancyRate: currentDiscrepancyRate,
      comparisonToPrevious: currentDiscrepancyRate - previousDiscrepancyRate,
      resolutionRate
    }
  }
  
  private generateRecommendations(
    summary: ReconciliationReport['summary'],
    topIssues: ReconciliationReport['topIssues'],
    trends: ReconciliationReport['trends']
  ): string[] {
    const recommendations: string[] = []
    
    // High error rate
    if (summary.errorRate > 5) {
      recommendations.push(
        `High discrepancy rate detected (${summary.errorRate.toFixed(2)}%). Investigate webhook delivery issues or system synchronization delays.`
      )
    }
    
    // Critical issues
    if (summary.criticalIssues > 0) {
      recommendations.push(
        `${summary.criticalIssues} critical issues require immediate attention. Review amount mismatches and missing resources.`
      )
    }
    
    // Low resolution rate
    if (trends.resolutionRate < 80) {
      recommendations.push(
        `Resolution rate is ${trends.resolutionRate.toFixed(2)}%. Consider enabling auto-resolution for more check types.`
      )
    }
    
    // Increasing trend
    if (trends.comparisonToPrevious > 2) {
      recommendations.push(
        'Discrepancy rate is increasing. Review recent system changes and webhook processing performance.'
      )
    }
    
    // Specific issue recommendations
    for (const issue of topIssues.slice(0, 3)) {
      if (issue.count > 10) {
        recommendations.push(
          `"${issue.checkName}" check is failing frequently (${issue.count} times). Consider implementing specific handling for this issue.`
        )
      }
    }
    
    // Status mismatch issues
    const statusMismatches = topIssues.find(i => i.checkName.includes('status'))
    if (statusMismatches && statusMismatches.count > 5) {
      recommendations.push(
        'Multiple status mismatches detected. Ensure webhook events are processed in order and consider implementing event sequencing.'
      )
    }
    
    return recommendations
  }
  
  async generateComparisonReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    runs: number
    totalDiscrepancies: number
    avgDiscrepancyRate: number
    resolutionRate: number
    topRecurringIssues: Array<{
      issue: string
      occurrences: number
      runs: number
    }>
    performanceTrend: Array<{
      date: Date
      discrepancyRate: number
      resolutionRate: number
    }>
  }> {
    // Get all runs in date range
    const runs = await prisma.reconciliationJob.findMany({
      where: {
        startedAt: { gte: startDate, lte: endDate },
        status: 'completed'
      },
      orderBy: { startedAt: 'asc' }
    })
    
    // Calculate aggregates
    let totalChecks = 0
    let totalDiscrepancies = 0
    let totalResolved = 0
    const issueOccurrences = new Map<string, { count: number; runs: Set<string> }>()
    const performanceTrend: Array<{
      date: Date
      discrepancyRate: number
      resolutionRate: number
    }> = []
    
    for (const run of runs) {
      const metrics = (run.results as ReconciliationMetrics) || {}
      totalChecks += metrics.totalChecks || 0
      totalDiscrepancies += metrics.discrepanciesFound || 0
      totalResolved += metrics.discrepanciesResolved || 0
      
      // Get discrepancies for this run
      const runChecks = await prisma.reconciliationCheck.findMany({
        where: {
          metadata: {
            path: ['jobId'],
            equals: run.id
          }
        },
        include: {
          discrepancies: true
        }
      })
      
      const runDiscrepancies = runChecks.flatMap(check => check.discrepancies)
      
      // Track recurring issues
      for (const discrepancy of runDiscrepancies) {
        const key = `${discrepancy.resourceType}:${discrepancy.field}`
        if (!issueOccurrences.has(key)) {
          issueOccurrences.set(key, { count: 0, runs: new Set() })
        }
        const occurrence = issueOccurrences.get(key)!
        occurrence.count++
        occurrence.runs.add(run.id)
      }
      
      // Track performance trend
      const discrepancyRate = metrics.totalChecks > 0
        ? (metrics.discrepanciesFound / metrics.totalChecks) * 100
        : 0
      const resolutionRate = metrics.discrepanciesFound > 0
        ? (metrics.discrepanciesResolved / metrics.discrepanciesFound) * 100
        : 100
      
      performanceTrend.push({
        date: run.startedAt || run.createdAt,
        discrepancyRate,
        resolutionRate
      })
    }
    
    // Calculate averages
    const avgDiscrepancyRate = totalChecks > 0
      ? (totalDiscrepancies / totalChecks) * 100
      : 0
    const overallResolutionRate = totalDiscrepancies > 0
      ? (totalResolved / totalDiscrepancies) * 100
      : 100
    
    // Get top recurring issues
    const topRecurringIssues = Array.from(issueOccurrences.entries())
      .map(([issue, data]) => ({
        issue,
        occurrences: data.count,
        runs: data.runs.size
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10)
    
    return {
      runs: runs.length,
      totalDiscrepancies,
      avgDiscrepancyRate,
      resolutionRate: overallResolutionRate,
      topRecurringIssues,
      performanceTrend
    }
  }
  
  async exportReportToCSV(runId: string): Promise<string> {
    const report = await this.generateReport(runId)
    const run = await prisma.reconciliationJob.findUnique({
      where: { id: runId }
    })
    
    // Get discrepancies from checks
    const checks = await prisma.reconciliationCheck.findMany({
      where: {
        metadata: {
          path: ['jobId'],
          equals: runId
        }
      },
      include: {
        discrepancies: true
      }
    })
    
    const allDiscrepancies = checks.flatMap(check => check.discrepancies)
    
    if (!run) {
      throw new Error('Run not found')
    }
    
    // Build CSV content
    const lines: string[] = []
    
    // Header
    lines.push('Reconciliation Report')
    lines.push(`Run ID: ${report.summary.runId}`)
    lines.push(`Date: ${report.summary.startTime.toISOString()}`)
    lines.push(`Status: ${report.summary.status}`)
    lines.push('')
    
    // Summary
    lines.push('Summary')
    lines.push('Metric,Value')
    lines.push(`Total Checks,${report.summary.totalChecks}`)
    lines.push(`Total Discrepancies,${report.summary.totalDiscrepancies}`)
    lines.push(`Resolved,${report.summary.resolvedDiscrepancies}`)
    lines.push(`Unresolved,${report.summary.unresolvedDiscrepancies}`)
    lines.push(`Critical Issues,${report.summary.criticalIssues}`)
    lines.push(`Error Rate,${report.summary.errorRate.toFixed(2)}%`)
    lines.push('')
    
    // Discrepancies by Severity
    lines.push('Discrepancies by Severity')
    lines.push('Severity,Count')
    for (const [severity, count] of Object.entries(report.discrepanciesBySeverity)) {
      lines.push(`${severity},${count}`)
    }
    lines.push('')
    
    // Top Issues
    lines.push('Top Issues')
    lines.push('Check Name,Count,Severity')
    for (const issue of report.topIssues) {
      lines.push(`"${issue.checkName}",${issue.count},${issue.severity}`)
    }
    lines.push('')
    
    // Detailed Discrepancies
    lines.push('Detailed Discrepancies')
    lines.push('Resource Type,Resource ID,Check Name,Severity,Field,Webhook Value,Actual Value,Resolved')
    
    for (const discrepancy of allDiscrepancies) {
      lines.push([
        discrepancy.resourceType,
        discrepancy.resourceId,
        discrepancy.checkId,
        'unknown', // severity not available
        discrepancy.field || '',
        discrepancy.dwollaValue || '',
        discrepancy.localValue || '',
        discrepancy.resolved ? 'Yes' : 'No'
      ].map(v => `"${v}"`).join(','))
    }
    
    return lines.join('\n')
  }
}

// Singleton instance
let reporter: ReconciliationReporter | null = null

export function getReconciliationReporter(): ReconciliationReporter {
  if (!reporter) {
    reporter = new ReconciliationReporter()
  }
  return reporter
}