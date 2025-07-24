import { UnifiedSearchEngine } from "./unified-search"
import type {
  AdvancedSearchParams,
  AdvancedSearchResult,
  SearchFilters,
  SortOptions,
  PaginationOptions,
} from "@/lib/types/search"
import type { HubSpotCustomerData } from "@/lib/types/hubspot"
import type { DwollaCustomerData } from "@/lib/types/dwolla"
import type { Logger } from "@/lib/api/dwolla/service"

export class AdvancedSearchEngine extends UnifiedSearchEngine {
  constructor(logger: Logger = console) {
    super(logger)
  }

  /**
   * Execute advanced search with filters, sorting, and pagination
   */
  async advancedSearch(params: AdvancedSearchParams): Promise<AdvancedSearchResult> {
    const startTime = Date.now()

    // First, execute the basic search
    const basicResult = await this.search({
      searchTerm: params.searchTerm,
      searchType: params.searchType,
      signal: params.signal,
    })

    // Apply filters to the results
    let hubspotData = basicResult.hubspot.data ? [basicResult.hubspot.data] : []
    let dwollaData = basicResult.dwolla.data ? [basicResult.dwolla.data] : []

    if (params.filters) {
      hubspotData = this.applyHubSpotFilters(hubspotData, params.filters)
      dwollaData = this.applyDwollaFilters(dwollaData, params.filters)
    }

    // Apply sorting
    if (params.sort) {
      hubspotData = this.sortHubSpotData(hubspotData, params.sort)
      dwollaData = this.sortDwollaData(dwollaData, params.sort)
    }

    // Calculate statistics before pagination
    const statistics = this.calculateStatistics(hubspotData, dwollaData)

    // Apply pagination
    const paginatedHubSpot = this.paginate(hubspotData, params.pagination)
    const paginatedDwolla = this.paginate(dwollaData, params.pagination)

    const endTime = Date.now()

    return {
      searchTerm: params.searchTerm,
      searchType: basicResult.searchType,
      timestamp: new Date(),
      duration: endTime - startTime,
      appliedFilters: params.filters,
      pagination: params.pagination
        ? {
            currentPage: params.pagination.page,
            pageSize: params.pagination.pageSize,
            totalResults: hubspotData.length + dwollaData.length,
            totalPages: Math.ceil(
              (hubspotData.length + dwollaData.length) / params.pagination.pageSize
            ),
          }
        : undefined,
      hubspot: {
        success: basicResult.hubspot.success,
        data: paginatedHubSpot.items,
        error: basicResult.hubspot.error,
        duration: basicResult.hubspot.duration,
        totalCount: hubspotData.length,
      },
      dwolla: {
        success: basicResult.dwolla.success,
        data: paginatedDwolla.items,
        error: basicResult.dwolla.error,
        duration: basicResult.dwolla.duration,
        totalCount: dwollaData.length,
      },
      statistics,
    }
  }

  /**
   * Apply filters to HubSpot data
   */
  private applyHubSpotFilters(
    data: HubSpotCustomerData[],
    filters: SearchFilters
  ): HubSpotCustomerData[] {
    return data.filter((customer) => {
      // Apply customer status filter
      if (filters.customerStatus && filters.customerStatus.length > 0) {
        const status = this.getHubSpotCustomerStatus(customer)
        if (!filters.customerStatus.includes(status)) {
          return false
        }
      }

      // Apply date filters
      if (filters.createdDateRange) {
        const createdDate = new Date(customer.company.createdAt)
        if (!this.isInDateRange(createdDate, filters.createdDateRange)) {
          return false
        }
      }

      // Apply benefit amount filter
      if (filters.benefitAmountRange && customer.summaryOfBenefits) {
        const totalAmount = customer.summaryOfBenefits.reduce(
          (sum, sob) => sum + (sob.amountToDraft || 0),
          0
        )
        if (!this.isInAmountRange(totalAmount, filters.benefitAmountRange)) {
          return false
        }
      }

      // Apply pending invoices filter
      if (filters.hasPendingInvoices !== undefined) {
        const hasPending = customer.monthlyInvoices?.some((invoice) => invoice.status === "pending")
        if (filters.hasPendingInvoices !== hasPending) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Apply filters to Dwolla data
   */
  private applyDwollaFilters(
    data: DwollaCustomerData[],
    filters: SearchFilters
  ): DwollaCustomerData[] {
    return data.filter((customer) => {
      // Apply customer status filter
      if (filters.customerStatus && filters.customerStatus.length > 0) {
        const status = this.getDwollaCustomerStatus(customer)
        if (!filters.customerStatus.includes(status)) {
          return false
        }
      }

      // Apply funding source status filter
      if (filters.fundingSourceStatus && filters.fundingSourceStatus.length > 0) {
        const hasMatchingSource = customer.fundingSources?.some((source) =>
          filters.fundingSourceStatus!.includes(source.status as any)
        )
        if (!hasMatchingSource) {
          return false
        }
      }

      // Apply transfer status filter
      if (filters.transferStatus && filters.transferStatus.length > 0) {
        const hasMatchingTransfer = customer.transfers?.some((transfer) =>
          filters.transferStatus!.includes(transfer.status as any)
        )
        if (!hasMatchingTransfer) {
          return false
        }
      }

      // Apply transfer date range filter
      if (filters.transferDateRange && customer.transfers) {
        const hasTransferInRange = customer.transfers.some((transfer) => {
          const transferDate = new Date(transfer.created)
          return this.isInDateRange(transferDate, filters.transferDateRange!)
        })
        if (!hasTransferInRange) {
          return false
        }
      }

      // Apply transfer amount range filter
      if (filters.transferAmountRange && customer.transfers) {
        const hasTransferInRange = customer.transfers.some((transfer) => {
          const amount = parseFloat(transfer.amount.value)
          return this.isInAmountRange(amount, filters.transferAmountRange!)
        })
        if (!hasTransferInRange) {
          return false
        }
      }

      // Apply failed transfers filter
      if (filters.hasFailedTransfers !== undefined) {
        const hasFailed = customer.transfers?.some((t) => t.status === "failed")
        if (filters.hasFailedTransfers !== hasFailed) {
          return false
        }
      }

      // Apply unverified funding filter
      if (filters.hasUnverifiedFunding !== undefined) {
        const hasUnverified = customer.fundingSources?.some((f) => f.status !== "verified")
        if (filters.hasUnverifiedFunding !== hasUnverified) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Sort HubSpot data
   */
  private sortHubSpotData(data: HubSpotCustomerData[], sort: SortOptions): HubSpotCustomerData[] {
    const sorted = [...data]

    sorted.sort((a, b) => {
      let compareValue = 0

      switch (sort.field) {
        case "date_created":
          compareValue =
            new Date(a.company.createdAt).getTime() - new Date(b.company.createdAt).getTime()
          break
        case "date_modified":
          compareValue =
            new Date(a.company.updatedAt).getTime() - new Date(b.company.updatedAt).getTime()
          break
        case "company_name":
          compareValue = a.company.name.localeCompare(b.company.name)
          break
        case "amount":
          const amountA =
            a.summaryOfBenefits?.reduce((sum, sob) => sum + (sob.amountToDraft || 0), 0) || 0
          const amountB =
            b.summaryOfBenefits?.reduce((sum, sob) => sum + (sob.amountToDraft || 0), 0) || 0
          compareValue = amountA - amountB
          break
        default:
          // Relevance or unsupported sort - maintain original order
          return 0
      }

      return sort.order === "asc" ? compareValue : -compareValue
    })

    return sorted
  }

  /**
   * Sort Dwolla data
   */
  private sortDwollaData(data: DwollaCustomerData[], sort: SortOptions): DwollaCustomerData[] {
    const sorted = [...data]

    sorted.sort((a, b) => {
      let compareValue = 0

      switch (sort.field) {
        case "date_created":
          compareValue =
            new Date(a.customer.created).getTime() - new Date(b.customer.created).getTime()
          break
        case "customer_name":
          const nameA = `${a.customer.firstName} ${a.customer.lastName}`
          const nameB = `${b.customer.firstName} ${b.customer.lastName}`
          compareValue = nameA.localeCompare(nameB)
          break
        case "status":
          compareValue = a.customer.status.localeCompare(b.customer.status)
          break
        case "amount":
          const amountA = a.transfers?.reduce((sum, t) => sum + parseFloat(t.amount.value), 0) || 0
          const amountB = b.transfers?.reduce((sum, t) => sum + parseFloat(t.amount.value), 0) || 0
          compareValue = amountA - amountB
          break
        default:
          return 0
      }

      return sort.order === "asc" ? compareValue : -compareValue
    })

    return sorted
  }

  /**
   * Paginate data
   */
  private paginate<T>(data: T[], pagination?: PaginationOptions): { items: T[]; total: number } {
    if (!pagination) {
      return { items: data, total: data.length }
    }

    const start = (pagination.page - 1) * pagination.pageSize
    const end = start + pagination.pageSize

    return {
      items: data.slice(start, end),
      total: data.length,
    }
  }

  /**
   * Calculate statistics from results
   */
  private calculateStatistics(
    hubspotData: HubSpotCustomerData[],
    dwollaData: DwollaCustomerData[]
  ) {
    const totalCustomers = hubspotData.length + dwollaData.length

    const activeCustomers =
      hubspotData.filter((c) => this.getHubSpotCustomerStatus(c) === "active").length +
      dwollaData.filter((c) => this.getDwollaCustomerStatus(c) === "active").length

    const totalTransferAmount = dwollaData.reduce((sum, customer) => {
      const customerTotal =
        customer.transfers?.reduce(
          (tSum, transfer) => tSum + parseFloat(transfer.amount.value),
          0
        ) || 0
      return sum + customerTotal
    }, 0)

    const failedTransfersCount = dwollaData.reduce((count, customer) => {
      const failedCount = customer.transfers?.filter((t) => t.status === "failed").length || 0
      return count + failedCount
    }, 0)

    const unverifiedFundingCount = dwollaData.reduce((count, customer) => {
      const unverifiedCount =
        customer.fundingSources?.filter((f) => f.status !== "verified").length || 0
      return count + unverifiedCount
    }, 0)

    return {
      totalCustomers,
      activeCustomers,
      totalTransferAmount,
      failedTransfersCount,
      unverifiedFundingCount,
    }
  }

  /**
   * Helper: Check if date is in range
   */
  private isInDateRange(date: Date, range: { start: Date | string; end: Date | string }): boolean {
    const startDate = new Date(range.start)
    const endDate = new Date(range.end)
    return date >= startDate && date <= endDate
  }

  /**
   * Helper: Check if amount is in range
   */
  private isInAmountRange(amount: number, range: { min: number; max: number }): boolean {
    return amount >= range.min && amount <= range.max
  }

  /**
   * Helper: Get HubSpot customer status
   */
  private getHubSpotCustomerStatus(customer: HubSpotCustomerData): "active" | "inactive" {
    // This is a simplified status determination
    // In reality, you'd check specific HubSpot properties
    return customer.company.lifecycleStage === "customer" ? "active" : "inactive"
  }

  /**
   * Helper: Get Dwolla customer status
   */
  private getDwollaCustomerStatus(
    customer: DwollaCustomerData
  ): "active" | "inactive" | "suspended" | "verified" | "unverified" {
    const status = customer.customer.status
    if (status === "verified") return "verified"
    if (status === "unverified") return "unverified"
    if (status === "suspended") return "suspended"
    // Map other statuses appropriately
    return "active"
  }
}

/**
 * Create a singleton instance
 */
let advancedSearchEngineInstance: AdvancedSearchEngine | null = null

export function getAdvancedSearchEngine(logger?: Logger): AdvancedSearchEngine {
  if (!advancedSearchEngineInstance) {
    advancedSearchEngineInstance = new AdvancedSearchEngine(logger)
  }
  return advancedSearchEngineInstance
}
