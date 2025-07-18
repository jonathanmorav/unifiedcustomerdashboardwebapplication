// Dwolla API Types

export interface DwollaCustomer {
  id: string
  status: "unverified" | "suspended" | "verified" | "retry" | "document" | "deactivated"
  type: "personal" | "business" | "receive-only"
  firstName: string
  lastName: string
  email: string
  businessName?: string
  created: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postalCode?: string
  phone?: string
  correlationId?: string
  _links: {
    self: { href: string }
    "funding-sources": { href: string }
    transfers: { href: string }
    notifications: { href: string }
    [key: string]: { href: string }
  }
}

export interface DwollaFundingSource {
  id: string
  status: "unverified" | "verified" | "removed"
  type: "bank" | "balance"
  bankAccountType?: "checking" | "savings"
  name: string
  created: string
  balance?: {
    value: string
    currency: string
  }
  removed?: boolean
  channels?: string[]
  bankName?: string
  fingerprint?: string
  // Sensitive data - we'll mask these
  accountNumber?: string
  routingNumber?: string
  _links: {
    self: { href: string }
    customer: { href: string }
    [key: string]: { href: string }
  }
}

export interface DwollaTransfer {
  id: string
  status: "pending" | "processed" | "failed" | "cancelled" | "reclaimed"
  amount: {
    value: string
    currency: string
  }
  created: string
  metadata?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  fees?: Array<{
    amount: {
      value: string
      currency: string
    }
    _links: {
      "charged-to": { href: string }
    }
  }>
  correlationId?: string
  individualAchId?: string
  _links: {
    self: { href: string }
    source: { href: string }
    destination: { href: string }
    [key: string]: { href: string }
  }
}

export interface DwollaNotification {
  id: string
  created: string
  topic: string
  accountId: string
  eventId: string
  subscriptionId: string
  attempts: Array<{
    id: string
    request: {
      timestamp: string
      url: string
      headers: Array<{
        name: string
        value: string
      }>
      body: string
    }
    response?: {
      timestamp: string
      headers: Array<{
        name: string
        value: string
      }>
      statusCode: number
      body: string
    }
  }>
  _links: {
    self: { href: string }
    webhook_subscription: { href: string }
    retry_webhook: { href: string }
    event: { href: string }
    [key: string]: { href: string }
  }
}

// API Response types
export interface DwollaListResponse<T> {
  _embedded: {
    [key: string]: T[]
  }
  _links: {
    self: { href: string }
    first?: { href: string }
    last?: { href: string }
    next?: { href: string }
    prev?: { href: string }
  }
  total?: number
}

export interface DwollaError {
  code: string
  message: string
  _embedded?: {
    errors?: Array<{
      code: string
      message: string
      path?: string
      _links?: Record<string, { href: string }>
    }>
  }
}

export interface DwollaTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  refresh_token?: string
  refresh_expires_in?: number
  account_id?: string
}

// Search types
export interface DwollaSearchParams {
  email?: string
  status?: DwollaCustomer["status"]
  limit?: number
  offset?: number
}

// Consolidated result type for our dashboard
export interface DwollaCustomerData {
  customer: DwollaCustomer
  fundingSources: MaskedFundingSource[]
  transfers: DwollaTransfer[]
  notifications: DwollaNotification[]
}

// Masked funding source for display
export interface MaskedFundingSource
  extends Omit<DwollaFundingSource, "accountNumber" | "routingNumber"> {
  accountNumberMasked?: string // Last 4 digits only
  routingNumber?: string // Can show full routing number
}
