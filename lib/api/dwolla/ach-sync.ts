import { DwollaClient } from "./client"
import { prisma } from "@/lib/db"
import type { DwollaTransfer, DwollaCustomer } from "@/lib/types/dwolla"
import { getReturnCodeInfo } from "./return-codes"

interface ACHSyncOptions {
  limit?: number
  offset?: number
  startDate?: Date
  endDate?: Date
  customerId?: string
}

export class ACHTransactionSync {
  constructor(private client: DwollaClient) {}

  /**
   * Sync ACH transactions from Dwolla to our database
   */
  async syncTransactions(options: ACHSyncOptions = {}): Promise<{
    synced: number
    failed: number
    errors: string[]
  }> {
    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[],
    }

    try {
      // Check if we should use demo mode
      // Use demo mode if explicitly set to true OR if Dwolla credentials are missing
      const isDemoMode =
        process.env.DEMO_MODE === "true" ||
        !process.env.DWOLLA_KEY ||
        !process.env.DWOLLA_SECRET ||
        !process.env.DWOLLA_MASTER_ACCOUNT_ID

      if (isDemoMode) {
        console.log("Demo mode detected - skipping sync to prevent test data")
        console.log("To sync real data, ensure all Dwolla credentials are properly configured")
        results.errors.push("Skipped sync - Demo mode active. Configure Dwolla credentials to sync real data.")
        return results
      } else {
        try {
          // Try to fetch real transfers from Dwolla API
          console.log("Attempting to fetch transfers from Dwolla API...")
          const transfers = await this.fetchAllTransfers(options)

          console.log(`Fetched ${transfers.length} transfers from Dwolla`)
          let skippedCount = 0
          for (const transfer of transfers) {
            // Skip null transfers (non-customer transfers)
            if (transfer === null) {
              skippedCount++
              continue
            }
            try {
              await this.saveTransaction(transfer)
              results.synced++
            } catch (error) {
              results.failed++
              results.errors.push(`Failed to save transaction ${transfer.id}: ${error}`)
            }
          }
          console.log(
            `Synced ${results.synced} customer transfers (skipped ${skippedCount} bank transfers)`
          )
        } catch (apiError) {
          // If Dwolla API fails, report the error but don't generate test data
          console.error("Dwolla API failed:", apiError)
          results.errors.push(`Dwolla API error: ${apiError}`)
          throw apiError
        }
      }

      console.log("ACH transaction sync completed", results)
      return results
    } catch (error) {
      console.error("ACH transaction sync failed", { error, options })
      throw error
    }
  }

  /**
   * Fetch all transfers from Dwolla API with pagination
   * If no limit is specified, fetches ALL available transfers
   */
  private async fetchAllTransfers(options: ACHSyncOptions): Promise<any[]> {
    const allTransfers: any[] = []
    let currentOffset = options.offset || 0
    const pageSize = 200 // Dwolla max per page
    const maxLimit = options.limit || Infinity // If no limit, fetch all

    try {
      // Build search parameters
      const searchParams: Record<string, any> = {
        limit: pageSize,
        offset: currentOffset,
      }

      if (options.startDate) {
        // Dwolla expects YYYY-MM-DD format
        searchParams.startDate = options.startDate.toISOString().split('T')[0]
      }

      if (options.endDate) {
        // Dwolla expects YYYY-MM-DD format
        searchParams.endDate = options.endDate.toISOString().split('T')[0]
      }

      // Keep fetching until we have all transfers or reach our limit
      let pageCount = 0
      while (allTransfers.length < maxLimit) {
        console.log(`Fetching page ${pageCount + 1} (offset: ${searchParams.offset})...`)
        const response = await this.client.getTransfers(searchParams)

        const transfers = response._embedded?.transfers || []

        if (transfers.length === 0) {
          console.log("No more transfers found")
          break
        }

        // Enrich transfer data
        let enrichedCount = 0
        for (const transfer of transfers) {
          const enrichedTransfer = await this.enrichTransferData(transfer)
          // Only include customer-initiated transfers (skip null returns)
          if (enrichedTransfer !== null) {
            allTransfers.push(enrichedTransfer)
            enrichedCount++

            if (allTransfers.length >= maxLimit) {
              console.log(`Reached limit of ${maxLimit} transfers`)
              return allTransfers.slice(0, maxLimit)
            }
          }
        }
        
        console.log(`Page ${pageCount + 1}: Found ${enrichedCount} customer transfers out of ${transfers.length} total`)

        // Check if there's a next page
        if (!response._links?.next) {
          console.log("No more pages available")
          break
        }

        searchParams.offset += pageSize
        pageCount++
        
        // Add a small delay to avoid rate limiting
        if (pageCount % 10 === 0) {
          console.log("Pausing briefly to avoid rate limits...")
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      return allTransfers
    } catch (error) {
      console.error("Failed to fetch transfers from Dwolla", { error, options })
      throw error
    }
  }

  /**
   * Enrich transfer data with customer and funding source information
   * Returns null for transfers that are not customer-initiated (i.e., Cakewalk-initiated transfers)
   */
  private async enrichTransferData(transfer: DwollaTransfer): Promise<any> {
    try {
      const ourAccountId = process.env.DWOLLA_MASTER_ACCOUNT_ID
      let customerDetails = null
      let sourceDetails: any = {}
      let destinationDetails: any = {}
      let sourceFundingSource = null
      let destinationFundingSource = null

      // Check if source is a customer (customer-initiated debit)
      const sourceUrl = transfer._links.source.href
      const destUrl = transfer._links.destination.href
      
      // IMPORTANT: Only process customer-initiated transfers (customer is the source)
      // Skip transfers where Cakewalk is the source (credits to customers)
      if (sourceUrl.includes(ourAccountId)) {
        // This is a Cakewalk-initiated transfer, skip it
        return null
      }

      if (sourceUrl.includes("/customers/")) {
        // Customer is the source (ACH debit from customer)
        customerDetails = await this.fetchCustomerDetails(sourceUrl)

        // Get the actual funding source used
        if (transfer._links["source-funding-source"]) {
          sourceFundingSource = await this.fetchFundingSourceDetails(
            transfer._links["source-funding-source"].href
          )
          sourceDetails = {
            id: sourceFundingSource.id,
            name: sourceFundingSource.name,
            bankLastFour: sourceFundingSource.name?.slice(-4),
          }
        }

        // Destination is our account
        destinationDetails = {
          id: ourAccountId,
          name: "Cakewalk Benefits Inc.",
        }
      } else if (destUrl.includes("/customers/")) {
        // Customer is the destination (ACH credit to customer)
        customerDetails = await this.fetchCustomerDetails(destUrl)

        // Source is our account
        sourceDetails = {
          id: ourAccountId,
          name: "Cakewalk Benefits Inc.",
        }

        // Get the actual funding source used
        if (transfer._links["destination-funding-source"]) {
          destinationFundingSource = await this.fetchFundingSourceDetails(
            transfer._links["destination-funding-source"].href
          )
          destinationDetails = {
            id: destinationFundingSource.id,
            name: destinationFundingSource.name,
            bankLastFour: destinationFundingSource.name?.slice(-4),
          }
        }
      } else {
        // Neither source nor destination is a customer - handle as before
        const [source, dest] = await Promise.all([
          this.fetchFundingSourceDetails(sourceUrl),
          this.fetchFundingSourceDetails(destUrl),
        ])
        sourceDetails = source
        destinationDetails = dest

        // Try to get customer from funding source links
        const customerUrl = source.customerUrl || dest.customerUrl
        if (customerUrl) {
          customerDetails = await this.fetchCustomerDetails(customerUrl)
        }
      }

      // Determine direction based on our account
      const direction = destUrl.includes(ourAccountId) ? "credit" : "debit"

      // Calculate fees and net amount
      const amount = parseFloat(transfer.amount.value)
      const fees = transfer.fees?.reduce((sum, fee) => sum + parseFloat(fee.amount.value), 0) || 0
      const netAmount = amount - fees

      // Extract failure information
      const failureData = await this.extractFailureInformation(transfer)

      return {
        id: transfer.id,
        status: transfer.status,
        amount,
        currency: transfer.amount.currency,
        direction,
        created: transfer.created,
        sourceId: sourceDetails.id,
        sourceName: sourceDetails.name,
        destinationId: destinationDetails.id,
        destinationName: destinationDetails.name,
        bankLastFour: sourceDetails.bankLastFour || destinationDetails.bankLastFour,
        correlationId: transfer.correlationId,
        individualAchId: transfer.individualAchId,
        customerId: customerDetails?.id,
        customerName: customerDetails
          ? `${customerDetails.firstName} ${customerDetails.lastName}`
          : transfer.metadata?.customerName ||
            (direction === "credit" ? sourceDetails.name : destinationDetails.name),
        customerEmail: customerDetails?.email || transfer.metadata?.customerEmail,
        companyName: customerDetails?.businessName || transfer.metadata?.companyName,
        invoiceNumber: transfer.metadata?.invoiceNumber,
        transactionType: transfer.metadata?.transactionType || "transfer",
        description: transfer.metadata?.description,
        fees,
        netAmount,
        clearingDate: transfer.metadata?.clearingDate,
        metadata: transfer.metadata || {},
        failureReason: failureData.reason,
        failureCode: failureData.code,
        returnCode: failureData.returnCode,
        failureDetails: failureData.details,
      }
    } catch (error) {
      console.error("Failed to enrich transfer data", { transferId: transfer.id, error })
      // Return basic transfer data if enrichment fails
      return {
        id: transfer.id,
        status: transfer.status,
        amount: parseFloat(transfer.amount.value),
        currency: transfer.amount.currency,
        created: transfer.created,
        correlationId: transfer.correlationId,
        individualAchId: transfer.individualAchId,
        metadata: transfer.metadata || {},
      }
    }
  }

  /**
   * Fetch funding source details
   */
  private async fetchFundingSourceDetails(url: string): Promise<any> {
    try {
      // Handle account URLs differently
      if (url.includes("/accounts/")) {
        const accountId = url.split("/").pop()
        return {
          id: accountId,
          name: "Cakewalk Benefits Inc.",
          type: "account",
        }
      }

      const response = await this.client.getFundingSourceByUrl(url)
      const result = {
        id: response.id,
        name: response.name,
        bankLastFour: response.bankAccountType ? response.name.slice(-4) : null,
        customerId: response._links?.customer?.href?.split("/").pop(),
        customerUrl: response._links?.customer?.href,
        type: response.type,
      }
      return result
    } catch (error) {
      console.error("Failed to fetch funding source details", { url, error })
      return {
        id: url.split("/").pop(),
        name: "Unknown",
      }
    }
  }

  /**
   * Fetch customer details
   */
  private async fetchCustomerDetails(url: string): Promise<DwollaCustomer | null> {
    try {
      return await this.client.getCustomerByUrl(url)
    } catch (error) {
      console.error("Failed to fetch customer details", { url, error })
      return null
    }
  }

  /**
   * Extract failure information from a transfer
   */
  private async extractFailureInformation(transfer: DwollaTransfer): Promise<{
    reason: string | null
    code: string | null
    returnCode: string | null
    details: any
  }> {
    const failureData = {
      reason: null as string | null,
      code: null as string | null,
      returnCode: null as string | null,
      details: {} as any,
    }

    // Only process if transfer is failed, cancelled, or returned
    if (!['failed', 'cancelled', 'returned'].includes(transfer.status)) {
      return failureData
    }

    // Check for embedded failure details (Dwolla v2 API)
    if ((transfer as any)._embedded?.['failure-details']) {
      const details = (transfer as any)._embedded['failure-details']
      failureData.reason = details.description || details.reason
      failureData.code = details.code
      failureData.returnCode = details.achReturnCode || details.returnCode
      failureData.details = details
    }

    // Check transfer metadata for failure info
    if (transfer.metadata) {
      failureData.reason = failureData.reason || (transfer.metadata as any).failureReason
      failureData.code = failureData.code || (transfer.metadata as any).failureCode
      failureData.returnCode = failureData.returnCode || (transfer.metadata as any).returnCode
    }

    // Try to fetch additional details via events API
    try {
      const events = await this.fetchTransferEvents(transfer.id)
      const failureEvent = events.find((e: any) => 
        e.topic === 'customer_transfer_failed' || 
        e.topic === 'customer_transfer_returned' ||
        e.topic === 'transfer_failed' ||
        e.topic === 'transfer_returned'
      )
      
      if (failureEvent) {
        // Extract return code from event data if available
        if (failureEvent.data?.returnCode) {
          failureData.returnCode = failureData.returnCode || failureEvent.data.returnCode
        }
        
        // Store event details
        failureData.details = {
          ...failureData.details,
          eventType: failureEvent.topic,
          eventTime: failureEvent.created,
          eventDescription: failureEvent.data?.description || failureEvent.description,
          eventData: failureEvent.data,
        }

        // If we have a return code, get detailed info
        if (failureData.returnCode) {
          const returnCodeInfo = getReturnCodeInfo(failureData.returnCode)
          failureData.reason = failureData.reason || returnCodeInfo.title
          failureData.details.returnCodeInfo = {
            title: returnCodeInfo.title,
            description: returnCodeInfo.description,
            retryable: returnCodeInfo.retryable,
            userAction: returnCodeInfo.userAction,
          }
        }
      }
    } catch (error) {
      console.warn('Could not fetch transfer events:', error)
    }

    // For demo mode, generate realistic failure data
    if (process.env.DEMO_MODE === 'true' && transfer.status === 'failed') {
      const demoReturnCodes = ['R01', 'R02', 'R03', 'R04', 'R07', 'R08', 'R10', 'R16', 'R20', 'R29']
      const returnCode = demoReturnCodes[Math.floor(Math.random() * demoReturnCodes.length)]
      const returnCodeInfo = getReturnCodeInfo(returnCode)
      
      failureData.returnCode = returnCode
      failureData.code = returnCode
      failureData.reason = returnCodeInfo.title
      failureData.details = {
        demo: true,
        returnCodeInfo: {
          title: returnCodeInfo.title,
          description: returnCodeInfo.description,
          retryable: returnCodeInfo.retryable,
          userAction: returnCodeInfo.userAction,
        }
      }
    }

    return failureData
  }

  /**
   * Fetch transfer events from Dwolla
   */
  private async fetchTransferEvents(transferId: string): Promise<any[]> {
    try {
      // For demo mode, return empty array
      if (process.env.DEMO_MODE === 'true') {
        return []
      }

      const response = await this.client.getTransferEvents(transferId)
      return response || []
    } catch (error) {
      console.error('Error fetching transfer events:', error)
      return []
    }
  }

  /**
   * Save a transaction to the database
   */
  private async saveTransaction(transfer: any): Promise<void> {
    const existingTransaction = await prisma.aCHTransaction.findUnique({
      where: { dwollaId: transfer.id },
    })

    if (existingTransaction) {
      // Update existing transaction
      await prisma.aCHTransaction.update({
        where: { dwollaId: transfer.id },
        data: {
          status: transfer.status,
          amount: transfer.amount,
          lastUpdated: new Date(),
          processedAt: transfer.status === "completed" ? new Date(transfer.created) : null,
          clearingDate: transfer.clearing?.destination
            ? new Date(transfer.clearing.destination)
            : null,
          failureReason: transfer.failureReason || null,
          failureCode: transfer.failureCode || null,
          returnCode: transfer.returnCode || null,
        },
      })
    } else {
      // Create new transaction
      await prisma.aCHTransaction.create({
        data: {
          dwollaId: transfer.id,
          status: transfer.status,
          amount: transfer.amount,
          currency: transfer.currency || "USD",
          direction: transfer.direction || this.inferDirection(transfer),
          created: new Date(transfer.created),
          sourceId: transfer.sourceId,
          sourceName: transfer.sourceName,
          destinationId: transfer.destinationId,
          destinationName: transfer.destinationName,
          bankLastFour: transfer.bankLastFour,
          correlationId: transfer.correlationId,
          individualAchId: transfer.individualAchId,
          customerId: transfer.customerId,
          customerName: transfer.customerName,
          customerEmail: transfer.customerEmail,
          companyName: transfer.companyName,
          invoiceNumber: transfer.invoiceNumber,
          transactionType: transfer.transactionType,
          description: transfer.description,
          fees: transfer.fees,
          netAmount: transfer.netAmount || transfer.amount - (transfer.fees || 0),
          clearingDate: transfer.clearingDate ? new Date(transfer.clearingDate) : null,
          processedAt: transfer.status === "completed" ? new Date(transfer.created) : null,
          metadata: transfer.metadata || {},
          failureReason: transfer.failureReason || null,
          failureCode: transfer.failureCode || null,
          returnCode: transfer.returnCode || null,
        },
      })
    }
  }

  /**
   * Infer transaction direction from source/destination
   */
  private inferDirection(transfer: any): "credit" | "debit" {
    // This is a simplified logic - in real implementation,
    // we'd check if source or destination belongs to our account
    return transfer.sourceId?.includes("bank") ? "debit" : "credit"
  }

  /**
   * Generate mock transactions for demo mode
   */
  private async generateMockTransactions(options: ACHSyncOptions): Promise<any[]> {
    const count = options.limit || 50
    const statuses = ["pending", "processing", "completed", "failed", "cancelled", "returned"]
    // Only generate customer-initiated transfers (credits to Cakewalk)
    const directions = ["credit"]
    const companies = [
      "Acme Corp",
      "TechStart Inc",
      "Global Solutions",
      "Prime Services",
      "Digital Dynamics",
    ]
    const names = ["John Smith", "Jane Doe", "Robert Johnson", "Maria Garcia", "David Lee"]

    const transactions = []
    const now = new Date()

    for (let i = 0; i < count; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const direction = directions[Math.floor(Math.random() * directions.length)]
      const amount = parseFloat((Math.random() * 5000 + 100).toFixed(2))
      const created = new Date(now)
      created.setDate(created.getDate() - Math.floor(Math.random() * 90))

      // Skip if outside date range
      if (options.startDate && created < options.startDate) continue
      if (options.endDate && created > options.endDate) continue

      // Generate failure data for failed/returned transactions
      let failureReason = null
      let failureCode = null
      let returnCode = null
      let failureDetails = null
      
      if (status === 'failed' || status === 'returned') {
        const failureReturnCodes = ['R01', 'R02', 'R03', 'R04', 'R07', 'R08', 'R10', 'R16', 'R20', 'R29']
        returnCode = failureReturnCodes[Math.floor(Math.random() * failureReturnCodes.length)]
        const returnCodeInfo = getReturnCodeInfo(returnCode)
        failureCode = returnCode
        failureReason = returnCodeInfo.title
        failureDetails = {
          demo: true,
          returnCodeInfo: {
            title: returnCodeInfo.title,
            description: returnCodeInfo.description,
            detailedExplanation: returnCodeInfo.detailedExplanation,
            retryable: returnCodeInfo.retryable,
            userAction: returnCodeInfo.userAction,
            category: returnCodeInfo.category,
          }
        }
      }

      const transaction = {
        id: `dwolla_${Math.random().toString(36).substr(2, 9)}`,
        status,
        amount,
        currency: "USD",
        direction,
        created: created.toISOString(),
        sourceId: `src_${Math.random().toString(36).substr(2, 9)}`,
        sourceName:
          direction === "debit"
            ? names[Math.floor(Math.random() * names.length)]
            : "Company Account",
        destinationId: `dst_${Math.random().toString(36).substr(2, 9)}`,
        destinationName:
          direction === "credit"
            ? names[Math.floor(Math.random() * names.length)]
            : "Company Account",
        bankLastFour: Math.floor(Math.random() * 9000 + 1000).toString(),
        correlationId: `cor_${Math.random().toString(36).substr(2, 9)}`,
        individualAchId: `ach_${Math.random().toString(36).substr(2, 9)}`,
        customerId: `cust_${Math.random().toString(36).substr(2, 9)}`,
        customerName: names[Math.floor(Math.random() * names.length)],
        customerEmail: `${names[Math.floor(Math.random() * names.length)].toLowerCase().replace(" ", ".")}@example.com`,
        companyName: companies[Math.floor(Math.random() * companies.length)],
        invoiceNumber: `INV-${Math.floor(Math.random() * 9000 + 1000)}`,
        transactionType: direction === "credit" ? "payment" : "invoice",
        description: `${direction === "credit" ? "Payment" : "Invoice"} for services`,
        fees: status === "completed" ? parseFloat((amount * 0.0029).toFixed(2)) : 0,
        netAmount:
          status === "completed" ? amount - parseFloat((amount * 0.0029).toFixed(2)) : amount,
        clearingDate:
          status === "completed" ? new Date(created.getTime() + 86400000 * 3).toISOString() : null,
        metadata: {
          source: "demo",
          generatedAt: new Date().toISOString(),
        },
        failureReason,
        failureCode,
        returnCode,
        failureDetails,
      }

      transactions.push(transaction)
    }

    return transactions
  }

  /**
   * Fetch transaction details from Dwolla
   */
  async getTransactionDetails(dwollaId: string): Promise<any> {
    try {
      // In demo mode, generate a mock transaction
      if (process.env.DEMO_MODE === "true") {
        const mockTransactions = await this.generateMockTransactions({ limit: 1 })
        return { ...mockTransactions[0], id: dwollaId }
      }

      // Fetch real transfer from Dwolla API
      const transfer = await this.client.getTransfer(dwollaId)
      return this.enrichTransferData(transfer)
    } catch (error) {
      console.error("Failed to fetch transaction details", { dwollaId, error })
      throw error
    }
  }
}
