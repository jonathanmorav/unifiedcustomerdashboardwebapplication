import { getEnv } from "@/lib/env"
import { DwollaTokenManager } from "./auth"
import { CorrelationTracking } from "@/lib/security/correlation"
import type {
  DwollaCustomer,
  DwollaFundingSource,
  DwollaTransfer,
  DwollaNotification,
  DwollaListResponse,
  DwollaError,
  DwollaSearchParams,
  MaskedFundingSource,
} from "@/lib/types/dwolla"
import { log } from "@/lib/logger"

interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

interface DwollaClientConfig {
  retryConfig?: Partial<RetryConfig>
  failOnMissingEndpoints?: boolean
  onRetry?: (opts: { attempt: number; error: Error; url: string }) => void
  onRateLimit?: (resetTime: number) => void
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

export class DwollaAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public errors?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    super(message)
    this.name = "DwollaAPIError"
  }
}

export class DwollaClient {
  private tokenManager: DwollaTokenManager
  private baseUrl: string
  private retryConfig: RetryConfig
  private failOnMissingEndpoints: boolean
  private rateLimitResetTime: number | null = null
  private rateLimitPromise: Promise<void> | null = null
  private onRetry: (opts: { attempt: number; error: Error; url: string }) => void
  private onRateLimit: (resetTime: number) => void

  constructor(config: DwollaClientConfig = {}) {
    const env = getEnv()
    this.tokenManager = new DwollaTokenManager()
    this.baseUrl = env.DWOLLA_BASE_URL
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig }
    this.failOnMissingEndpoints = config.failOnMissingEndpoints ?? false
    this.onRetry = config.onRetry || (() => {})
    this.onRateLimit = config.onRateLimit || (() => {})
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get authorization headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenManager.getAccessToken()
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.dwolla.v1.hal+json",
      "Content-Type": "application/vnd.dwolla.v1.hal+json",
    }
  }

  /**
   * Handle rate limiting with shared backoff
   */
  private async handleRateLimit(resetTime: number): Promise<void> {
    this.rateLimitResetTime = resetTime

    // Invoke callback
    this.onRateLimit(resetTime)

    // If we're already waiting, return the existing promise
    if (this.rateLimitPromise) {
      return this.rateLimitPromise
    }

    // Create a new shared promise for all rate-limited requests
    const delay = Math.max(resetTime - Date.now(), this.retryConfig.initialDelay)

    log.warn(
      `[DwollaClient] Rate limited. Waiting ${delay}ms until ${new Date(resetTime).toISOString()}`,
      {
        delay,
        resetTime: new Date(resetTime).toISOString(),
        operation: "dwolla_rate_limit",
      }
    )

    this.rateLimitPromise = this.sleep(delay).then(() => {
      this.rateLimitResetTime = null
      this.rateLimitPromise = null
    })

    return this.rateLimitPromise
  }

  /**
   * Mask sensitive account information
   */
  private maskAccountNumber(accountNumber?: string): string | undefined {
    if (!accountNumber || accountNumber.length < 4) {
      return undefined
    }
    return `****${accountNumber.slice(-4)}`
  }

  /**
   * Parse HAL response safely
   */
  private parseHALResponse<T>(response: any, embeddedKey: string): T[] {
    const embedded = response._embedded || {}
    return embedded[embeddedKey] ?? []
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0,
    signal?: AbortSignal
  ): Promise<T> {
    // Check if we're currently rate limited
    if (this.rateLimitPromise) {
      await this.rateLimitPromise
    }

    try {
      const authHeaders = await this.getAuthHeaders()
      const correlationHeaders = await CorrelationTracking.addCorrelationHeaders({
        ...authHeaders,
        ...options.headers,
      })

      const response = await fetch(url, {
        ...options,
        headers: correlationHeaders,
        signal: signal || options.signal,
      })

      if (!response.ok) {
        let errorData: DwollaError
        try {
          errorData = await response.json()
        } catch {
          // If JSON parsing fails, create a basic error
          errorData = {
            code: "PARSE_ERROR",
            message: `HTTP ${response.status}: ${response.statusText}`,
          }
        }

        // Handle rate limiting
        if (response.status === 429) {
          const resetHeader = response.headers.get("X-RateLimit-Reset")
          const resetTime = resetHeader
            ? parseInt(resetHeader) * 1000
            : Date.now() + this.retryConfig.initialDelay

          if (retryCount < this.retryConfig.maxRetries) {
            await CorrelationTracking.log("warn", "Dwolla rate limited", {
              url,
              status: response.status,
              retryCount,
              resetTime: new Date(resetTime).toISOString(),
            })
            await this.handleRateLimit(resetTime)
            return this.fetchWithRetry<T>(url, options, retryCount + 1, signal)
          }
        }

        // Handle token expiry - clear token and retry once
        if (response.status === 401 && retryCount === 0) {
          log.warn("[DwollaClient] Token expired, refreshing...", {
            url,
            operation: "dwolla_token_refresh",
          })
          const error = new DwollaAPIError("Token expired", 401)
          this.onRetry({ attempt: retryCount + 1, error, url })
          this.tokenManager.clearToken()
          return this.fetchWithRetry<T>(url, options, retryCount + 1, signal)
        }

        // Handle temporary server errors
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

          log.warn(
            `[DwollaClient] Server error (${response.status}). Retrying after ${delay}ms...`,
            {
              status: response.status,
              delay,
              retryCount,
              url,
              operation: "dwolla_server_error",
            }
          )

          const error = new DwollaAPIError(
            errorData.message || `Server error: ${response.status}`,
            response.status,
            errorData.code
          )
          this.onRetry({ attempt: retryCount + 1, error, url })

          await this.sleep(delay)
          return this.fetchWithRetry<T>(url, options, retryCount + 1, signal)
        }

        throw new DwollaAPIError(
          errorData.message || `Dwolla API error: ${response.statusText}`,
          response.status,
          errorData.code,
          errorData._embedded?.errors
        )
      }

      // Parse JSON response
      try {
        return await response.json()
      } catch (jsonError) {
        // Re-throw JSON parsing errors immediately
        throw new DwollaAPIError(
          `Failed to parse response from ${url}: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}`
        )
      }
    } catch (error) {
      // Handle different error types
      if (error instanceof DwollaAPIError) {
        throw error
      }

      // Check for abort errors first - don't retry these
      if (error instanceof Error && error.name === "AbortError") {
        throw error
      }

      // Network errors - retry if applicable
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
          this.retryConfig.maxDelay
        )

        log.warn(`[DwollaClient] Network error. Retrying after ${delay}ms...`, {
          delay,
          retryCount,
          url,
          error: error instanceof Error ? error.message : String(error),
          operation: "dwolla_network_error",
        })

        this.onRetry({
          attempt: retryCount + 1,
          error: error instanceof Error ? error : new Error(String(error)),
          url,
        })

        await this.sleep(delay)
        return this.fetchWithRetry<T>(url, options, retryCount + 1, signal)
      }

      // Re-throw unexpected errors
      if (error instanceof Error) {
        throw error
      }

      throw new DwollaAPIError(`Unexpected error: ${String(error)}`)
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path, this.baseUrl)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      })
    }

    return url.toString()
  }

  /**
   * Search for customers by email
   */
  async searchCustomers(
    params: DwollaSearchParams,
    signal?: AbortSignal
  ): Promise<DwollaCustomer[]> {
    const url = this.buildUrl("/customers", {
      email: params.email,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    })

    const response = await this.fetchWithRetry<DwollaListResponse<DwollaCustomer>>(
      url,
      {},
      0,
      signal
    )
    return this.parseHALResponse<DwollaCustomer>(response, "customers")
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string, signal?: AbortSignal): Promise<DwollaCustomer> {
    const url = this.buildUrl(`/customers/${customerId}`)
    return this.fetchWithRetry<DwollaCustomer>(url, {}, 0, signal)
  }

  /**
   * Get funding sources for a customer with masked account numbers
   */
  async getCustomerFundingSources(
    customerId: string,
    signal?: AbortSignal
  ): Promise<MaskedFundingSource[]> {
    const url = this.buildUrl(`/customers/${customerId}/funding-sources`)
    const response = await this.fetchWithRetry<DwollaListResponse<DwollaFundingSource>>(
      url,
      {},
      0,
      signal
    )

    const fundingSources = this.parseHALResponse<DwollaFundingSource>(response, "funding-sources")

    // Mask account numbers for security
    return fundingSources.map((source) => {
      const masked: MaskedFundingSource = {
        ...source,
        accountNumberMasked: this.maskAccountNumber(source.accountNumber),
      }
      // Remove the full account number from the response
      delete (masked as any).accountNumber // eslint-disable-line @typescript-eslint/no-explicit-any
      return masked
    })
  }

  /**
   * Get transfers for a customer (last N transfers)
   */
  async getCustomerTransfers(
    customerId: string,
    limit = 5,
    signal?: AbortSignal
  ): Promise<DwollaTransfer[]> {
    const url = this.buildUrl(`/customers/${customerId}/transfers`, { limit })
    const response = await this.fetchWithRetry<DwollaListResponse<DwollaTransfer>>(
      url,
      {},
      0,
      signal
    )

    return this.parseHALResponse<DwollaTransfer>(response, "transfers")
  }

  /**
   * Get notifications for a customer
   */
  async getCustomerNotifications(
    customerId: string,
    signal?: AbortSignal
  ): Promise<DwollaNotification[]> {
    // Note: The actual endpoint might be different - this is a placeholder
    // Dwolla's webhook/notification system might require different handling
    try {
      const url = this.buildUrl(`/customers/${customerId}/notifications`)
      const response = await this.fetchWithRetry<DwollaListResponse<DwollaNotification>>(
        url,
        {},
        0,
        signal
      )
      return this.parseHALResponse<DwollaNotification>(response, "notifications")
    } catch (error) {
      // Handle missing endpoint based on configuration
      if (error instanceof DwollaAPIError && error.status === 404) {
        if (this.failOnMissingEndpoints) {
          throw new DwollaAPIError(
            "Notifications endpoint not available. Please check Dwolla API documentation.",
            404
          )
        }

        log.warn(
          "[DwollaClient] Notifications endpoint not available (404). Returning empty array.",
          {
            customerId,
            operation: "dwolla_notifications_404",
          }
        )
        return []
      }

      throw error
    }
  }

  /**
   * Get customer by Dwolla ID (convenience method)
   */
  async getCustomerByDwollaId(
    dwollaId: string,
    signal?: AbortSignal
  ): Promise<DwollaCustomer | null> {
    try {
      // Extract the ID from a full Dwolla URL if provided
      const customerId = dwollaId.includes("/") ? dwollaId.split("/").pop()! : dwollaId

      return await this.getCustomer(customerId, signal)
    } catch (error) {
      if (error instanceof DwollaAPIError && error.status === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * Check if client is currently rate limited (for monitoring)
   */
  isRateLimited(): boolean {
    return this.rateLimitResetTime !== null && Date.now() < this.rateLimitResetTime
  }

  /**
   * Get rate limit reset time (for monitoring)
   */
  getRateLimitResetTime(): Date | null {
    return this.rateLimitResetTime ? new Date(this.rateLimitResetTime) : null
  }

  /**
   * Get all transfers with pagination
   */
  async getTransfers(
    params: {
      limit?: number
      offset?: number
      startDate?: string
      endDate?: string
      status?: string
      correlationId?: string
    },
    signal?: AbortSignal
  ): Promise<DwollaListResponse<DwollaTransfer>> {
    // Fetch transfers for the master account
    const accountId = process.env.DWOLLA_MASTER_ACCOUNT_ID
    if (!accountId) {
      throw new DwollaAPIError("DWOLLA_MASTER_ACCOUNT_ID not configured", 500)
    }

    // Use account-specific transfers endpoint
    const url = this.buildUrl(`/accounts/${accountId}/transfers`, {
      limit: params.limit,
      offset: params.offset,
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status,
      correlationId: params.correlationId,
    })

    return this.fetchWithRetry<DwollaListResponse<DwollaTransfer>>(url, {}, 0, signal)
  }

  /**
   * Get transfer by ID
   */
  async getTransfer(transferId: string, signal?: AbortSignal): Promise<DwollaTransfer> {
    const url = this.buildUrl(`/transfers/${transferId}`)
    return this.fetchWithRetry<DwollaTransfer>(url, {}, 0, signal)
  }

  /**
   * Get transfer events
   */
  async getTransferEvents(transferId: string, signal?: AbortSignal): Promise<any[]> {
    try {
      const url = this.buildUrl(`/transfers/${transferId}/events`)
      const response = await this.fetchWithRetry<DwollaListResponse<any>>(url, {}, 0, signal)
      return response._embedded?.events || []
    } catch (error) {
      log.error('Error fetching transfer events:', error)
      return []
    }
  }

  /**
   * Get funding source by URL
   */
  async getFundingSourceByUrl(url: string, signal?: AbortSignal): Promise<DwollaFundingSource> {
    return this.fetchWithRetry<DwollaFundingSource>(url, {}, 0, signal)
  }

  /**
   * Get customer by URL
   */
  async getCustomerByUrl(url: string, signal?: AbortSignal): Promise<DwollaCustomer> {
    return this.fetchWithRetry<DwollaCustomer>(url, {}, 0, signal)
  }

  /**
   * Get webhook subscriptions
   */
  async getWebhookSubscriptions(signal?: AbortSignal): Promise<any[]> {
    try {
      const url = this.buildUrl("/webhook-subscriptions")
      const response = await this.fetchWithRetry<DwollaListResponse<any>>(url, {}, 0, signal)
      return response._embedded?.["webhook-subscriptions"] || []
    } catch (error) {
      log.error('Error fetching webhook subscriptions:', error)
      return []
    }
  }

  /**
   * Get webhook events
   */
  async getWebhookEvents(params: {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  } = {}, signal?: AbortSignal): Promise<any[]> {
    try {
      const url = this.buildUrl("/events", {
        limit: params.limit || 100,
        offset: params.offset || 0,
        startDate: params.startDate?.toISOString(),
        endDate: params.endDate?.toISOString()
      })
      const response = await this.fetchWithRetry<DwollaListResponse<any>>(url, {}, 0, signal)
      return response._embedded?.events || []
    } catch (error) {
      log.error('Error fetching webhook events:', error)
      return []
    }
  }

  /**
   * Create webhook subscription
   */
  async createWebhookSubscription(webhookUrl: string, secret: string, signal?: AbortSignal): Promise<any> {
    const url = this.buildUrl("/webhook-subscriptions")
    return this.fetchWithRetry<any>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.dwolla.v1.hal+json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret: secret
      })
    }, 0, signal)
  }

  /**
   * Pause/unpause webhook subscription
   */
  async updateWebhookSubscription(subscriptionId: string, paused: boolean, signal?: AbortSignal): Promise<any> {
    const url = this.buildUrl(`/webhook-subscriptions/${subscriptionId}`)
    return this.fetchWithRetry<any>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.dwolla.v1.hal+json",
      },
      body: JSON.stringify({
        paused: paused
      })
    }, 0, signal)
  }

  /**
   * Delete webhook subscription
   */
  async deleteWebhookSubscription(subscriptionId: string, signal?: AbortSignal): Promise<void> {
    const url = this.buildUrl(`/webhook-subscriptions/${subscriptionId}`)
    await this.fetchWithRetry<any>(url, {
      method: "DELETE"
    }, 0, signal)
  }
}
