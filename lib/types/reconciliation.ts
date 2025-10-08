/**
 * Types and interfaces for premium reconciliation functionality
 */

// Policy-Carrier Mapping Types
export interface PolicyCarrierMapping {
  policyType: string
  carrier: string
  coverageLevels: string[]
  coverageAmountRanges: {
    min: number
    max: number
    increments: number
  }[]
  planVariants: string[]
}

// Premium Reconciliation Types
export interface EmployeeCoverage {
  employeeId: string
  employeeName: string
  policies: PolicyLineItem[]
}

export interface PolicyLineItem {
  policyId: string
  policyType: string
  policyNumber: string
  coverageAmount: number
  coverageLevel: string
  premiumDue: number
  carrier: string
  planVariant?: string
}

export interface SummaryOfBenefitsReconciliation {
  clientId: string
  clientName: string
  dwollaCustomerId: string
  billingPeriod: string
  employees: EmployeeCoverage[]
  totalAmountDue: number
  paymentStatus: 'pending' | 'processed' | 'failed'
  paymentDate?: Date
  dwollaTransactionId?: string
}

// Carrier Breakdown Types
export interface CarrierPremiumBreakdown {
  carrier: string
  totalPremium: number
  policyBreakdown: {
    policyType: string
    totalPremium: number
    policyCount: number
    lineItems: {
      clientId: string
      clientName: string
      employeeId: string
      employeeName: string
      policyNumber: string
      premium: number
      coverageLevel: string
      coverageAmount: number
    }[]
  }[]
}

// Reconciliation Report Types
export interface ReconciliationReport {
  reportId: string
  reportDate: Date
  billingPeriod: string
  totalCollected: number
  totalAccountsProcessed: number
  carrierRemittances: {
    carrier: string
    totalDue: number
    policyDetails: {
      policyType: string
      count: number
      totalPremium: number
      clientRoster: {
        clientId: string
        clientName: string
        employeeCount: number
        totalPremium: number
      }[]
    }[]
  }[]
  reconciliationSummary: {
    totalAccountsProcessed: number
    totalEmployeesCovered: number
    totalPolicies: number
    discrepancies: ValidationError[]
  }
}

// Validation Types
export interface ValidationError {
  type: 'missing_mapping' | 'amount_mismatch' | 'missing_account' | 'data_inconsistency'
  severity: 'error' | 'warning'
  message: string
  details: any
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

// Carrier Remittance Types
export interface CarrierRemittanceFile {
  carrier: string
  remittanceDate: Date
  billingPeriod: string
  totalAmount: number
  fileFormat: 'csv' | 'xlsx' | 'pdf'
  policies: {
    policyType: string
    details: {
      clientId: string
      clientName: string
      employeeId: string
      employeeName: string
      policyNumber: string
      premium: number
      coverageLevel: string
      coverageAmount: number
    }[]
  }[]
}

// API Response Types
export interface ReconciliationJobResponse {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  report?: ReconciliationReport
  validationResult?: ValidationResult
  carrierFiles?: CarrierRemittanceFile[]
  startedAt: Date
  completedAt?: Date
  error?: string
}

// Filter Types for UI
export interface ReconciliationFilters {
  billingPeriod?: string
  carrier?: string
  paymentStatus?: ('pending' | 'processed' | 'failed')[]
  dateRange?: {
    start: Date
    end: Date
  }
  clientName?: string
}