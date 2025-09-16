import { HubSpotClient } from "@/lib/api/hubspot/client"
import { HubSpotObject, HubSpotDwollaTransfer } from "@/lib/types/hubspot"
import { log } from "@/lib/logger"
import { prisma } from "@/lib/db"

/**
 * Adapter to transform HubSpot Dwolla Transfer objects to match
 * the existing ACHTransaction structure used by the frontend.
 * This ensures complete backward compatibility while switching data sources.
 */

export interface TransferCompatibilityData {
  id: string
  dwollaId: string
  amount: number
  fees: number
  netAmount: number
  status: string
  direction: string
  customerId?: string | null
  customerName?: string | null
  companyName?: string | null
  customerEmail?: string | null
  bankLastFour?: string | null
  invoiceNumber?: string | null
  transactionType?: string | null
  correlationId?: string | null
  created: Date | string
  processedAt?: Date | string | null
  clearingDate?: Date | string | null
  metadata?: any
  achReturnCode?: string | null
  achReturnReason?: string | null
  individualAchId?: string | null
  failureReason?: string | null
  // HubSpot-specific fields
  reconciliationStatus?: string
  coverageMonth?: string
  transferType?: string
}

export class TransferAdapter {
  private hubspotClient: HubSpotClient

  constructor() {
    this.hubspotClient = new HubSpotClient()
  }

  /**
   * Get transfers with compatibility - can fetch from either HubSpot or local DB
   * based on configuration or feature flag
   */
  async getTransfersWithCompatibility(filters: {
    status?: string
    startDate?: Date | null
    endDate?: Date | null
    coverageMonth?: string
    limit?: number
    page?: number
    useHubSpot?: boolean // Feature flag to control data source
  }): Promise<{
    transfers: TransferCompatibilityData[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    // Check feature flag or environment variable
    const useHubSpot = filters.useHubSpot ?? process.env.USE_HUBSPOT_TRANSFERS === 'true'

    if (useHubSpot) {
      return this.getTransfersFromHubSpot(filters)
    } else {
      return this.getTransfersFromDatabase(filters)
    }
  }

  /**
   * Fetch transfers from HubSpot and transform to compatibility format
   */
  private async getTransfersFromHubSpot(filters: {
    status?: string
    startDate?: Date | null
    endDate?: Date | null
    coverageMonth?: string
    limit?: number
    page?: number
  }): Promise<{
    transfers: TransferCompatibilityData[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    try {
      log.info("Fetching transfers from HubSpot", { filters })

      const limit = filters.limit || 50
      const page = filters.page || 1
      const after = page > 1 ? ((page - 1) * limit).toString() : undefined

      // Fetch from HubSpot
      const hubspotTransfers = await this.hubspotClient.getDwollaTransfers({
        coverageMonth: filters.coverageMonth,
        limit,
        after,
      })

      // Transform to compatibility format
      const transfers = await Promise.all(
        hubspotTransfers.map(transfer => this.transformHubSpotTransfer(transfer))
      )

      // Apply additional filters if needed
      let filteredTransfers = transfers

      // Filter by status if specified
      if (filters.status && filters.status !== 'all') {
        filteredTransfers = filteredTransfers.filter(t => 
          this.mapHubSpotStatusToLocal(t.status) === filters.status
        )
      }

      // Filter by date range if specified
      if (filters.startDate || filters.endDate) {
        filteredTransfers = filteredTransfers.filter(t => {
          const transferDate = new Date(t.created)
          if (filters.startDate && transferDate < filters.startDate) return false
          if (filters.endDate && transferDate > filters.endDate) return false
          return true
        })
      }

      return {
        transfers: filteredTransfers,
        pagination: {
          page,
          limit,
          total: filteredTransfers.length, // This would need proper pagination from HubSpot
          totalPages: Math.ceil(filteredTransfers.length / limit),
        },
      }
    } catch (error) {
      log.error("Error fetching transfers from HubSpot", error as Error)
      throw error
    }
  }

  /**
   * Fetch transfers from local database (existing logic)
   */
  private async getTransfersFromDatabase(filters: {
    status?: string
    startDate?: Date | null
    endDate?: Date | null
    coverageMonth?: string
    limit?: number
    page?: number
  }): Promise<{
    transfers: TransferCompatibilityData[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const limit = filters.limit || 50
    const page = filters.page || 1
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      direction: "credit", // Only customer-initiated transfers
    }

    if (filters.status && filters.status !== "all") {
      where.status = filters.status
    }

    if (filters.startDate || filters.endDate) {
      where.created = {}
      if (filters.startDate) {
        where.created.gte = filters.startDate
      }
      if (filters.endDate) {
        where.created.lte = filters.endDate
      }
    }

    // Get total count
    const totalCount = await prisma.aCHTransaction.count({ where })

    // Fetch transactions
    const transactions = await prisma.aCHTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created: "desc",
      },
    })

    // Transform to compatibility format
    const transfers = transactions.map(transaction => ({
      id: transaction.id,
      dwollaId: transaction.dwollaId,
      amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
      fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
      netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
      status: transaction.status,
      direction: transaction.direction,
      customerId: transaction.customerId,
      customerName: transaction.customerName,
      companyName: transaction.companyName,
      correlationId: transaction.correlationId,
      created: transaction.created,
      metadata: transaction.metadata,
      achReturnCode: transaction.achReturnCode,
      achReturnReason: transaction.achReturnReason,
      // Add coverage month based on created date if not in metadata
      coverageMonth: (transaction.metadata as any)?.coverageMonth || 
                     new Date(transaction.created).toISOString().slice(0, 7),
    }))

    return {
      transfers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }

  /**
   * Transform HubSpot transfer to match ACHTransaction structure
   * Now gets coverage month from associated SOB objects instead of transfer properties
   */
  private async transformHubSpotTransfer(
    hubspotTransfer: HubSpotObject<HubSpotDwollaTransfer["properties"]>
  ): Promise<TransferCompatibilityData> {
    const props = hubspotTransfer.properties

    // Try to get coverage month from associated SOB objects
    let coverageMonth = await this.getCoverageMonthFromSOB(hubspotTransfer.id)

    // Fallback to transfer properties if SOB lookup fails
    if (!coverageMonth) {
      coverageMonth = props.coverage_month ||
                       (props.transfer_schedule_date
                         ? new Date(props.transfer_schedule_date).toISOString().slice(0, 7)
                         : new Date(props.date_initiated || props.createdate).toISOString().slice(0, 7))
    }

    return {
      id: hubspotTransfer.id,
      dwollaId: props.dwolla_transfer_id,
      amount: props.amount || 0,
      fees: props.fee_amount || 0,
      netAmount: (props.amount || 0) - (props.fee_amount || 0),
      status: this.mapHubSpotStatusToLocal(props.transfer_status),
      direction: props.is_credit === 'Yes' ? 'credit' : 'debit',
      customerId: props.dwolla_customer_id,
      customerName: null, // Would need to be fetched separately or stored in HubSpot
      companyName: null, // Would need to be fetched separately or stored in HubSpot
      customerEmail: null, // Would need to be fetched separately or stored in HubSpot
      bankLastFour: null, // Would need to be fetched separately or stored in HubSpot
      invoiceNumber: props.invoice_reference || null,
      transactionType: props.transfer_type,
      correlationId: props.invoice_reference || null,
      created: props.date_initiated || props.createdate,
      processedAt: null, // Would need to be extracted from HubSpot data
      clearingDate: null, // Would need to be extracted from HubSpot data
      metadata: {
        hubspotId: hubspotTransfer.id,
        transferType: props.transfer_type,
        draftStatus: props.draft_status,
        transferOrigin: props.transfer_origin,
        batch: props.batch,
        paymentSchedule: props.payment_schedule,
        webhookEventsLog: props.webhook_events_log,
      },
      achReturnCode: null, // Would need to be extracted from failure_reason if applicable
      achReturnReason: props.failure_reason || null,
      individualAchId: null, // Would need to be extracted from HubSpot data
      failureReason: props.failure_reason || null,
      // HubSpot-specific fields
      reconciliationStatus: props.reconciliation_status,
      coverageMonth: coverageMonth,
      transferType: props.transfer_type,
    }
  }

  /**
   * Get coverage month from associated SOB objects for a Dwolla transfer
   */
  private async getCoverageMonthFromSOB(transferId: string): Promise<string | null> {
    try {
      // Get SOB associations for this transfer
      const sobAssociations = await this.hubspotClient.getDwollaTransferSOBAssociations(transferId)

      if (!sobAssociations.results.length) {
        return null
      }

      // Get the first SOB's coverage month (assuming one SOB per transfer)
      const sobId = sobAssociations.results[0].id
      const sob = await this.hubspotClient.batchReadObjects<HubSpotSummaryOfBenefits["properties"]>(
        "2-45680577", // SOB object ID
        [sobId],
        ["coverage_month"]
      )

      return sob.results[0]?.properties.coverage_month || null
    } catch (error) {
      log.warn("Failed to get coverage month from SOB", {
        transferId,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Map HubSpot transfer status to local status
   */
  private mapHubSpotStatusToLocal(
    hubspotStatus?: string
  ): string {
    const statusMap: Record<string, string> = {
      'Processed': 'processed',
      'Pending': 'pending',
      'Processing': 'pending',
      'Queued': 'pending',
      'Failed': 'failed',
      'Cancelled': 'cancelled',
      'Creation Failed': 'failed',
    }

    return statusMap[hubspotStatus || ''] || 'pending'
  }

  /**
   * Get a single transfer by ID from either source
   */
  async getTransferById(
    transferId: string,
    useHubSpot?: boolean
  ): Promise<TransferCompatibilityData | null> {
    const shouldUseHubSpot = useHubSpot ?? process.env.USE_HUBSPOT_TRANSFERS === 'true'

    if (shouldUseHubSpot) {
      try {
        const hubspotTransfer = await this.hubspotClient.getDwollaTransferById(transferId)
        return await this.transformHubSpotTransfer(hubspotTransfer)
      } catch (error) {
        log.error("Error fetching transfer from HubSpot", error as Error)
        return null
      }
    } else {
      const transaction = await prisma.aCHTransaction.findUnique({
        where: { dwollaId: transferId },
      })

      if (!transaction) return null

      return {
        id: transaction.id,
        dwollaId: transaction.dwollaId,
        amount: transaction.amount ? parseFloat(transaction.amount.toString()) : 0,
        fees: transaction.fees ? parseFloat(transaction.fees.toString()) : 0,
        netAmount: transaction.netAmount ? parseFloat(transaction.netAmount.toString()) : 0,
        status: transaction.status,
        direction: transaction.direction,
        customerId: transaction.customerId,
        customerName: transaction.customerName,
        companyName: transaction.companyName,
        correlationId: transaction.correlationId,
        created: transaction.created,
        metadata: transaction.metadata,
        achReturnCode: transaction.achReturnCode,
        achReturnReason: transaction.achReturnReason,
        coverageMonth: new Date(transaction.created).toISOString().slice(0, 7),
      }
    }
  }
}

// Singleton instance
let adapter: TransferAdapter | null = null

export function getTransferAdapter(): TransferAdapter {
  if (!adapter) {
    adapter = new TransferAdapter()
  }
  return adapter
}