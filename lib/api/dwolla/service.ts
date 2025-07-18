import { DwollaClient, DwollaAPIError } from "./client"
import type { DwollaCustomerData, DwollaCustomer, MaskedFundingSource } from "@/lib/types/dwolla"

// Logger interface for pluggable logging
export interface Logger {
  warn(message: string, meta?: any): void // eslint-disable-line @typescript-eslint/no-explicit-any
  error(message: string, meta?: any): void // eslint-disable-line @typescript-eslint/no-explicit-any
  info(message: string, meta?: any): void // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Service configuration
export interface DwollaServiceConfig {
  failOnMissingEndpoints?: boolean
  nameSearchPageSize?: number
  nameSearchMaxPages?: number
  transferLimit?: number
  onRetry?: (opts: { attempt: number; error: Error; url: string }) => void
  onRateLimit?: (resetTime: number) => void
}

// Search parameters
export interface DwollaSearchParams {
  searchTerm: string
  searchType: "email" | "name" | "dwolla_id"
  signal?: AbortSignal
}

// Default configuration
const DEFAULT_CONFIG: Required<DwollaServiceConfig> = {
  failOnMissingEndpoints: false,
  nameSearchPageSize: 100,
  nameSearchMaxPages: 5,
  transferLimit: 5,
  onRetry: () => {},
  onRateLimit: () => {},
}

export class DwollaService {
  private config: Required<DwollaServiceConfig>
  private client: DwollaClient

  constructor(
    client?: DwollaClient,
    private logger: Logger = console,
    config: DwollaServiceConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Create client with proper configuration if not provided
    this.client =
      client ||
      new DwollaClient({
        failOnMissingEndpoints: this.config.failOnMissingEndpoints,
        onRetry: this.config.onRetry,
        onRateLimit: this.config.onRateLimit,
      })
  }

  /**
   * Search for customer data in Dwolla by various parameters
   */
  async searchCustomer(params: DwollaSearchParams): Promise<DwollaCustomerData | null> {
    try {
      let customer: DwollaCustomer | null = null

      if (params.searchType === "dwolla_id") {
        customer = await this.searchByDwollaId(params.searchTerm, params.signal)
      } else if (params.searchType === "email") {
        customer = await this.searchByEmail(params.searchTerm, params.signal)
      } else if (params.searchType === "name") {
        customer = await this.searchByName(params.searchTerm, params.signal)
      }

      if (!customer) {
        return null
      }

      return this.fetchCustomerDetails(customer, params.signal)
    } catch (error) {
      // Safe, structured logging
      this.logger.error("DwollaService.searchCustomer failed", {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof DwollaAPIError ? error.code : undefined,
        errorStatus: error instanceof DwollaAPIError ? error.status : undefined,
        searchType: params.searchType,
        searchTermLength: params.searchTerm.length,
      })
      throw error
    }
  }

  /**
   * Get customer data by Dwolla customer ID
   */
  async getCustomerData(
    customerId: string,
    signal?: AbortSignal
  ): Promise<DwollaCustomerData | null> {
    try {
      const customer = await this.client.getCustomer(customerId, signal)
      return this.fetchCustomerDetails(customer, signal)
    } catch (error) {
      if (error instanceof DwollaAPIError && error.status === 404) {
        this.logger.info("Customer not found", { customerId })
        return null
      }

      // Safe, structured logging
      this.logger.error("DwollaService.getCustomerData failed", {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof DwollaAPIError ? error.code : undefined,
        errorStatus: error instanceof DwollaAPIError ? error.status : undefined,
        customerId,
      })
      throw error
    }
  }

  /**
   * Search by Dwolla ID
   */
  private async searchByDwollaId(
    dwollaId: string,
    signal?: AbortSignal
  ): Promise<DwollaCustomer | null> {
    return this.client.getCustomerByDwollaId(dwollaId, signal)
  }

  /**
   * Search by email
   */
  private async searchByEmail(email: string, signal?: AbortSignal): Promise<DwollaCustomer | null> {
    const customers = await this.client.searchCustomers(
      {
        email,
        limit: 1,
      },
      signal
    )
    return customers[0] || null
  }

  /**
   * Search by name with pagination
   */
  private async searchByName(
    searchTerm: string,
    signal?: AbortSignal
  ): Promise<DwollaCustomer | null> {
    const searchTermLower = searchTerm.toLowerCase()
    let page = 0

    while (page < this.config.nameSearchMaxPages) {
      // Check if cancelled
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError")
      }

      const offset = page * this.config.nameSearchPageSize
      const customers = await this.client.searchCustomers(
        {
          limit: this.config.nameSearchPageSize,
          offset,
        },
        signal
      )

      // Search through this batch
      const found = customers.find((c) => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase()
        const businessName = c.businessName?.toLowerCase() || ""
        return fullName.includes(searchTermLower) || businessName.includes(searchTermLower)
      })

      if (found) {
        return found
      }

      // If we got fewer results than requested, we've reached the end
      if (customers.length < this.config.nameSearchPageSize) {
        break
      }

      page++
    }

    // Log if we hit the max pages limit
    if (page >= this.config.nameSearchMaxPages) {
      this.logger.warn("Name search hit max pages limit", {
        searchTerm,
        maxPages: this.config.nameSearchMaxPages,
        totalCustomersSearched: page * this.config.nameSearchPageSize,
      })
    }

    return null
  }

  /**
   * Fetch all customer details in parallel
   */
  private async fetchCustomerDetails(
    customer: DwollaCustomer,
    signal?: AbortSignal
  ): Promise<{
    customer: DwollaCustomer
    fundingSources: MaskedFundingSource[]
    transfers: DwollaCustomerData["transfers"]
    notifications: DwollaCustomerData["notifications"]
  }> {
    try {
      const [fundingSources, transfers, notifications] = await Promise.all([
        this.client.getCustomerFundingSources(customer.id, signal),
        this.client.getCustomerTransfers(customer.id, this.config.transferLimit, signal),
        this.client.getCustomerNotifications(customer.id, signal),
      ])

      return {
        customer,
        fundingSources,
        transfers,
        notifications,
      }
    } catch (error) {
      // Preserve original abort errors
      if (error instanceof Error && error.name === "AbortError") {
        throw error
      }
      throw error
    }
  }

  /**
   * Check if service is rate limited
   */
  isRateLimited(): boolean {
    return this.client.isRateLimited()
  }

  /**
   * Get rate limit reset time
   */
  getRateLimitResetTime(): Date | null {
    return this.client.getRateLimitResetTime()
  }
}

/**
 * Static formatter for Dwolla data
 */
export class DwollaFormatter {
  /**
   * Format Dwolla data for display
   */
  static format(data: {
    customer: DwollaCustomer
    fundingSources: MaskedFundingSource[]
    transfers: DwollaCustomerData["transfers"]
    notifications: DwollaCustomerData["notifications"]
  }): {
    customer: {
      id: string
      email: string
      name: string
      businessName: string | null
      status: string
      type: string
      created: string
    }
    fundingSources: Array<{
      id: string
      name: string
      type: string
      bankAccountType: string | null
      accountNumberMasked: string | null
      routingNumber: string | null
      status: string
      verified: boolean
    }>
    transfers: Array<{
      id: string
      amount: string
      currency: string
      status: string
      created: string
      sourceId: string
      destinationId: string
      correlationId: string | null
    }>
    notificationCount: number
  } {
    const { customer, fundingSources, transfers, notifications } = data

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        businessName: customer.businessName || null,
        status: customer.status,
        type: customer.type,
        created: customer.created,
      },
      fundingSources: fundingSources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type,
        bankAccountType: source.bankAccountType || null,
        accountNumberMasked: source.accountNumberMasked || null,
        routingNumber: source.routingNumber || null,
        status: source.status,
        verified: source.status === "verified",
      })),
      transfers: transfers.map((transfer) => ({
        id: transfer.id,
        amount: transfer.amount.value,
        currency: transfer.amount.currency,
        status: transfer.status,
        created: transfer.created,
        sourceId: DwollaFormatter.extractIdFromUrl(transfer._links.source.href),
        destinationId: DwollaFormatter.extractIdFromUrl(transfer._links.destination.href),
        correlationId: transfer.correlationId || null,
      })),
      notificationCount: notifications.length,
    }
  }

  /**
   * Extract ID from Dwolla resource URL
   */
  private static extractIdFromUrl(url: string): string {
    return url.split("/").pop() || url
  }

  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: string | number, currency: string = "USD"): string {
    // Defensive parsing
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount

    // Handle invalid amounts
    if (isNaN(numAmount) || !isFinite(numAmount)) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(0)
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(numAmount)
  }

  /**
   * Format date for display
   */
  static formatDate(date: string | Date): string {
    try {
      const dateObj = typeof date === "string" ? new Date(date) : date

      // Check for invalid date
      if (isNaN(dateObj.getTime())) {
        return "Invalid Date"
      }

      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Invalid Date"
    }
  }
}
