import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { WebhookEvent, ReconciliationJob, ReconciliationCheck, ReconciliationDiscrepancy } from '@prisma/client'
import { DwollaClient } from '@/lib/api/dwolla/client'

interface ReconciliationConfig {
  name: string
  resourceType: 'transfer' | 'customer' | 'funding_source'
  schedule: 'hourly' | 'daily' | 'on_demand'
  lookbackHours: number
  checks: ReconciliationCheckConfig[]
}

interface ReconciliationCheckConfig {
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
  ): Promise<ReconciliationJob> {
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
      
      // Create reconciliation job
      const job = await prisma.reconciliationJob.create({
        data: {
          type: configName || 'batch_reconciliation',
          status: 'pending',
          config: {
            configs: configs.map(c => c.name),
            forceRun
          },
          createdBy: 'system'
        }
      })

      // Update job to running status
      await prisma.reconciliationJob.update({
        where: { id: job.id },
        data: {
          status: 'running',
          startedAt: new Date()
        }
      })
      
      // Run each configuration
      for (const config of configs) {
        await this.runConfigReconciliation(job.id, config)
      }
      
      // Update job status
      const finalJob = await prisma.reconciliationJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          results: {
            totalConfigs: configs.length,
            completedAt: new Date().toISOString()
          }
        }
      })
      
      // Send alerts for critical discrepancies
      await this.sendAlertsForJob(finalJob)
      
      return finalJob
      
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
    jobId: string,
    config: ReconciliationConfig
  ): Promise<void> {
    log.info('Starting reconciliation', {
      jobId,
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
    
    // Create a reconciliation check for this config
    const check = await prisma.reconciliationCheck.create({
      data: {
        checkType: config.name,
        status: 'in_progress',
        recordCount: webhookEvents.length,
        metadata: {
          jobId,
          config: config.name,
          resourceType: config.resourceType,
          lookbackHours: config.lookbackHours
        }
      }
    })
    
    // Group events by resource ID
    const eventsByResource = this.groupEventsByResource(webhookEvents)
    
    // Reconcile each resource
    let errorCount = 0
    for (const [resourceId, events] of eventsByResource) {
      try {
        await this.reconcileResource(
          check.id,
          config,
          resourceId,
          events
        )
      } catch (error) {
        errorCount++
        log.error('Resource reconciliation failed', error as Error, {
          jobId,
          checkId: check.id,
          resourceId,
          resourceType: config.resourceType
        })
      }
    }
    
    // Update check status
    await prisma.reconciliationCheck.update({
      where: { id: check.id },
      data: {
        status: errorCount > 0 ? 'failed' : 'completed',
        endTime: new Date(),
        metadata: {
          ...check.metadata,
          errorCount,
          completedAt: new Date().toISOString()
        }
      }
    })
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
    checkId: string,
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
    for (const checkConfig of config.checks) {
      const discrepancies = await this.runCheck(
        checkConfig,
        webhookState,
        actualState,
        latestEvent
      )
      
      // Create discrepancy records if any found
      for (const discrepancy of discrepancies) {
        const created = await prisma.reconciliationDiscrepancy.create({
          data: {
            checkId,
            resourceType: config.resourceType,
            resourceId,
            field: discrepancy.field,
            dwollaValue: JSON.stringify(discrepancy.webhookValue),
            localValue: JSON.stringify(discrepancy.actualValue),
            notes: `${checkConfig.name}: ${JSON.stringify(discrepancy)}`
          }
        })
        
        // Auto-resolve if configured
        if (checkConfig.autoResolve && actualState) {
          await this.autoResolveDiscrepancy(created, actualState)
        }
      }
      
      // Update check discrepancy count
      if (discrepancies.length > 0) {
        await prisma.reconciliationCheck.update({
          where: { id: checkId },
          data: {
            discrepancyCount: { increment: discrepancies.length }
          }
        })
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
    check: ReconciliationCheckConfig,
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
            reconciliationCheckId: discrepancy.checkId,
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
          resolvedBy: 'system',
          notes: `Auto-resolved: ${JSON.stringify({
            correctiveEventId: correctiveEvent.id,
            actualState
          })}`
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
  
  private async sendAlertsForJob(job: ReconciliationJob): Promise<void> {
    // Get all unresolved discrepancies for this job's checks
    const checks = await prisma.reconciliationCheck.findMany({
      where: {
        metadata: {
          path: ['jobId'],
          equals: job.id
        }
      },
      include: {
        discrepancies: {
          where: { resolved: false }
        }
      }
    })
    
    const allDiscrepancies = checks.flatMap(check => check.discrepancies)
    
    if (allDiscrepancies.length > 0) {
      log.error('Discrepancies found in reconciliation', {
        jobId: job.id,
        count: allDiscrepancies.length,
        discrepancies: allDiscrepancies.map(d => ({
          resourceType: d.resourceType,
          resourceId: d.resourceId,
          field: d.field,
          dwollaValue: d.dwollaValue,
          localValue: d.localValue
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
        resolvedBy: 'manual',
        notes: `Manual resolution: ${resolution.type} - ${JSON.stringify({
          ...resolution.details,
          correctiveAction
        })}`
      }
    })
  }
  
  // Get reconciliation history
  async getReconciliationHistory(
    hours: number = 24
  ): Promise<ReconciliationJob[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    return await prisma.reconciliationJob.findMany({
      where: {
        createdAt: { gte: cutoffTime }
      },
      orderBy: { createdAt: 'desc' }
    })
  }
  
  // Get discrepancies for a job
  async getJobDiscrepancies(jobId: string): Promise<ReconciliationDiscrepancy[]> {
    const checks = await prisma.reconciliationCheck.findMany({
      where: {
        metadata: {
          path: ['jobId'],
          equals: jobId
        }
      },
      include: {
        discrepancies: {
          where: { resolved: false }
        }
      }
    })
    
    return checks.flatMap(check => check.discrepancies)
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