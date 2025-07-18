import { getEnv } from "@/lib/env"
import type {
  HubSpotCompany,
  HubSpotSummaryOfBenefits,
  HubSpotPolicy,
  HubSpotMonthlyInvoice,
  HubSpotObject,
  HubSpotSearchResponse,
  HubSpotSearchRequest,
  HubSpotObjectType,
  HubSpotBatchReadResponse,
} from "@/lib/types/hubspot"

interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

export class HubSpotAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public correlationId?: string,
    public errors?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    super(message)
    this.name = "HubSpotAPIError"
  }
}

export class HubSpotClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly retryConfig: RetryConfig

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    const env = getEnv()
    this.apiKey = env.HUBSPOT_API_KEY
    this.baseUrl = env.HUBSPOT_BASE_URL
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Check if it's a rate limit error
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After")
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryConfig.initialDelay

          if (retryCount < this.retryConfig.maxRetries) {
            console.warn(`Rate limited. Retrying after ${delay}ms...`)
            await this.sleep(delay)
            return this.fetchWithRetry<T>(url, options, retryCount + 1)
          }
        }

        // Check if it's a temporary error that should be retried
        if (
          response.status >= 500 &&
          response.status < 600 &&
          retryCount < this.retryConfig.maxRetries
        ) {
          const delay = Math.min(
            this.retryConfig.initialDelay *
              Math.pow(this.retryConfig.backoffMultiplier, retryCount),
            this.retryConfig.maxDelay
          )

          console.warn(`Server error (${response.status}). Retrying after ${delay}ms...`)
          await this.sleep(delay)
          return this.fetchWithRetry<T>(url, options, retryCount + 1)
        }

        throw new HubSpotAPIError(
          errorData.message || `HubSpot API error: ${response.statusText}`,
          response.status,
          errorData.correlationId,
          errorData.errors
        )
      }

      return response.json()
    } catch (error) {
      // Network errors or other fetch failures
      if (error instanceof HubSpotAPIError) {
        throw error
      }

      if (retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
          this.retryConfig.maxDelay
        )

        console.warn(`Network error. Retrying after ${delay}ms...`, error)
        await this.sleep(delay)
        return this.fetchWithRetry<T>(url, options, retryCount + 1)
      }

      throw new HubSpotAPIError(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  // Search for objects using HubSpot's search API
  async searchObjects<T>(
    objectType: HubSpotObjectType,
    searchRequest: HubSpotSearchRequest
  ): Promise<HubSpotSearchResponse<T>> {
    const url = `${this.baseUrl}/crm/v3/objects/${objectType}/search`

    return this.fetchWithRetry<HubSpotSearchResponse<T>>(url, {
      method: "POST",
      body: JSON.stringify(searchRequest),
    })
  }

  // Get a single object by ID
  async getObjectById<T>(
    objectType: HubSpotObjectType,
    objectId: string,
    properties?: string[],
    associations?: string[]
  ): Promise<HubSpotObject<T>> {
    const params = new URLSearchParams()

    if (properties?.length) {
      params.append("properties", properties.join(","))
    }

    if (associations?.length) {
      params.append("associations", associations.join(","))
    }

    const url = `${this.baseUrl}/crm/v3/objects/${objectType}/${objectId}?${params.toString()}`

    return this.fetchWithRetry<HubSpotObject<T>>(url)
  }

  // Batch read objects by IDs
  async batchReadObjects<T>(
    objectType: HubSpotObjectType,
    objectIds: string[],
    properties?: string[]
  ): Promise<HubSpotBatchReadResponse<T>> {
    const url = `${this.baseUrl}/crm/v3/objects/${objectType}/batch/read`

    const requestBody = {
      inputs: objectIds.map((id) => ({ id })),
      properties: properties || [],
    }

    return this.fetchWithRetry<HubSpotBatchReadResponse<T>>(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })
  }

  // Get associations for an object
  async getAssociations(
    fromObjectType: HubSpotObjectType,
    fromObjectId: string,
    toObjectType: HubSpotObjectType
  ): Promise<{ results: Array<{ id: string; type: string }> }> {
    const url = `${this.baseUrl}/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}`

    return this.fetchWithRetry(url)
  }

  // High-level method to search companies
  async searchCompanies(
    searchTerm: string,
    searchType: "email" | "name" | "dwolla_id"
  ): Promise<HubSpotObject<HubSpotCompany["properties"]>[]> {
    const searchRequest: HubSpotSearchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName:
                searchType === "email"
                  ? "owner_email"
                  : searchType === "dwolla_id"
                    ? "dwolla_id"
                    : "name",
              operator: searchType === "name" ? "CONTAINS_TOKEN" : "EQ",
              value: searchTerm,
            },
          ],
        },
      ],
      properties: ["name", "domain", "owner_email", "dwolla_id", "hs_object_id"],
      limit: 10,
    }

    const response = await this.searchObjects<HubSpotCompany["properties"]>(
      "companies",
      searchRequest
    )

    return response.results
  }

  // Get all Summary of Benefits for a company
  async getCompanySummaryOfBenefits(
    companyId: string
  ): Promise<HubSpotObject<HubSpotSummaryOfBenefits["properties"]>[]> {
    // First, get the associations
    const associations = await this.getAssociations("companies", companyId, "summary_of_benefits")

    if (!associations.results.length) {
      return []
    }

    // Batch read all associated SOBs
    const sobIds = associations.results.map((a) => a.id)
    const response = await this.batchReadObjects<HubSpotSummaryOfBenefits["properties"]>(
      "summary_of_benefits",
      sobIds,
      ["amount_to_draft", "fee_amount", "pdf_document_url", "hs_object_id"]
    )

    return response.results
  }

  // Get all policies associated with a Summary of Benefits
  async getSummaryOfBenefitsPolicies(
    sobId: string
  ): Promise<HubSpotObject<HubSpotPolicy["properties"]>[]> {
    // Get associations
    const associations = await this.getAssociations("summary_of_benefits", sobId, "policies")

    if (!associations.results.length) {
      return []
    }

    // Batch read all associated policies
    const policyIds = associations.results.map((a) => a.id)
    const response = await this.batchReadObjects<HubSpotPolicy["properties"]>(
      "policies",
      policyIds,
      [
        "policy_number",
        "policy_holder_name",
        "coverage_type",
        "premium_amount",
        "effective_date",
        "expiration_date",
        "status",
      ]
    )

    return response.results
  }

  // Get monthly invoices (if associated with company or SOB)
  async getMonthlyInvoices(
    objectType: HubSpotObjectType,
    objectId: string
  ): Promise<HubSpotObject<HubSpotMonthlyInvoice["properties"]>[]> {
    try {
      const associations = await this.getAssociations(objectType, objectId, "monthly_invoices")

      if (!associations.results.length) {
        return []
      }

      const invoiceIds = associations.results.map((a) => a.id)
      const response = await this.batchReadObjects<HubSpotMonthlyInvoice["properties"]>(
        "monthly_invoices",
        invoiceIds,
        ["invoice_number", "invoice_date", "total_amount", "status"]
      )

      return response.results
    } catch (error) {
      // Monthly invoices might not be configured, so we handle this gracefully
      console.warn("Could not fetch monthly invoices:", error)
      return []
    }
  }
}
