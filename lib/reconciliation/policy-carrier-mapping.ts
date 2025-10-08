/**
 * Policy-Carrier Mapping Configuration
 * 
 * This module contains the definitive mapping between policy types and their
 * respective insurance carriers, along with coverage details.
 */

import { PolicyCarrierMapping } from '@/lib/types/reconciliation'

// Comprehensive Policy-Carrier Mapping Configuration
export const POLICY_CARRIER_MAPPINGS: Record<string, PolicyCarrierMapping> = {
  'Accident': {
    policyType: 'Accident',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Family', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 10000, max: 100000, increments: 10000 },
      { min: 250000, max: 500000, increments: 50000 }
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Critical Illness': {
    policyType: 'Critical Illness',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Family', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 10000, max: 100000, increments: 10000 },
      { min: 250000, max: 500000, increments: 50000 }
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Long Term Care': {
    policyType: 'Long Term Care',
    carrier: 'Unum',
    coverageLevels: ['Individual', 'Couple', 'Family'],
    coverageAmountRanges: [
      { min: 1500, max: 6000, increments: 500 }, // Monthly benefit
      { min: 50000, max: 500000, increments: 25000 } // Lifetime benefit
    ],
    planVariants: ['Traditional', 'Hybrid', 'Partnership', 'Inflation Protection']
  },
  
  'Dental': {
    policyType: 'Dental',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 1000, max: 3000, increments: 500 }, // Annual maximum
      { min: 1500, max: 5000, increments: 500 } // Lifetime orthodontic
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'PPO', 'DHMO']
  },
  
  'Dental Insurance': {
    policyType: 'Dental Insurance',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 1000, max: 3000, increments: 500 },
      { min: 1500, max: 5000, increments: 500 }
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'PPO', 'DHMO']
  },
  
  'Vision': {
    policyType: 'Vision',
    carrier: 'Guardian',
    coverageLevels: ['Individual', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 150, max: 300, increments: 25 }, // Frame allowance
      { min: 100, max: 200, increments: 25 }, // Contact lens allowance
      { min: 50, max: 100, increments: 10 } // Exam copay
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'PPO', 'DHMO']
  },
  
  'Vision Insurance': {
    policyType: 'Vision Insurance',
    carrier: 'Guardian',
    coverageLevels: ['Individual', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 150, max: 300, increments: 25 },
      { min: 100, max: 200, increments: 25 },
      { min: 50, max: 100, increments: 10 }
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'PPO', 'DHMO']
  },
  
  'Life - Dependent': {
    policyType: 'Life - Dependent',
    carrier: 'SunLife',
    coverageLevels: ['Spouse', 'Child', 'Children (multiple)'],
    coverageAmountRanges: [
      { min: 5000, max: 50000, increments: 5000 }, // Spouse
      { min: 5000, max: 25000, increments: 5000 } // Children
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium']
  },
  
  'Voluntary Life & AD&D': {
    policyType: 'Voluntary Life & AD&D',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 10000, max: 500000, increments: 10000 },
      { min: 100000, max: 500000, increments: 25000 } // Salary multiples: 1x-5x
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Short Term Disability': {
    policyType: 'Short Term Disability',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Employee'],
    coverageAmountRanges: [
      { min: 100, max: 1500, increments: 50 } // Weekly maximum (40%-66.67% of salary)
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium']
  },
  
  'Long Term Disability': {
    policyType: 'Long Term Disability',
    carrier: 'SunLife',
    coverageLevels: ['Individual', 'Employee'],
    coverageAmountRanges: [
      { min: 1000, max: 15000, increments: 500 } // Monthly maximum (40%-66.67% of salary)
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Excess Disability': {
    policyType: 'Excess Disability',
    carrier: 'Hanleigh',
    coverageLevels: ['Individual', 'Employee'],
    coverageAmountRanges: [
      { min: 1000, max: 10000, increments: 500 } // Monthly benefit beyond primary
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium']
  },
  
  'Excess Disability Insurance': {
    policyType: 'Excess Disability Insurance',
    carrier: 'Hanleigh',
    coverageLevels: ['Individual', 'Employee'],
    coverageAmountRanges: [
      { min: 1000, max: 10000, increments: 500 }
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium']
  },
  
  'Identity Theft Protection': {
    policyType: 'Identity Theft Protection',
    carrier: 'SontIQ',
    coverageLevels: ['Individual', 'Family', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 10000, max: 1000000, increments: 10000 }, // Reimbursement
      { min: 25000, max: 100000, increments: 5000 } // Legal expenses
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Health Cost Sharing': {
    policyType: 'Health Cost Sharing',
    carrier: 'Sedera',
    coverageLevels: ['Individual', 'Family', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 1000, max: 10000, increments: 500 }, // Annual deductible
      { min: 1000000, max: 2000000, increments: 250000 } // Annual maximum
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Sedera Health Cost Sharing': {
    policyType: 'Sedera Health Cost Sharing',
    carrier: 'Sedera',
    coverageLevels: ['Individual', 'Family', 'Employee + Spouse', 'Employee + Children', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 1000, max: 10000, increments: 500 },
      { min: 1000000, max: 2000000, increments: 250000 }
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  },
  
  'Telehealth': {
    policyType: 'Telehealth',
    carrier: 'Recuro',
    coverageLevels: ['Individual', 'Family', 'Employee + Family'],
    coverageAmountRanges: [
      { min: 0, max: 50, increments: 5 } // Copay per visit (some plans unlimited)
    ],
    planVariants: ['Basic', 'Enhanced', 'Premium', 'Executive']
  }
}

// Simple lookup function to get carrier by policy type
export function getCarrierByPolicyType(policyType: string): string {
  const mapping = POLICY_CARRIER_MAPPINGS[policyType]
  return mapping?.carrier || 'Unknown'
}

// Get all supported policy types
export function getSupportedPolicyTypes(): string[] {
  return Object.keys(POLICY_CARRIER_MAPPINGS)
}

// Get all carriers
export function getAllCarriers(): string[] {
  const carriers = new Set<string>()
  Object.values(POLICY_CARRIER_MAPPINGS).forEach(mapping => {
    carriers.add(mapping.carrier)
  })
  return Array.from(carriers).sort()
}

// Get policy types by carrier
export function getPolicyTypesByCarrier(carrier: string): string[] {
  return Object.values(POLICY_CARRIER_MAPPINGS)
    .filter(mapping => mapping.carrier === carrier)
    .map(mapping => mapping.policyType)
}

// Get coverage levels for a policy type
export function getCoverageLevels(policyType: string): string[] {
  const mapping = POLICY_CARRIER_MAPPINGS[policyType]
  return mapping?.coverageLevels || []
}

// Get plan variants for a policy type
export function getPlanVariants(policyType: string): string[] {
  const mapping = POLICY_CARRIER_MAPPINGS[policyType]
  return mapping?.planVariants || []
}

// Validate if a policy type is supported
export function isPolicyTypeSupported(policyType: string): boolean {
  return policyType in POLICY_CARRIER_MAPPINGS
}

// Get policy mapping details
export function getPolicyMapping(policyType: string): PolicyCarrierMapping | null {
  return POLICY_CARRIER_MAPPINGS[policyType] || null
}