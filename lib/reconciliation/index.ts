import { getReconciliationEngine } from './reconciliation-engine'
import { getReconciliationReporter } from './reconciliation-reporter'
import { getBatchReconciler } from './batch-reconciler'
import { log } from '@/lib/logger'

// Export all reconciliation services
export {
  getReconciliationEngine,
  getReconciliationReporter,
  getBatchReconciler
}

// Initialize reconciliation services
export function initializeReconciliationServices(): void {
  try {
    // Get service instances
    const engine = getReconciliationEngine()
    const reporter = getReconciliationReporter()
    const batchReconciler = getBatchReconciler()
    
    // Schedule regular reconciliation jobs
    if (process.env.ENABLE_SCHEDULED_RECONCILIATION === 'true') {
      engine.scheduleReconciliations()
      
      // Schedule real-time reconciliation every 5 minutes
      setInterval(() => {
        batchReconciler.performRealtimeReconciliation(5).catch(error => {
          log.error('Real-time reconciliation failed', error)
        })
      }, 5 * 60 * 1000)
      
      log.info('Reconciliation services initialized with scheduling')
    } else {
      log.info('Reconciliation services initialized (scheduling disabled)')
    }
    
  } catch (error) {
    log.error('Failed to initialize reconciliation services', error as Error)
  }
}

// Types for external use
export type ReconciliationConfig = {
  name: string
  resourceType: 'transfer' | 'customer' | 'funding_source'
  schedule: 'hourly' | 'daily' | 'on_demand'
  lookbackHours: number
}

export type ReconciliationReport = {
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

export type BatchReconciliationConfig = {
  batchSize: number
  parallelWorkers: number
  retryAttempts: number
  timeoutMs: number
}

export type DiscrepancyResolution = {
  type: 'accept_webhook' | 'accept_actual' | 'manual_override'
  details?: any
}