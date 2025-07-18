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
  owner_email?: string
  dwolla_id?: string // Custom property to link with Dwolla
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

// Consolidated result type for our dashboard
export interface HubSpotCustomerData {
  company: HubSpotObject<HubSpotCompany["properties"]> | null
  summaryOfBenefits: HubSpotObject<HubSpotSummaryOfBenefits["properties"]>[]
  policies: HubSpotObject<HubSpotPolicy["properties"]>[]
  monthlyInvoices?: HubSpotObject<HubSpotMonthlyInvoice["properties"]>[]
}
