import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import type { 
  WebhookEvent, 
  JourneyInstance, 
  EventJourneyDefinition,
  JourneyStatus,
  Prisma
} from '@prisma/client'
import { ProcessingContext } from './processor'
import { JourneyConfig, findApplicableJourneys } from './journey-definitions'

interface JourneyConflict {
  type: 'out_of_order' | 'duplicate_step' | 'invalid_transition' | 'resource_conflict'
  description: string
  severity: 'low' | 'medium' | 'high'
}

export class JourneyTracker {
  async processEvent(event: WebhookEvent, context: ProcessingContext): Promise<void> {
    try {
      // Find all journey definitions that this event might affect
      const applicableJourneys = await this.findApplicableDefinitions(event)
      
      for (const definition of applicableJourneys) {
        try {
          await this.processEventForJourney(event, definition, context)
        } catch (error) {
          // Don't let one journey failure affect others
          log.error('Journey processing error', error as Error, {
            eventId: event.id,
            journeyId: definition.id,
            journeyName: definition.name
          })
        }
      }
      
      // Check for abandoned journeys
      if (event.resourceId) {
        await this.checkAbandonedJourneys(event.resourceId)
      }
    } catch (error) {
      log.error('Journey tracker error', error as Error, {
        eventId: event.id,
        eventType: event.eventType
      })
    }
  }
  
  private async findApplicableDefinitions(event: WebhookEvent): Promise<EventJourneyDefinition[]> {
    // Get active journey definitions from database
    const definitions = await prisma.eventJourneyDefinition.findMany({
      where: { active: true }
    })
    
    // Filter to ones that care about this event
    return definitions.filter(def => {
      const config = def.config as JourneyConfig
      
      // Check if this event starts the journey
      const isStartEvent = config.startEvents.some(start => 
        this.matchesEventCriteria(event, start)
      )
      
      // Check if this event is part of the journey
      const isJourneyEvent = 
        config.endEvents.some(end => this.matchesEventCriteria(event, end)) ||
        config.failureEvents?.some(fail => this.matchesEventCriteria(event, fail)) ||
        config.expectedSteps?.some(step => step.eventType === event.eventType)
      
      return isStartEvent || isJourneyEvent
    })
  }
  
  private matchesEventCriteria(
    event: WebhookEvent, 
    criteria: { eventType: string; conditions?: any; resourceType?: string }
  ): boolean {
    // Check event type
    if (event.eventType !== criteria.eventType) return false
    
    // Check resource type if specified
    if (criteria.resourceType && event.resourceType !== criteria.resourceType) {
      return false
    }
    
    // Check additional conditions
    if (criteria.conditions) {
      // Simple condition matching (could be enhanced)
      for (const [key, value] of Object.entries(criteria.conditions)) {
        const eventValue = (event.payload as any)[key]
        if (eventValue !== value) return false
      }
    }
    
    return true
  }
  
  private async processEventForJourney(
    event: WebhookEvent,
    definition: EventJourneyDefinition,
    context: ProcessingContext
  ): Promise<void> {
    const config = definition.config as JourneyConfig
    
    // Check if this starts a new journey
    const isStartEvent = config.startEvents.some(start => 
      this.matchesEventCriteria(event, start)
    )
    
    if (isStartEvent && event.resourceId) {
      await this.handleJourneyStart(event, definition, context)
    }
    
    // Update existing journeys
    if (event.resourceId) {
      const activeJourneys = await prisma.journeyInstance.findMany({
        where: {
          definitionId: definition.id,
          resourceId: event.resourceId,
          status: { in: ['active', 'stuck'] }
        }
      })
      
      for (const journey of activeJourneys) {
        await this.updateJourney(journey, event, definition, context)
      }
    }
  }
  
  private async handleJourneyStart(
    event: WebhookEvent,
    definition: EventJourneyDefinition,
    context: ProcessingContext
  ): Promise<void> {
    const config = definition.config as JourneyConfig
    
    // Check if we already have active journeys
    const existingActive = await prisma.journeyInstance.count({
      where: {
        definitionId: definition.id,
        resourceId: event.resourceId!,
        status: 'active'
      }
    })
    
    // Apply conflict resolution
    if (existingActive > 0 && !config.allowMultipleActive) {
      if (config.conflictResolution === 'oldest') {
        // Don't start a new journey
        log.info('Journey start skipped - existing active journey', {
          definitionId: definition.id,
          resourceId: event.resourceId
        })
        return
      } else if (config.conflictResolution === 'newest') {
        // Cancel existing journeys
        await prisma.journeyInstance.updateMany({
          where: {
            definitionId: definition.id,
            resourceId: event.resourceId!,
            status: 'active'
          },
          data: {
            status: 'abandoned',
            endTime: new Date(),
            notes: 'Abandoned due to new journey start'
          }
        })
      }
    }
    
    // Check max active limit
    if (existingActive >= config.maxActivePerResource && config.conflictResolution === 'parallel') {
      log.warn('Max active journeys reached', {
        definitionId: definition.id,
        resourceId: event.resourceId,
        maxActive: config.maxActivePerResource
      })
      return
    }
    
    // Create new journey instance
    const journey = await prisma.journeyInstance.create({
      data: {
        definitionId: definition.id,
        definitionVersion: definition.version,
        resourceId: event.resourceId!,
        resourceType: event.resourceType || 'unknown',
        resourceMetadata: this.extractResourceMetadata(event, context),
        status: 'active',
        startEventId: event.id,
        startTime: event.eventTimestamp,
        lastEventTime: event.eventTimestamp,
        partitionKey: this.generatePartitionKey(event.eventTimestamp),
        context: this.buildJourneyContext(event, context),
        tags: definition.tags,
        steps: {
          create: {
            sequence: 0,
            stepName: 'Journey Started',
            eventId: event.id,
            eventType: event.eventType,
            timestamp: event.eventTimestamp,
            durationFromStartMs: 0,
            expected: true,
            onTime: true
          }
        }
      }
    })
    
    log.info('Journey started', {
      journeyId: journey.id,
      definitionName: definition.name,
      resourceId: event.resourceId,
      eventType: event.eventType
    })
    
    // Update predictions
    await this.updatePredictions(journey, definition)
  }
  
  private async updateJourney(
    journey: JourneyInstance,
    event: WebhookEvent,
    definition: EventJourneyDefinition,
    context: ProcessingContext
  ): Promise<void> {
    const config = definition.config as JourneyConfig
    
    // Handle out-of-order events
    if (event.eventTimestamp < journey.lastEventTime) {
      await this.handleOutOfOrderEvent(journey, event, definition)
      return
    }
    
    // Check for conflicts
    const conflicts = await this.detectConflicts(journey, event, definition)
    if (conflicts.length > 0) {
      const resolution = await this.resolveConflicts(journey, event, conflicts)
      if (resolution === 'reject') {
        return
      }
    }
    
    // Calculate step timing
    const durationFromStart = event.eventTimestamp.getTime() - journey.startTime.getTime()
    const durationFromPrevious = event.eventTimestamp.getTime() - journey.lastEventTime.getTime()
    
    // Determine if this is an expected step
    const expectedStep = config.expectedSteps?.find(step => 
      step.eventType === event.eventType
    )
    
    // Check if step is on time
    const onTime = this.isStepOnTime(expectedStep, durationFromStart)
    
    // Create journey step
    const step = await prisma.journeyStep.create({
      data: {
        journeyInstanceId: journey.id,
        sequence: journey.currentStepIndex + 1,
        stepName: expectedStep?.name || event.eventType,
        eventId: event.id,
        eventType: event.eventType,
        timestamp: event.eventTimestamp,
        durationFromStartMs: BigInt(durationFromStart),
        durationFromPreviousMs: BigInt(durationFromPrevious),
        expected: !!expectedStep,
        onTime,
        eventMetadata: this.extractEventMetadata(event)
      }
    })
    
    // Update journey state
    const updates: Prisma.JourneyInstanceUpdateInput = {
      currentStepIndex: { increment: 1 },
      lastEventTime: event.eventTimestamp,
      updatedAt: new Date()
    }
    
    // Add to completed steps if expected
    if (expectedStep) {
      updates.completedSteps = {
        push: expectedStep.name
      }
    }
    
    // Check if journey is complete
    const isComplete = config.endEvents.some(end => 
      this.matchesEventCriteria(event, end)
    )
    
    if (isComplete) {
      updates.status = 'completed'
      updates.endEventId = event.id
      updates.endTime = event.eventTimestamp
      updates.totalDurationMs = BigInt(durationFromStart)
      updates.progressPercentage = 100
    }
    
    // Check if journey failed
    const isFailed = config.failureEvents?.some(fail => 
      this.matchesEventCriteria(event, fail)
    )
    
    if (isFailed) {
      updates.status = 'failed'
      updates.endEventId = event.id
      updates.endTime = event.eventTimestamp
      updates.totalDurationMs = BigInt(durationFromStart)
    }
    
    // Update progress percentage
    if (!isComplete && !isFailed && config.expectedSteps) {
      const completedCount = journey.completedSteps.length + (expectedStep ? 1 : 0)
      updates.progressPercentage = Math.round(
        (completedCount / config.expectedSteps.length) * 100
      )
    }
    
    // Apply updates
    const updatedJourney = await prisma.journeyInstance.update({
      where: { id: journey.id },
      data: updates
    })
    
    // Update predictions if still active
    if (updatedJourney.status === 'active') {
      await this.updatePredictions(updatedJourney, definition)
    }
    
    // Check if journey is stuck
    await this.checkIfStuck(updatedJourney, definition)
    
    log.info('Journey updated', {
      journeyId: journey.id,
      eventType: event.eventType,
      status: updatedJourney.status,
      progress: updatedJourney.progressPercentage
    })
  }
  
  private async handleOutOfOrderEvent(
    journey: JourneyInstance,
    event: WebhookEvent,
    definition: EventJourneyDefinition
  ): Promise<void> {
    log.warn('Out of order event detected', {
      journeyId: journey.id,
      eventId: event.id,
      eventTime: event.eventTimestamp,
      lastEventTime: journey.lastEventTime
    })
    
    // Still record the event but mark it
    await prisma.journeyStep.create({
      data: {
        journeyInstanceId: journey.id,
        sequence: -1, // Special sequence for out-of-order
        stepName: `Out of Order: ${event.eventType}`,
        eventId: event.id,
        eventType: event.eventType,
        timestamp: event.eventTimestamp,
        durationFromStartMs: BigInt(
          event.eventTimestamp.getTime() - journey.startTime.getTime()
        ),
        expected: false,
        onTime: false,
        eventMetadata: {
          ...this.extractEventMetadata(event),
          outOfOrder: true,
          originalTimestamp: event.eventTimestamp
        }
      }
    })
  }
  
  private async detectConflicts(
    journey: JourneyInstance,
    event: WebhookEvent,
    definition: EventJourneyDefinition
  ): Promise<JourneyConflict[]> {
    const conflicts: JourneyConflict[] = []
    const config = definition.config as JourneyConfig
    
    // Check for duplicate steps
    const existingStep = await prisma.journeyStep.findFirst({
      where: {
        journeyInstanceId: journey.id,
        eventType: event.eventType
      }
    })
    
    if (existingStep && !config.expectedSteps?.find(s => s.eventType === event.eventType && s.retryable)) {
      conflicts.push({
        type: 'duplicate_step',
        description: `Event type ${event.eventType} already processed`,
        severity: 'medium'
      })
    }
    
    // Check for invalid transitions
    // (Add more complex state machine logic here if needed)
    
    return conflicts
  }
  
  private async resolveConflicts(
    journey: JourneyInstance,
    event: WebhookEvent,
    conflicts: JourneyConflict[]
  ): Promise<'accept' | 'reject'> {
    // Simple resolution for now - reject high severity conflicts
    const hasHighSeverity = conflicts.some(c => c.severity === 'high')
    
    if (hasHighSeverity) {
      log.warn('Rejecting event due to conflicts', {
        journeyId: journey.id,
        eventId: event.id,
        conflicts
      })
      return 'reject'
    }
    
    // Log but accept medium/low severity
    log.info('Accepting event despite conflicts', {
      journeyId: journey.id,
      eventId: event.id,
      conflicts
    })
    
    return 'accept'
  }
  
  private isStepOnTime(
    expectedStep: { minMinutes?: number; maxMinutes?: number } | undefined,
    durationMs: number
  ): boolean {
    if (!expectedStep) return true
    
    const durationMinutes = durationMs / (1000 * 60)
    
    if (expectedStep.minMinutes && durationMinutes < expectedStep.minMinutes) {
      return false
    }
    
    if (expectedStep.maxMinutes && durationMinutes > expectedStep.maxMinutes) {
      return false
    }
    
    return true
  }
  
  private async updatePredictions(
    journey: JourneyInstance,
    definition: EventJourneyDefinition
  ): Promise<void> {
    const config = definition.config as JourneyConfig
    
    // Simple prediction based on expected steps
    if (config.expectedSteps && config.expectedSteps.length > 0) {
      const remainingSteps = config.expectedSteps.filter(step => 
        !journey.completedSteps.includes(step.name)
      )
      
      if (remainingSteps.length > 0) {
        // Calculate estimated completion based on average step time
        const avgStepTime = remainingSteps.reduce((sum, step) => 
          sum + (step.maxMinutes || 60), 0
        ) / remainingSteps.length
        
        const estimatedMinutesRemaining = avgStepTime * remainingSteps.length
        const estimatedCompletionTime = new Date(
          Date.now() + estimatedMinutesRemaining * 60 * 1000
        )
        
        // Simple confidence score based on journey progress
        const confidenceScore = Math.max(
          50, 
          Math.round(journey.progressPercentage * 0.8)
        )
        
        await prisma.journeyInstance.update({
          where: { id: journey.id },
          data: {
            estimatedCompletionTime,
            confidenceScore
          }
        })
      }
    }
  }
  
  private async checkIfStuck(
    journey: JourneyInstance,
    definition: EventJourneyDefinition
  ): Promise<void> {
    const config = definition.config as JourneyConfig
    
    // Check if journey has been inactive too long
    const inactiveMinutes = (Date.now() - journey.lastEventTime.getTime()) / (1000 * 60)
    
    // Use timeout or calculate based on expected steps
    const stuckThreshold = config.timeoutMinutes 
      ? config.timeoutMinutes * 0.5 // Stuck at 50% of timeout
      : 1440 // Default 24 hours
    
    if (inactiveMinutes > stuckThreshold && journey.status === 'active') {
      await prisma.journeyInstance.update({
        where: { id: journey.id },
        data: {
          status: 'stuck',
          riskScore: 75,
          riskFactors: {
            push: `No activity for ${Math.round(inactiveMinutes)} minutes`
          }
        }
      })
      
      log.warn('Journey marked as stuck', {
        journeyId: journey.id,
        inactiveMinutes,
        lastEventTime: journey.lastEventTime
      })
    }
  }
  
  private async checkAbandonedJourneys(resourceId: string): Promise<void> {
    // Find journeys that should be marked as abandoned
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days
    
    const abandoned = await prisma.journeyInstance.updateMany({
      where: {
        resourceId,
        status: { in: ['active', 'stuck'] },
        lastEventTime: { lt: cutoffTime }
      },
      data: {
        status: 'abandoned',
        endTime: new Date(),
        notes: 'Abandoned due to inactivity'
      }
    })
    
    if (abandoned.count > 0) {
      log.info('Journeys marked as abandoned', {
        resourceId,
        count: abandoned.count
      })
    }
  }
  
  private extractResourceMetadata(event: WebhookEvent, context: ProcessingContext): any {
    const metadata: any = {}
    
    // Extract from context
    const transaction = context.get('transaction')
    if (transaction) {
      metadata.customerName = transaction.customerName
      metadata.companyName = transaction.companyName
      metadata.amount = transaction.amount
    }
    
    // Extract from event payload
    const payload = event.payload as any
    if (payload.amount) metadata.amount = payload.amount
    if (payload.customerName) metadata.customerName = payload.customerName
    
    return metadata
  }
  
  private extractEventMetadata(event: WebhookEvent): any {
    const payload = event.payload as any
    return {
      eventId: event.eventId,
      resourceId: event.resourceId,
      timestamp: event.eventTimestamp,
      // Add other relevant fields from payload
      amount: payload.amount,
      status: payload.status,
      reason: payload.reason,
      code: payload.code
    }
  }
  
  private buildJourneyContext(event: WebhookEvent, context: ProcessingContext): any {
    return {
      startEventType: event.eventType,
      startEventId: event.eventId,
      resourceType: event.resourceType,
      // Add any relevant context data
      transaction: context.get('transaction'),
      customer: context.get('customer')
    }
  }
  
  private generatePartitionKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
}

// Singleton instance
let tracker: JourneyTracker | null = null

export function getJourneyTracker(): JourneyTracker {
  if (!tracker) {
    tracker = new JourneyTracker()
  }
  return tracker
}