// HubSpot API Types

// API Response types
export interface HubSpotObject<T> {
  id: string
  properties: T
  createdAt: string
  updatedAt: string
  archived: boolean
  associations?: HubSpotAssociations
}

export interface HubSpotAssociations {
  companies?: {
    results: HubSpotAssociation[]
  }
  summary_of_benefits?: {
    results: HubSpotAssociation[]
  }
  policies?: {
    results: HubSpotAssociation[]
  }
  monthly_invoices?: {
    results: HubSpotAssociation[]
  }
}

export interface HubSpotAssociation {
  id: string
  type: string
}

export type HubSpotCompany = HubSpotObject<{
  name: string
  domain?: string
  hs_object_id: string
  createdate: string
  hs_lastmodifieddate: string
  email___owner?: string
  dwolla_customer_id?: string // Custom property to link with Dwolla (updated property name)
  onboarding_status?: string // Custom property for onboarding status
  onboarding_step?: string // Custom property for onboarding step
  [key: string]: string | number | boolean | undefined
}>

export type HubSpotSummaryOfBenefits = HubSpotObject<{
  hs_object_id: string
  amount_to_draft: number
  fee_amount: number
  pdf_document_url?: string
  createdate: string
  hs_lastmodifieddate: string
  [key: string]: string | number | boolean | undefined
}>

export type HubSpotPolicy = HubSpotObject<{
  policy_number: string
  policy_holder_name: string
  coverage_type: string
  premium_amount: number
  effective_date: string
  expiration_date?: string
  status: string
  [key: string]: string | number | boolean | undefined
}>

export type HubSpotMonthlyInvoice = HubSpotObject<{
  invoice_number: string
  invoice_date: string
  total_amount: number
  status: string
  [key: string]: string | number | boolean | undefined
}>

// List-related types
export interface HubSpotList {
  listId: number
  parentId?: number
  name: string
  objectTypeId: string
  listType: "STATIC" | "DYNAMIC"
  membershipCount: number
  createdAt: string
  updatedAt: string
  filters?: HubSpotListFilter[]
}

export interface HubSpotListFilter {
  filterFamily: string
  withinTimeMode: string
  checkPastVersions: boolean
  filterLines: Array<{
    property: string
    operation: {
      operationType: string
      includeObjectsWithNoValueSet: boolean
    }
    value: string | number | boolean
  }>
}

export interface HubSpotListMembership {
  listId: number
  listName: string
  listType: "STATIC" | "DYNAMIC"
  membershipTimestamp?: string
}

export interface HubSpotListsResponse {
  lists: HubSpotList[]
  hasMore: boolean
  offset?: number
  total?: number
}

export interface HubSpotListMembershipsResponse {
  lists: HubSpotListMembership[]
  total: number
}

export interface HubSpotListTrend {
  listId: number
  listName: string
  date: string
  memberCount: number
}

export interface HubSpotSearchResponse<T> {
  total: number
  results: HubSpotObject<T>[]
  paging?: {
    next?: {
      after: string
      link: string
    }
  }
}

export interface HubSpotBatchReadResponse<T> {
  status: "COMPLETE" | "PENDING" | "PROCESSING"
  results: HubSpotObject<T>[]
  numErrors?: number
  errors?: HubSpotError[]
}

export interface HubSpotError {
  status: string
  message: string
  correlationId: string
  category?: string
  errors?: Array<{
    message: string
    in: string
    code: string
    subCategory?: string
  }>
}

// Search request types
export interface HubSpotSearchRequest {
  filterGroups?: Array<{
    filters: Array<{
      propertyName: string
      operator: HubSpotFilterOperator
      value: string | number | boolean
    }>
  }>
  properties?: string[]
  limit?: number
  after?: string
  sorts?: Array<{
    propertyName: string
    direction: "ASCENDING" | "DESCENDING"
  }>
}

export type HubSpotFilterOperator =
  | "EQ"
  | "NEQ"
  | "LT"
  | "LTE"
  | "GT"
  | "GTE"
  | "CONTAINS_TOKEN"
  | "NOT_CONTAINS_TOKEN"
  | "HAS_PROPERTY"
  | "NOT_HAS_PROPERTY"
  | "IN"
  | "NOT_IN"

// Object types in HubSpot
export type HubSpotObjectType =
  | "companies"
  | "contacts"
  | "deals"
  | "tickets"
  | "summary_of_benefits"
  | "policies"
  | "monthly_invoices"
  | "lists"

// Clarity session types
export interface ClaritySessionEvent {
  event: string // "Login", "Submit form", etc.
  type: string // "Auto", "Manual", etc.
  startTime: string // "00:41" format
  timestamp?: number
}

export interface ClaritySession {
  id: string
  recordingUrl: string
  timestamp: Date
  duration?: number
  smartEvents: ClaritySessionEvent[]
  deviceType?: string
  browser?: string
}

// Engagement types - Updated to match HubSpot v3 API response
export interface HubSpotEngagement {
  id: string
  properties: {
    hs_engagement_type?: string // "CALL", "EMAIL", "MEETING", "NOTE", "TASK", etc.
    hs_timestamp?: string
    hs_body_preview?: string
    hs_body_preview_html?: string
    hs_body_preview_is_truncated?: boolean
    hs_activity_type?: string
    hs_all_accessible_team_ids?: string
    hs_createdate?: string
    hs_lastmodifieddate?: string
    hs_object_id?: string
    // Custom properties that might contain Clarity data
    clarity_session_id?: string
    clarity_recording_url?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
  archived?: boolean
}

// Engagements API response
export interface HubSpotEngagementsResponse {
  results: HubSpotEngagement[]
  hasMore: boolean
  offset?: number
  total?: number
}

// Consolidated result type for our dashboard
export interface HubSpotCustomerData {
  company: HubSpotObject<HubSpotCompany["properties"]> | null
  summaryOfBenefits: HubSpotObject<HubSpotSummaryOfBenefits["properties"]>[]
  policies: HubSpotObject<HubSpotPolicy["properties"]>[]
  monthlyInvoices?: HubSpotObject<HubSpotMonthlyInvoice["properties"]>[]
  activeLists?: HubSpotListMembership[]
  claritySessions?: ClaritySession[]
}
