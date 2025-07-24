import type { EventJourneyDefinition } from '@prisma/client'

export interface JourneyStepDefinition {
  name: string
  eventType: string
  required: boolean
  order?: number
  minMinutes?: number
  maxMinutes?: number
  retryable?: boolean
}

export interface JourneyConfig {
  startEvents: Array<{
    eventType: string
    conditions?: Record<string, any>
    resourceType?: string
  }>
  endEvents: Array<{
    eventType: string
    conditions?: Record<string, any>
    resourceType?: string
  }>
  failureEvents?: Array<{
    eventType: string
    conditions?: Record<string, any>
    resourceType?: string
  }>
  expectedSteps?: JourneyStepDefinition[]
  timeoutMinutes?: number
  businessHoursOnly?: boolean
  timezone?: string
  allowMultipleActive: boolean
  maxActivePerResource: number
  conflictResolution: 'newest' | 'oldest' | 'parallel'
}

// Define all journey types
export const JOURNEY_DEFINITIONS: Omit<EventJourneyDefinition, 'id' | 'createdAt' | 'updatedAt' | 'instances' | 'analytics'>[] = [
  // Customer Onboarding Journeys
  {
    name: 'Basic Customer Onboarding',
    description: 'Track customer from creation to activation',
    category: 'onboarding',
    version: 1,
    active: true,
    tags: ['customer', 'onboarding', 'activation'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'customer_created', resourceType: 'customer' }
      ],
      endEvents: [
        { eventType: 'customer_activated', resourceType: 'customer' }
      ],
      expectedSteps: [
        {
          name: 'Customer Activation',
          eventType: 'customer_activated',
          required: true,
          maxMinutes: 60
        }
      ],
      timeoutMinutes: 1440, // 24 hours
      allowMultipleActive: false,
      maxActivePerResource: 1,
      conflictResolution: 'newest'
    },
    thresholds: {
      targetDurationMinutes: 5,
      warningDurationMinutes: 30,
      criticalDurationMinutes: 60,
      targetCompletionRate: 95,
      maxFailureRate: 5
    }
  },
  
  {
    name: 'Full Customer Verification',
    description: 'Complete customer verification including funding source',
    category: 'verification',
    version: 1,
    active: true,
    tags: ['customer', 'verification', 'kyc'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'customer_created', resourceType: 'customer' }
      ],
      endEvents: [
        { eventType: 'customer_verified', resourceType: 'customer' }
      ],
      failureEvents: [
        { eventType: 'customer_suspended', resourceType: 'customer' },
        { eventType: 'customer_deactivated', resourceType: 'customer' }
      ],
      expectedSteps: [
        {
          name: 'Customer Activation',
          eventType: 'customer_activated',
          required: true,
          order: 1,
          maxMinutes: 60
        },
        {
          name: 'Funding Source Added',
          eventType: 'customer_funding_source_added',
          required: true,
          order: 2,
          maxMinutes: 1440 // 24 hours
        },
        {
          name: 'Customer Verified',
          eventType: 'customer_verified',
          required: true,
          order: 3,
          maxMinutes: 2880 // 48 hours
        }
      ],
      timeoutMinutes: 10080, // 7 days
      businessHoursOnly: true,
      timezone: 'America/New_York',
      allowMultipleActive: false,
      maxActivePerResource: 1,
      conflictResolution: 'newest'
    },
    thresholds: {
      targetDurationMinutes: 1440, // 24 hours
      warningDurationMinutes: 4320, // 3 days
      criticalDurationMinutes: 7200, // 5 days
      targetCompletionRate: 80,
      maxFailureRate: 20
    }
  },
  
  {
    name: 'Micro-deposit Verification',
    description: 'Bank account verification via micro-deposits',
    category: 'verification',
    version: 1,
    active: true,
    tags: ['customer', 'bank', 'microdeposit'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'customer_microdeposits_added', resourceType: 'customer' }
      ],
      endEvents: [
        { eventType: 'customer_microdeposits_completed', resourceType: 'customer' },
        { eventType: 'customer_verified', resourceType: 'customer' }
      ],
      failureEvents: [
        { eventType: 'customer_microdeposits_failed', resourceType: 'customer' },
        { eventType: 'customer_microdeposits_maxattempts', resourceType: 'customer' }
      ],
      expectedSteps: [
        {
          name: 'Micro-deposits Completed',
          eventType: 'customer_microdeposits_completed',
          required: true,
          minMinutes: 1440, // 1 day minimum
          maxMinutes: 5760  // 4 days maximum
        }
      ],
      timeoutMinutes: 7200, // 5 days
      allowMultipleActive: true,
      maxActivePerResource: 3, // Multiple funding sources
      conflictResolution: 'parallel'
    },
    thresholds: {
      targetDurationMinutes: 2880, // 2 days
      warningDurationMinutes: 4320, // 3 days
      criticalDurationMinutes: 5760, // 4 days
      targetCompletionRate: 85,
      maxFailureRate: 15
    }
  },
  
  // Transaction Journeys
  {
    name: 'Standard ACH Transfer',
    description: 'Track ACH transfer from creation to completion',
    category: 'transaction',
    version: 1,
    active: true,
    tags: ['transfer', 'ach', 'payment'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'transfer_created', resourceType: 'transfer' }
      ],
      endEvents: [
        { eventType: 'transfer_completed', resourceType: 'transfer' }
      ],
      failureEvents: [
        { eventType: 'transfer_failed', resourceType: 'transfer' },
        { eventType: 'transfer_cancelled', resourceType: 'transfer' }
      ],
      expectedSteps: [
        {
          name: 'Transfer Processing',
          eventType: 'transfer_completed',
          required: true,
          minMinutes: 1,
          maxMinutes: 10080 // 7 days
        }
      ],
      timeoutMinutes: 20160, // 14 days
      allowMultipleActive: true,
      maxActivePerResource: 100,
      conflictResolution: 'parallel'
    },
    thresholds: {
      targetDurationMinutes: 1440, // 1 day
      warningDurationMinutes: 4320, // 3 days
      criticalDurationMinutes: 7200, // 5 days
      targetCompletionRate: 95,
      maxFailureRate: 5
    }
  },
  
  {
    name: 'Transfer Return Process',
    description: 'Track transfer returns and their resolution',
    category: 'transaction',
    version: 1,
    active: true,
    tags: ['transfer', 'return', 'ach'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'transfer_completed', resourceType: 'transfer' }
      ],
      endEvents: [
        { eventType: 'transfer_returned', resourceType: 'transfer' }
      ],
      expectedSteps: [
        {
          name: 'Transfer Returned',
          eventType: 'transfer_returned',
          required: true,
          minMinutes: 1440, // 1 day minimum
          maxMinutes: 10080 // 7 days maximum
        }
      ],
      timeoutMinutes: 20160, // 14 days
      allowMultipleActive: false,
      maxActivePerResource: 1,
      conflictResolution: 'newest'
    },
    thresholds: {
      targetDurationMinutes: 0, // We don't want returns
      warningDurationMinutes: 0,
      criticalDurationMinutes: 0,
      targetCompletionRate: 0,
      maxFailureRate: 5 // Alert if >5% return rate
    }
  },
  
  {
    name: 'Failed Transfer Recovery',
    description: 'Track retry attempts for failed transfers',
    category: 'recovery',
    version: 1,
    active: true,
    tags: ['transfer', 'recovery', 'retry'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'transfer_failed', resourceType: 'transfer' }
      ],
      endEvents: [
        { eventType: 'transfer_completed', resourceType: 'transfer' }
      ],
      failureEvents: [
        { 
          eventType: 'transfer_failed', 
          resourceType: 'transfer',
          conditions: { retryCount: { $gte: 2 } } // Failed again after retry
        }
      ],
      expectedSteps: [
        {
          name: 'Retry Transfer Created',
          eventType: 'transfer_created',
          required: true,
          maxMinutes: 4320, // 3 days to retry
          retryable: true
        },
        {
          name: 'Retry Transfer Completed',
          eventType: 'transfer_completed',
          required: true,
          maxMinutes: 10080 // 7 days
        }
      ],
      timeoutMinutes: 20160, // 14 days
      allowMultipleActive: true,
      maxActivePerResource: 3, // Allow up to 3 retry attempts
      conflictResolution: 'parallel'
    },
    thresholds: {
      targetDurationMinutes: 4320, // 3 days
      warningDurationMinutes: 7200, // 5 days
      criticalDurationMinutes: 10080, // 7 days
      targetCompletionRate: 60, // 60% recovery rate is good
      maxFailureRate: 40
    }
  },
  
  // Funding Source Journeys
  {
    name: 'Bank Account Addition',
    description: 'Track bank account from addition to verification',
    category: 'funding',
    version: 1,
    active: true,
    tags: ['funding_source', 'bank', 'verification'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'customer_funding_source_added', resourceType: 'funding_source' }
      ],
      endEvents: [
        { eventType: 'customer_funding_source_verified', resourceType: 'funding_source' }
      ],
      failureEvents: [
        { eventType: 'customer_funding_source_removed', resourceType: 'funding_source' },
        { eventType: 'customer_funding_source_unverified', resourceType: 'funding_source' }
      ],
      expectedSteps: [
        {
          name: 'Funding Source Verification',
          eventType: 'customer_funding_source_verified',
          required: true,
          maxMinutes: 7200 // 5 days
        }
      ],
      timeoutMinutes: 10080, // 7 days
      allowMultipleActive: true,
      maxActivePerResource: 5, // Multiple funding sources per customer
      conflictResolution: 'parallel'
    },
    thresholds: {
      targetDurationMinutes: 2880, // 2 days
      warningDurationMinutes: 4320, // 3 days
      criticalDurationMinutes: 5760, // 4 days
      targetCompletionRate: 90,
      maxFailureRate: 10
    }
  },
  
  // First Transaction Journey
  {
    name: 'First Successful Transaction',
    description: 'Track customer from verification to first successful transaction',
    category: 'onboarding',
    version: 1,
    active: true,
    tags: ['customer', 'first_transaction', 'activation'],
    createdBy: 'system',
    config: {
      startEvents: [
        { eventType: 'customer_verified', resourceType: 'customer' }
      ],
      endEvents: [
        { 
          eventType: 'transfer_completed', 
          resourceType: 'transfer',
          conditions: { isFirstTransaction: true }
        }
      ],
      expectedSteps: [
        {
          name: 'First Transfer Created',
          eventType: 'transfer_created',
          required: true,
          maxMinutes: 20160 // 14 days
        },
        {
          name: 'First Transfer Completed',
          eventType: 'transfer_completed',
          required: true,
          maxMinutes: 10080 // 7 days after creation
        }
      ],
      timeoutMinutes: 43200, // 30 days
      allowMultipleActive: false,
      maxActivePerResource: 1,
      conflictResolution: 'oldest' // Keep tracking the first attempt
    },
    thresholds: {
      targetDurationMinutes: 7200, // 5 days
      warningDurationMinutes: 14400, // 10 days
      criticalDurationMinutes: 28800, // 20 days
      targetCompletionRate: 70,
      maxFailureRate: 30
    }
  }
]

// Helper function to validate journey definition
export function validateJourneyDefinition(definition: any): boolean {
  // Add validation logic here
  return true
}

// Helper function to find applicable journeys for an event
export function findApplicableJourneys(eventType: string, resourceType?: string): typeof JOURNEY_DEFINITIONS {
  return JOURNEY_DEFINITIONS.filter(def => {
    const config = def.config as JourneyConfig
    
    // Check if this event starts any journey
    const startsJourney = config.startEvents.some(start => 
      start.eventType === eventType && 
      (!start.resourceType || start.resourceType === resourceType)
    )
    
    // Check if this event is part of any journey
    const partOfJourney = 
      config.endEvents.some(end => 
        end.eventType === eventType &&
        (!end.resourceType || end.resourceType === resourceType)
      ) ||
      config.failureEvents?.some(fail => 
        fail.eventType === eventType &&
        (!fail.resourceType || fail.resourceType === resourceType)
      ) ||
      config.expectedSteps?.some(step => step.eventType === eventType)
    
    return startsJourney || partOfJourney
  })
}