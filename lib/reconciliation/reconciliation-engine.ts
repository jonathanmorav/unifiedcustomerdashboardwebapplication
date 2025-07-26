import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { WebhookEvent, ReconciliationRun, ReconciliationDiscrepancy } from '@prisma/client'
import { DwollaClient } from '@/lib/api/dwolla/client'

interface ReconciliationConfig {
  name: string
  resourceType: 'transfer' | 'customer' | 'funding_source'
  schedule: 'hourly' | 'daily' | 'on_demand'
  lookbackHours: number
  checks: ReconciliationCheck[]
}

interface ReconciliationCheck {
  name: string
  type: 'existence' | 'status' | 'amount' | 'metadata'
  severity: 'low' | 'medium' | 'high' | 'critical'
  autoResolve?: boolean
}

interface DiscrepancyDetail {
  field: string
  webhookValue: any
  actualValue: any
  difference?: any
}

// Define reconciliation configurations
const RECONCILIATION_CONFIGS: ReconciliationConfig[] = [
  {
    name: 'transfer_status_reconciliation',
    resourceType: 'transfer',
    schedule: 'hourly',
    lookbackHours: 2,
    checks: [
      {
        name: 'transfer_exists',
        type: 'existence',
        severity: 'critical'
      },
      {
        name: 'transfer_status_match',
        type: 'status',
        severity: 'high',
        autoResolve: true
      },
      {
        name: 'transfer_amount_match',
        type: 'amount',
        severity: 'critical'
      }
    ]
  },
  {
    name: 'customer_state_reconciliation',
    resourceType: 'customer',
    schedule: 'daily',
    lookbackHours: 24,
    checks: [
      {
        name: 'customer_exists',
        type: 'existence',
        severity: 'high'
      },
      {
        name: 'customer_status_match',
        type: 'status',
        severity: 'medium',
        autoResolve: true
      },
      {
        name: 'customer_metadata_match',
        type: 'metadata',
        severity: 'low'
      }
    ]
  },
  {
    name: 'funding_source_reconciliation',
    resourceType: 'funding_source',
    schedule: 'daily',
    lookbackHours: 24,
    checks: [
      {
        name: 'funding_source_exists',
        type: 'existence',
        severity: 'high'
      },
      {
        name: 'funding_source_status_match',
        type: 'status',
        severity: 'medium'
      }
    ]
  }
]

export class ReconciliationEngine {
  private dwollaClient: DwollaClient
  private isRunning = false
  
  constructor() {
    this.dwollaClient = new DwollaClient()
  }
  
  async runReconciliation(
    configName?: string,
    forceRun: boolean = false
  ): Promise<ReconciliationRun> {
    if (this.isRunning) {
      throw new Error('Reconciliation already in progress')
    }
    
    this.isRunning = true
    
    try {
      // Get configs to run
      const configs = configName 
        ? RECONCILIATION_CONFIGS.filter(c => c.name === configName)
        : RECONCILIATION_CONFIGS.filter(c => this.shouldRun(c, forceRun))
      
      if (configs.length === 0) {
        throw new Error('No reconciliation configs to run')
      }
      
      // Create reconciliation run
      const run = await prisma.reconciliationRun.create({
        data: {
          status: 'running',
          startTime: new Date(),
          config: {
            configs: configs.map(c => c.name),
            forceRun
          },
          metrics: {
            totalChecks: 0,
            discrepanciesFound: 0,
            discrepanciesResolved: 0,
            errorsEncountered: 0
          }
        }
      })
      
      // Run each configuration
      for (const config of configs) {
        await this.runConfigReconciliation(run.id, config)
      }
      
      // Update run status
      const finalRun = await prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          endTime: new Date()
        },
        include: {
          discrepancies: true
        }
      })
      
      // Send alerts for critical discrepancies
      await this.sendAlerts(finalRun)
      
      return finalRun
      
    } finally {
      this.isRunning = false
    }
  }
  
  private shouldRun(config: ReconciliationConfig, forceRun: boolean): boolean {
    if (forceRun) return true
    
    // Check last run time
    // In a real implementation, this would check the last successful run
    // For now, always return true for scheduled runs
    return true
  }
  
  private async runConfigReconciliation(
    runId: string,
    config: ReconciliationConfig
  ): Promise<void> {
    log.info('Starting reconciliation', {
      runId,
      config: config.name,
      resourceType: config.resourceType
    })
    
    const startTime = new Date(Date.now() - config.lookbackHours * 60 * 60 * 1000)
    
    // Get webhook events for this resource type
    const webhookEvents = await prisma.webhookEvent.findMany({
      where: {
        resourceType: config.resourceType,
        eventTimestamp: { gte: startTime },
        processingState: 'completed'
      },
      orderBy: { eventTimestamp: 'desc' }
    })
    
    log.info('Found webhook events to reconcile', {
      count: webhookEvents.length,
      resourceType: config.resourceType
    })
    
    // Group events by resource ID
    const eventsByResource = this.groupEventsByResource(webhookEvents)
    
    // Reconcile each resource
    for (const [resourceId, events] of eventsByResource) {
      try {
        await this.reconcileResource(
          runId,
          config,
          resourceId,
          events
        )
      } catch (error) {
        log.error('Resource reconciliation failed', error as Error, {
          runId,
          resourceId,
          resourceType: config.resourceType
        })
        
        // Update error count
        await prisma.reconciliationRun.update({
          where: { id: runId },
          data: {
            metrics: {
              update: {
                errorsEncountered: { increment: 1 }
              }
            }
          }
        })
      }
    }
  }
  
  private groupEventsByResource(
    events: WebhookEvent[]
  ): Map<string, WebhookEvent[]> {
    const grouped = new Map<string, WebhookEvent[]>()
    
    for (const event of events) {
      if (!event.resourceId) continue
      
      if (!grouped.has(event.resourceId)) {
        grouped.set(event.resourceId, [])
      }
      
      grouped.get(event.resourceId)!.push(event)
    }
    
    return grouped
  }
  
  private async reconcileResource(
    runId: string,
    config: ReconciliationConfig,
    resourceId: string,
    events: WebhookEvent[]
  ): Promise<void> {
    // Get the latest state from webhooks
    const latestEvent = events[0] // Already sorted by timestamp desc
    const webhookState = this.extractResourceState(latestEvent)
    
    // Get actual state from source
    const actualState = await this.getActualResourceState(
      config.resourceType,
      resourceId
    )
    
    // Run checks
    for (const check of config.checks) {
      const discrepancies = await this.runCheck(
        check,
        webhookState,
        actualState,
        latestEvent
      )
      
      // Update metrics
      await prisma.reconciliationRun.update({
        where: { id: runId },
        data: {
          metrics: {
            update: {
              totalChecks: { increment: 1 },
              discrepanciesFound: { increment: discrepancies.length }
            }
          }
        }
      })
      
      // Create discrepancy records
      for (const discrepancy of discrepancies) {
        const created = await prisma.reconciliationDiscrepancy.create({
          data: {
            runId,
            resourceType: config.resourceType,
            resourceId,
            checkName: check.name,
            severity: check.severity,
            details: discrepancy,
            webhookEventId: latestEvent.id,
            detectedAt: new Date()
          }
        })
        
        // Auto-resolve if configured
        if (check.autoResolve && actualState) {
          await this.autoResolveDiscrepancy(created, actualState)
        }
      }
    }
  }
  
  private extractResourceState(event: WebhookEvent): any {
    const payload = event.payload as any
    
    return {
      id: event.resourceId,
      type: event.resourceType,
      status: this.extractStatus(event),
      amount: payload.amount,
      metadata: payload,
      lastEventType: event.eventType,
      lastEventTime: event.eventTimestamp
    }
  }
  
  private extractStatus(event: WebhookEvent): string {
    const eventType = event.eventType
    const payload = event.payload as any
    
    // Map event types to status
    if (eventType.includes('completed')) return 'completed'
    if (eventType.includes('failed')) return 'failed'
    if (eventType.includes('cancelled')) return 'cancelled'
    if (eventType.includes('pending')) return 'pending'
    if (eventType.includes('processing')) return 'processing'
    if (eventType.includes('verified')) return 'verified'
    if (eventType.includes('suspended')) return 'suspended'
    
    return payload.status || 'unknown'
  }
  
  private async getActualResourceState(
    resourceType: string,
    resourceId: string
  ): Promise<any> {
    try {
      switch (resourceType) {
        case 'transfer':
          return await this.getTransferState(resourceId)
          
        case 'customer':
          return await this.getCustomerState(resourceId)
          
        case 'funding_source':
          return await this.getFundingSourceState(resourceId)
          
        default:
          return null
      }
    } catch (error) {
      log.error('Failed to get actual resource state', error as Error, {
        resourceType,
        resourceId
      })
      return null
    }
  }
  
  private async getTransferState(transferId: string): Promise<any> {
    // Get from local database first
    const dbTransfer = await prisma.aCHTransaction.findUnique({
      where: { dwollaId: transferId }
    })
    
    if (!dbTransfer) {
      return null
    }
    
    // In demo mode, return DB state
    if (process.env.DEMO_MODE === 'true') {
      return {
        id: transferId,
        type: 'transfer',
        status: dbTransfer.status,
        amount: {
          value: dbTransfer.amount.toString(),
          currency: 'USD'
        },
        metadata: dbTransfer.metadata
      }
    }
    
    // In production, would fetch from Dwolla API
    // return await this.dwollaClient.getTransfer(transferId)
    
    return {
      id: transferId,
      type: 'transfer',
      status: dbTransfer.status,
      amount: {
        value: dbTransfer.amount.toString(),
        currency: 'USD'
      },
      metadata: dbTransfer.metadata
    }
  }
  
  private async getCustomerState(customerId: string): Promise<any> {
    // In a real implementation, this would fetch from Dwolla API
    // For now, return mock data
    return {
      id: customerId,
      type: 'customer',
      status: 'verified',
      metadata: {}
    }
  }
  
  private async getFundingSourceState(fundingSourceId: string): Promise<any> {
    // In a real implementation, this would fetch from Dwolla API
    // For now, return mock data
    return {
      id: fundingSourceId,
      type: 'funding_source',
      status: 'verified',
      metadata: {}
    }
  }
  
  private async runCheck(
    check: ReconciliationCheck,
    webhookState: any,
    actualState: any,
    event: WebhookEvent
  ): Promise<DiscrepancyDetail[]> {
    const discrepancies: DiscrepancyDetail[] = []
    
    switch (check.type) {
      case 'existence':
        if (!actualState) {
          discrepancies.push({
            field: 'existence',
            webhookValue: 'exists',
            actualValue: 'not_found'
          })
        }
        break
        
      case 'status':
        if (actualState && webhookState.status !== actualState.status) {
          discrepancies.push({
            field: 'status',
            webhookValue: webhookState.status,
            actualValue: actualState.status
          })
        }
        break
        
      case 'amount':
        if (actualState && webhookState.amount && actualState.amount) {
          const webhookAmount = parseFloat(webhookState.amount.value || webhookState.amount)
          const actualAmount = parseFloat(actualState.amount.value || actualState.amount)
          
          if (Math.abs(webhookAmount - actualAmount) > 0.01) {
            discrepancies.push({
              field: 'amount',
              webhookValue: webhookAmount,
              actualValue: actualAmount,
              difference: webhookAmount - actualAmount
            })
          }
        }
        break
        
      case 'metadata':
        // Check key metadata fields
        const metadataFields = ['correlationId', 'clearing', 'achDetails']
        
        for (const field of metadataFields) {
          if (actualState?.metadata?.[field] !== webhookState.metadata?.[field]) {
            discrepancies.push({
              field: `metadata.${field}`,
              webhookValue: webhookState.metadata?.[field],
              actualValue: actualState?.metadata?.[field]
            })
          }
        }
        break
    }
    
    return discrepancies
  }
  
  private async autoResolveDiscrepancy(
    discrepancy: ReconciliationDiscrepancy,
    actualState: any
  ): Promise<void> {
    try {
      // Create corrective webhook event
      const correctiveEvent = await prisma.webhookEvent.create({
        data: {
          eventId: `reconciliation_${discrepancy.id}`,
          eventType: `${discrepancy.resourceType}_reconciled`,
          resourceType: discrepancy.resourceType,
          resourceId: discrepancy.resourceId,
          eventTimestamp: new Date(),
          payload: actualState,
          signature: 'reconciliation_generated',
          processingState: 'queued',
          metadata: {
            reconciliationRunId: discrepancy.runId,
            discrepancyId: discrepancy.id,
            autoResolved: true
          }
        }
      })
      
      // Update discrepancy as resolved
      await prisma.reconciliationDiscrepancy.update({
        where: { id: discrepancy.id },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolutionType: 'auto_corrected',
          resolutionDetails: {
            correctiveEventId: correctiveEvent.id,
            actualState
          }
        }
      })
      
      // Update metrics - using reconciliationJob instead of reconciliationRun
      await prisma.reconciliationJob.update({
        where: { id: discrepancy.checkId },
        data: {
          results: {
            update: {
              discrepanciesResolved: { increment: 1 }
            }
          }
        }
      })
      
      log.info('Auto-resolved discrepancy', {
        discrepancyId: discrepancy.id,
        resourceType: discrepancy.resourceType,
        resourceId: discrepancy.resourceId
      })
      
    } catch (error) {
      log.error('Failed to auto-resolve discrepancy', error as Error, {
        discrepancyId: discrepancy.id
      })
    }
  }
  
  private async sendAlerts(run: ReconciliationJob): Promise<void> {
    const criticalDiscrepancies = run.discrepancies?.filter(
      (d: any) => d.severity === 'critical' && !d.resolved
    ) || []
    
    if (criticalDiscrepancies.length > 0) {
      log.error('Critical discrepancies found', {
        runId: run.id,
        count: criticalDiscrepancies.length,
        discrepancies: criticalDiscrepancies.map((d: any) => ({
          resourceType: d.resourceType,
          resourceId: d.resourceId,
          field: d.field,
          notes: d.notes
        }))
      })
      
      // In a real implementation, this would send alerts via email/Slack/PagerDuty
    }
  }
  
  // Manual discrepancy resolution
  async resolveDiscrepancy(
    discrepancyId: string,
    resolution: {
      type: 'accept_webhook' | 'accept_actual' | 'manual_override'
      details?: any
    }
  ): Promise<ReconciliationDiscrepancy> {
    const discrepancy = await prisma.reconciliationDiscrepancy.findUnique({
      where: { id: discrepancyId }
    })
    
    if (!discrepancy) {
      throw new Error('Discrepancy not found')
    }
    
    if (discrepancy.resolved) {
      throw new Error('Discrepancy already resolved')
    }
    
    // Apply resolution
    let correctiveAction: any = null
    
    switch (resolution.type) {
      case 'accept_webhook':
        // Webhook state is correct, update actual system
        correctiveAction = {
          action: 'update_system',
          target: discrepancy.resourceType,
          resourceId: discrepancy.resourceId,
          newState: 'from_webhook'
        }
        break
        
      case 'accept_actual':
        // Actual state is correct, create corrective webhook
        correctiveAction = {
          action: 'create_corrective_webhook',
          target: discrepancy.resourceType,
          resourceId: discrepancy.resourceId
        }
        break
        
      case 'manual_override':
        // Manual resolution with custom details
        correctiveAction = {
          action: 'manual',
          details: resolution.details
        }
        break
    }
    
    // Update discrepancy
    return await prisma.reconciliationDiscrepancy.update({
      where: { id: discrepancyId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: 'system',
        notes: JSON.stringify({
          resolutionType: resolution.type,
          resolutionDetails: resolution.details,
          correctiveAction
        })
      }
    })
  }
  
  // Get reconciliation history
  async getReconciliationHistory(
    hours: number = 24
  ): Promise<ReconciliationJob[]> {
    return await prisma.reconciliationJob.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) }
      },
      include: {
        discrepancies: {
          where: { resolved: false }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }
  
  // Schedule reconciliation jobs
  scheduleReconciliations(): void {
    // Run hourly reconciliations
    setInterval(() => {
      const hourlyConfigs = RECONCILIATION_CONFIGS.filter(c => c.schedule === 'hourly')
      
      for (const config of hourlyConfigs) {
        this.runReconciliation(config.name).catch(error => {
          log.error('Scheduled reconciliation failed', error, {
            config: config.name
          })
        })
      }
    }, 60 * 60 * 1000) // 1 hour
    
    // Run daily reconciliations
    setInterval(() => {
      const dailyConfigs = RECONCILIATION_CONFIGS.filter(c => c.schedule === 'daily')
      
      for (const config of dailyConfigs) {
        this.runReconciliation(config.name).catch(error => {
          log.error('Scheduled reconciliation failed', error, {
            config: config.name
          })
        })
      }
    }, 24 * 60 * 60 * 1000) // 24 hours
    
    log.info('Reconciliation jobs scheduled')
  }
}

// Singleton instance
let engine: ReconciliationEngine | null = null

export function getReconciliationEngine(): ReconciliationEngine {
  if (!engine) {
    engine = new ReconciliationEngine()
  }
  return engine
}