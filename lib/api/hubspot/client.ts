import { getEnv } from "@/lib/env"
import { CorrelationTracking } from "@/lib/security/correlation"
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
  HubSpotList,
  HubSpotListMembership,
  HubSpotListsResponse,
  HubSpotListMembershipsResponse,
  HubSpotEngagement,
  ClaritySession,
  ClaritySessionEvent,
} from "@/lib/types/hubspot"
import { log } from "@/lib/logger"

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
      // Add correlation headers
      const correlationHeaders = await CorrelationTracking.addCorrelationHeaders(options.headers)
      
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...correlationHeaders,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Check if it's a rate limit error
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After")
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryConfig.initialDelay

          if (retryCount < this.retryConfig.maxRetries) {
            await CorrelationTracking.log('warn', `HubSpot rate limited. Retrying after ${delay}ms`, {
              url,
              status: response.status,
              retryCount,
              delay
            })
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

          log.warn(`Server error (${response.status}). Retrying after ${delay}ms...`, {
            status: response.status,
            delay,
            retryCount,
            url,
            operation: 'hubspot_server_error'
          })
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

        log.warn(`Network error. Retrying after ${delay}ms...`, {
          delay,
          retryCount,
          url,
          error: error instanceof Error ? error.message : String(error),
          operation: 'hubspot_network_error'
        })
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
    toObjectType: HubSpotObjectType | string
  ): Promise<{ results: Array<{ id: string; type: string }> }> {
    const url = `${this.baseUrl}/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}`

    return this.fetchWithRetry(url)
  }

  // High-level method to search companies
  async searchCompanies(
    searchTerm: string,
    searchType: "email" | "name" | "dwolla_id"
  ): Promise<HubSpotObject<HubSpotCompany["properties"]>[]> {
    await log.info(`Starting HubSpot company search`, {
      searchTerm,
      searchType,
      operation: 'hubspot_search_companies_start'
    })

    const searchRequest: HubSpotSearchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName:
                searchType === "email"
                  ? "email___owner"
                  : searchType === "dwolla_id"
                    ? "dwolla_customer_id"
                    : "name",
              operator: searchType === "name" ? "CONTAINS_TOKEN" : "EQ",
              value: searchTerm,
            },
          ],
        },
      ],
      properties: ["name", "domain", "email___owner", "dwolla_customer_id", "onboarding_status", "onboarding_step", "hs_object_id"],
      limit: 10,
    }

    await log.info(`HubSpot search request prepared`, {
      searchRequest: JSON.stringify(searchRequest, null, 2),
      url: `${this.baseUrl}/crm/v3/objects/companies/search`,
      operation: 'hubspot_search_companies_request'
    })

    try {
      const response = await this.searchObjects<HubSpotCompany["properties"]>(
        "companies",
        searchRequest
      )

      await log.info(`HubSpot company search completed`, {
        resultsCount: response.results.length,
        totalResults: response.total,
        hasMore: response.paging?.next?.after ? true : false,
        operation: 'hubspot_search_companies_success'
      })

      // Log first result for debugging (without sensitive data)
      if (response.results.length > 0) {
        const firstResult = response.results[0]
        await log.info(`First search result sample`, {
          id: firstResult.id,
          properties: {
            name: firstResult.properties?.name,
            domain: firstResult.properties?.domain,
            hasOwnerEmail: !!firstResult.properties?.email___owner,
            hasDwollaId: !!firstResult.properties?.dwolla_customer_id
          },
          operation: 'hubspot_search_companies_sample'
        })
      }

      return response.results
    } catch (error) {
      await log.error(`HubSpot company search failed`, {
        searchTerm,
        searchType,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'hubspot_search_companies_error'
      })
      throw error
    }
  }

  // Get all Summary of Benefits for a company
  async getCompanySummaryOfBenefits(
    companyId: string
  ): Promise<HubSpotObject<HubSpotSummaryOfBenefits["properties"]>[]> {
    await log.info(`Starting Summary of Benefits retrieval`, {
      companyId,
      operation: 'hubspot_get_sob_start'
    })

    try {
      // First, get the associations
      await log.info(`Fetching SOB associations for company`, {
        companyId,
        url: `${this.baseUrl}/crm/v3/objects/companies/${companyId}/associations/2-45680577`,
        operation: 'hubspot_get_sob_associations'
      })

      const associations = await this.getAssociations("companies", companyId, "2-45680577")

      await log.info(`SOB associations retrieved`, {
        companyId,
        associationsCount: associations.results.length,
        associationIds: associations.results.map(a => a.id),
        operation: 'hubspot_get_sob_associations_success'
      })

      if (!associations.results.length) {
        await log.info(`No SOB associations found for company`, {
          companyId,
          operation: 'hubspot_get_sob_no_associations'
        })
        return []
      }

      // Batch read all associated SOBs
      const sobIds = associations.results.map((a) => a.id)
      await log.info(`Starting batch read of SOB objects`, {
        companyId,
        sobIds,
        sobCount: sobIds.length,
        properties: ["amount_to_draft", "fee_amount", "pdf_document_url", "hs_object_id"],
        url: `${this.baseUrl}/crm/v3/objects/summary_of_benefits/batch/read`,
        operation: 'hubspot_get_sob_batch_read_start'
      })

      const response = await this.batchReadObjects<HubSpotSummaryOfBenefits["properties"]>(
        "2-45680577",
        sobIds,
        ["amount_to_draft", "fee_amount", "pdf_document_url", "hs_object_id"]
      )

      await log.info(`SOB batch read completed`, {
        companyId,
        requestedCount: sobIds.length,
        retrievedCount: response.results.length,
        hasStatusInfo: !!response.status,
        operation: 'hubspot_get_sob_batch_read_success'
      })

      // Log sample of retrieved SOB data (without sensitive info)
      if (response.results.length > 0) {
        const firstSob = response.results[0]
        await log.info(`First SOB sample`, {
          companyId,
          sobId: firstSob.id,
          properties: {
            hasAmountToDraft: !!firstSob.properties?.amount_to_draft,
            hasFeeAmount: !!firstSob.properties?.fee_amount,
            hasPdfUrl: !!firstSob.properties?.pdf_document_url,
            hasObjectId: !!firstSob.properties?.hs_object_id
          },
          operation: 'hubspot_get_sob_sample'
        })
      }

      return response.results
    } catch (error) {
      await log.error(`SOB retrieval failed`, {
        companyId,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'hubspot_get_sob_error'
      })
      throw error
    }
  }

  // Get all policies associated with a Summary of Benefits
  async getSummaryOfBenefitsPolicies(
    sobId: string
  ): Promise<HubSpotObject<HubSpotPolicy["properties"]>[]> {
    // Get associations
    const associations = await this.getAssociations("2-45680577", sobId, "2-45586773")

    if (!associations.results.length) {
      return []
    }

    // Batch read all associated policies
    const policyIds = associations.results.map((a) => a.id)
    const response = await this.batchReadObjects<HubSpotPolicy["properties"]>(
      "2-45586773",
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
      const associations = await this.getAssociations(objectType, objectId, "2-47684489")

      if (!associations.results.length) {
        return []
      }

      const invoiceIds = associations.results.map((a) => a.id)
      const response = await this.batchReadObjects<HubSpotMonthlyInvoice["properties"]>(
        "2-47684489",
        invoiceIds,
        ["invoice_number", "invoice_date", "total_amount", "status"]
      )

      return response.results
    } catch (error) {
      // Monthly invoices might not be configured, so we handle this gracefully
      log.warn("Could not fetch monthly invoices", {
        error: error instanceof Error ? error.message : String(error),
        objectType,
        objectId,
        operation: 'hubspot_fetch_invoices'
      })
      return []
    }
  }

  // Get all lists (with pagination support)
  async getAllLists(
    limit = 50,
    offset = 0
  ): Promise<HubSpotListsResponse> {
    const url = `${this.baseUrl}/contacts/v1/lists`
    const params = new URLSearchParams({
      count: limit.toString(),
      offset: offset.toString(),
    })

    const response = await this.fetchWithRetry<any>(
      `${url}?${params.toString()}`
    )
    
    // Log the raw response to check field names
    if (response.lists && response.lists.length > 0) {
      const sampleList = response.lists[0]
      await log.info("HubSpot Lists API raw response", {
        sampleList: {
          listId: sampleList.listId,
          name: sampleList.name,
          listType: sampleList.listType,
          hasMetaData: !!sampleList.metaData,
          metaDataSize: sampleList.metaData?.size,
          hasSize: 'size' in sampleList,
          sizeValue: sampleList.size,
          hasMembershipCount: 'membershipCount' in sampleList,
          membershipCountValue: sampleList.membershipCount,
          allKeys: Object.keys(sampleList)
        },
        totalLists: response.lists.length,
        operation: "hubspot_lists_raw_response"
      })
    }

    return response
  }

  // Get list details by ID
  async getListById(listId: number): Promise<HubSpotList> {
    const url = `${this.baseUrl}/contacts/v1/lists/${listId}`
    
    return this.fetchWithRetry<HubSpotList>(url)
  }

  // Get list memberships for a contact
  async getContactListMemberships(
    contactId: string
  ): Promise<HubSpotListMembershipsResponse> {
    await log.info(`Getting list memberships for contact`, {
      contactId,
      operation: 'hubspot_get_contact_lists_start'
    })

    const url = `${this.baseUrl}/contacts/v1/contact/vid/${contactId}/lists`

    try {
      const response = await this.fetchWithRetry<{
        lists: Array<{
          listId: number
          name: string
          internal: boolean
          listType: "STATIC" | "DYNAMIC"
          metaData: {
            processing: string
            size: number
          }
          updatedAt: number
          internalListId: number
        }>
      }>(url)

      // Transform to our interface format
      const memberships: HubSpotListMembershipsResponse = {
        lists: response.lists
          .filter(list => !list.internal) // Filter out internal HubSpot lists
          .map(list => ({
            listId: list.listId,
            listName: list.name,
            listType: list.listType,
            membershipTimestamp: new Date(list.updatedAt).toISOString()
          })),
        total: response.lists.filter(list => !list.internal).length
      }

      await log.info(`Retrieved list memberships for contact`, {
        contactId,
        totalLists: memberships.total,
        listNames: memberships.lists.map(l => l.listName),
        operation: 'hubspot_get_contact_lists_success'
      })

      return memberships
    } catch (error) {
      await log.error(`Failed to get list memberships`, {
        contactId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'hubspot_get_contact_lists_error'
      })
      throw error
    }
  }

  // Get contacts associated with a company
  async getCompanyContacts(
    companyId: string
  ): Promise<Array<{ id: string; properties: { email?: string } }>> {
    await log.info(`Getting contacts for company`, {
      companyId,
      operation: 'hubspot_get_company_contacts_start'
    })

    try {
      // Get contact associations
      const associations = await this.getAssociations("companies", companyId, "contacts")

      if (!associations.results.length) {
        await log.info(`No contacts found for company`, {
          companyId,
          operation: 'hubspot_get_company_contacts_empty'
        })
        return []
      }

      // Batch read contact details
      const contactIds = associations.results.map((a) => a.id)
      const response = await this.batchReadObjects<{ email?: string }>(
        "contacts",
        contactIds,
        ["email"]
      )

      await log.info(`Retrieved contacts for company`, {
        companyId,
        contactCount: response.results.length,
        operation: 'hubspot_get_company_contacts_success'
      })

      return response.results
    } catch (error) {
      await log.error(`Failed to get company contacts`, {
        companyId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'hubspot_get_company_contacts_error'
      })
      throw error
    }
  }

  // Get aggregated list memberships for a company (via its contacts)
  async getCompanyListMemberships(
    companyId: string
  ): Promise<HubSpotListMembershipsResponse> {
    await log.info(`Getting list memberships for company`, {
      companyId,
      operation: 'hubspot_get_company_lists_start'
    })

    try {
      // First get all contacts for the company
      const contacts = await this.getCompanyContacts(companyId)

      if (!contacts.length) {
        return { lists: [], total: 0 }
      }

      // Get list memberships for each contact
      const allMemberships = await Promise.all(
        contacts.map(contact => 
          this.getContactListMemberships(contact.id).catch(() => ({ lists: [], total: 0 }))
        )
      )

      // Aggregate and deduplicate lists
      const listMap = new Map<number, HubSpotListMembership>()
      
      allMemberships.forEach(membership => {
        membership.lists.forEach(list => {
          if (!listMap.has(list.listId)) {
            listMap.set(list.listId, list)
          }
        })
      })

      const aggregatedLists = Array.from(listMap.values())

      await log.info(`Aggregated list memberships for company`, {
        companyId,
        contactCount: contacts.length,
        uniqueListCount: aggregatedLists.length,
        listNames: aggregatedLists.map(l => l.listName),
        operation: 'hubspot_get_company_lists_success'
      })

      return {
        lists: aggregatedLists,
        total: aggregatedLists.length
      }
    } catch (error) {
      await log.error(`Failed to get company list memberships`, {
        companyId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'hubspot_get_company_lists_error'
      })
      return { lists: [], total: 0 }
    }
  }

  // Get engagements for a contact
  async getContactEngagements(
    contactId: string,
    limit = 100
  ): Promise<HubSpotEngagement[]> {
    try {
      // HubSpot v3 Engagements API endpoint
      const url = `${this.baseUrl}/crm/v3/objects/contacts/${contactId}/associations/engagements`
      
      const response = await this.fetchWithRetry<{
        results: Array<{ id: string; type: string }>
      }>(url)

      if (!response.results || response.results.length === 0) {
        return []
      }

      // Fetch full engagement details
      const engagementIds = response.results.map(r => r.id)
      const engagements = await this.batchReadEngagements(engagementIds)

      return engagements
    } catch (error) {
      log.warn("Failed to fetch contact engagements", {
        contactId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'hubspot_get_contact_engagements'
      })
      return []
    }
  }

  // Batch read engagements
  private async batchReadEngagements(
    engagementIds: string[]
  ): Promise<HubSpotEngagement[]> {
    if (engagementIds.length === 0) return []

    try {
      const url = `${this.baseUrl}/crm/v3/objects/engagements/batch/read`
      
      const response = await this.fetchWithRetry<{
        results: HubSpotEngagement[]
      }>(url, {
        method: "POST",
        body: JSON.stringify({
          inputs: engagementIds.map(id => ({ id })),
          properties: ["hs_timestamp", "hs_engagement_type", "hs_body_preview", "hs_activity_type", "hs_all_accessible_team_ids", "hs_body_preview_html", "hs_body_preview_is_truncated"]
        })
      })

      // Log the raw engagement response for debugging
      if (response.results && response.results.length > 0) {
        log.info("Raw engagement data from HubSpot", {
          sampleEngagement: JSON.stringify(response.results[0], null, 2),
          totalEngagements: response.results.length,
          operation: 'hubspot_raw_engagements'
        })
      }

      return response.results || []
    } catch (error) {
      log.error("Failed to batch read engagements", {
        engagementCount: engagementIds.length,
        error: error instanceof Error ? error.message : String(error),
        operation: 'hubspot_batch_read_engagements'
      })
      return []
    }
  }

  // Parse Clarity sessions from engagements
  parseClaritySessionsFromEngagements(
    engagements: HubSpotEngagement[]
  ): ClaritySession[] {
    const sessions: ClaritySession[] = []

    // Debug logging
    log.info(`Parsing ${engagements.length} engagements for Clarity sessions`, {
      engagementTypes: engagements.map(e => e.type),
      operation: 'parse_clarity_sessions'
    })

    for (const engagement of engagements) {
      // Log each engagement for debugging
      log.debug(`Checking engagement ${engagement.id}`, {
        type: engagement.type,
        hasMetadata: !!engagement.metadata,
        metadataKeys: engagement.metadata ? Object.keys(engagement.metadata) : [],
        properties: engagement.properties,
        operation: 'check_engagement_for_clarity'
      })

      // Check if this is a Clarity session engagement
      // This depends on how Clarity sessions are stored in HubSpot
      // Common patterns include checking the engagement type or metadata
      if (
        engagement.type === "CLARITY_SESSION" ||
        engagement.metadata?.source === "clarity" ||
        (engagement.metadata?.title && engagement.metadata.title.includes("Clarity")) ||
        (engagement.properties?.hs_body_preview && engagement.properties.hs_body_preview.includes("Clarity"))
      ) {
        // Parse the session data from the engagement
        const session: ClaritySession = {
          id: engagement.id,
          recordingUrl: engagement.metadata?.claritySession?.recordingUrl || 
                       engagement.properties?.clarity_recording_url ||
                       this.extractUrlFromBody(engagement.metadata?.body || ""),
          timestamp: new Date(engagement.createdAt),
          duration: engagement.metadata?.claritySession?.duration,
          smartEvents: this.parseSmartEvents(engagement),
          deviceType: engagement.metadata?.claritySession?.deviceType,
          browser: engagement.metadata?.claritySession?.browser
        }

        sessions.push(session)
      }
    }

    return sessions
  }

  // Helper to extract URL from engagement body
  private extractUrlFromBody(body: string): string {
    const urlMatch = body.match(/https:\/\/clarity\.microsoft\.com[^\s]*/);
    return urlMatch ? urlMatch[0] : ""
  }

  // Helper to parse smart events from engagement
  private parseSmartEvents(engagement: HubSpotEngagement): ClaritySessionEvent[] {
    if (engagement.metadata?.claritySession?.smartEvents) {
      return engagement.metadata.claritySession.smartEvents
    }

    // Fallback: try to parse from engagement body or properties
    const events: ClaritySessionEvent[] = []
    const body = engagement.metadata?.body || ""

    // Look for event patterns in the body
    const eventMatches = body.matchAll(/Event:\s*([^\n]+)\s*Type:\s*([^\n]+)\s*Start Time:\s*([^\n]+)/g)
    for (const match of eventMatches) {
      events.push({
        event: match[1].trim(),
        type: match[2].trim(),
        startTime: match[3].trim()
      })
    }

    return events
  }
}
