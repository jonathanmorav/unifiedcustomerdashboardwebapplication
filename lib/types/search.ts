import type { HubSpotCustomerData } from "./hubspot"
import type { DwollaCustomerData } from "./dwolla"

// Extended search types for advanced filtering
export type SearchType = "email" | "name" | "business_name" | "dwolla_id" | "auto"

export type CustomerStatus = "active" | "inactive" | "verified" | "unverified" | "suspended"
export type TransferStatus = "completed" | "pending" | "failed" | "cancelled" | "processed"
export type FundingSourceStatus = "verified" | "unverified"

// Date range for filtering
export interface DateRange {
  start: Date | string
  end: Date | string
}

// Amount range for filtering
export interface AmountRange {
  min: number
  max: number
  currency?: string // Default: USD
}

// Sort options
export type SortField = 
  | "relevance" 
  | "date_created" 
  | "date_modified" 
  | "amount" 
  | "customer_name" 
  | "company_name"
  | "status"

export type SortOrder = "asc" | "desc"

export interface SortOptions {
  field: SortField
  order: SortOrder
}

// Pagination options
export interface PaginationOptions {
  page: number
  pageSize: number
  total?: number
}

// Advanced filter options
export interface SearchFilters {
  // Status filters
  customerStatus?: CustomerStatus[]
  transferStatus?: TransferStatus[]
  fundingSourceStatus?: FundingSourceStatus[]
  
  // Date filters
  createdDateRange?: DateRange
  modifiedDateRange?: DateRange
  transferDateRange?: DateRange
  
  // Amount filters
  transferAmountRange?: AmountRange
  benefitAmountRange?: AmountRange
  
  // Other filters
  hasFailedTransfers?: boolean
  hasUnverifiedFunding?: boolean
  hasPendingInvoices?: boolean
  
  // Data source filters
  searchIn?: ("hubspot" | "dwolla" | "both")
}

// Enhanced search parameters
export interface AdvancedSearchParams {
  searchTerm: string
  searchType?: SearchType
  filters?: SearchFilters
  sort?: SortOptions
  pagination?: PaginationOptions
  signal?: AbortSignal
}

// Enhanced search result
export interface AdvancedSearchResult {
  searchTerm: string
  searchType: SearchType
  timestamp: Date
  duration: number
  
  // Applied filters summary
  appliedFilters?: SearchFilters
  
  // Pagination info
  pagination?: {
    currentPage: number
    pageSize: number
    totalResults: number
    totalPages: number
  }
  
  // Results from each system
  hubspot: {
    success: boolean
    data?: HubSpotCustomerData[]
    error?: string
    duration: number
    totalCount?: number
  }
  
  dwolla: {
    success: boolean
    data?: DwollaCustomerData[]
    error?: string
    duration: number
    totalCount?: number
  }
  
  // Aggregated statistics
  statistics?: {
    totalCustomers: number
    activeCustomers: number
    totalTransferAmount: number
    failedTransfersCount: number
    unverifiedFundingCount: number
  }
}

// Saved search
export interface SavedSearch {
  id: string
  userId: string
  name: string
  description?: string
  searchParams: AdvancedSearchParams
  createdAt: Date
  updatedAt: Date
  lastUsed?: Date
  useCount: number
  isTemplate?: boolean // System-provided templates
  isPublic?: boolean // Shared with team
}

// Search template (preset)
export interface SearchTemplate {
  id: string
  name: string
  description: string
  icon?: string
  category: "common" | "verification" | "financial" | "compliance" | "custom"
  searchParams: Partial<AdvancedSearchParams>
  tags?: string[]
}

// Search suggestion for autocomplete
export interface SearchSuggestion {
  type: "recent" | "saved" | "template" | "customer" | "company"
  value: string
  label: string
  metadata?: {
    lastUsed?: Date
    useCount?: number
    icon?: string
    description?: string
  }
}

// Filter option for UI
export interface FilterOption<T = string> {
  value: T
  label: string
  count?: number // Number of results with this filter
  disabled?: boolean
}

// Available filter options (for UI)
export interface AvailableFilters {
  customerStatus: FilterOption<CustomerStatus>[]
  transferStatus: FilterOption<TransferStatus>[]
  fundingSourceStatus: FilterOption<FundingSourceStatus>[]
  dateRanges: {
    label: string
    value: DateRange
  }[]
}

// Export formats
export type ExportFormat = "csv" | "json" | "pdf" | "excel"

export interface ExportOptions {
  format: ExportFormat
  includeFields?: string[]
  excludeFields?: string[]
  filename?: string
  filters?: SearchFilters
}