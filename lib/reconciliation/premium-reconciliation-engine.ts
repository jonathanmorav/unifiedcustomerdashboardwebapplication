/**
 * Premium Reconciliation Engine
 * 
 * This module handles the core logic for reconciling processed payments
 * with policy premiums and generating carrier remittance reports.
 */

import { prisma } from '@/lib/db'
import { HubSpotService } from '@/lib/api/hubspot/service'
import { getCarrierByPolicyType, getAllCarriers } from './policy-carrier-mapping'
import { log } from '@/lib/logger'
import type {
  SummaryOfBenefitsReconciliation,
  CarrierPremiumBreakdown,
  ReconciliationReport,
  ValidationResult,
  ValidationError,
  PolicyLineItem,
  EmployeeCoverage,
  CarrierRemittanceFile
} from '@/lib/types/reconciliation'

export class PremiumReconciliationEngine {
  private hubspotService: HubSpotService

  constructor() {
    this.hubspotService = new HubSpotService()
  }

  /**
   * Main reconciliation function - processes all successfully processed payments
   * and generates carrier breakdown
   */
  async runPremiumReconciliation(
    billingPeriod: string,
    options: {
      dateRange?: { start: Date; end: Date }
      includePending?: boolean
    } = {}
  ): Promise<{
    report: ReconciliationReport
    validation: ValidationResult
    carrierFiles: CarrierRemittanceFile[]
  }> {
    const startTime = new Date()
    
    try {
      log.info('Starting premium reconciliation', { 
        billingPeriod, 
        options 
      })

      // Step 1: Get all successfully processed transactions
      const processedTransactions = await this.getProcessedTransactions(options.dateRange)
      
      log.info('Found processed transactions', { 
        count: processedTransactions.length,
        totalAmount: processedTransactions.reduce((sum, t) => sum + Number(t.amount), 0)
      })

      // Step 2: Match transactions to HubSpot customer data
      const reconciliationData = await this.matchTransactionsToCustomers(
        processedTransactions,
        billingPeriod
      )

      log.info('Matched transactions to customers', { 
        customerCount: reconciliationData.length 
      })

      // Step 3: Break down by carrier
      const carrierBreakdown = await this.breakdownByCarrier(reconciliationData)

      // Step 4: Generate reconciliation report
      const report = this.generateReconciliationReport(
        reconciliationData,
        carrierBreakdown,
        billingPeriod
      )

      // Step 5: Validate reconciliation
      const validation = this.validateReconciliation(report, processedTransactions)

      // Step 6: Generate carrier remittance files
      const carrierFiles = this.generateCarrierRemittanceFiles(report, carrierBreakdown)

      log.info('Premium reconciliation completed', {
        billingPeriod,
        duration: Date.now() - startTime.getTime(),
        totalCollected: report.totalCollected,
        carrierCount: carrierFiles.length,
        isValid: validation.isValid
      })

      return { report, validation, carrierFiles }

    } catch (error) {
      log.error('Premium reconciliation failed', error as Error, {
        billingPeriod,
        duration: Date.now() - startTime.getTime()
      })
      throw error
    }
  }

  /**
   * Get all processed ACH transactions for the reconciliation period
   */
  private async getProcessedTransactions(dateRange?: { start: Date; end: Date }) {
    const whereClause: any = {
      status: 'processed',
      amount: { gt: 0 } // Only include credits (incoming payments)
    }

    if (dateRange) {
      whereClause.processedAt = {
        gte: dateRange.start,
        lte: dateRange.end
      }
    }

    return await prisma.aCHTransaction.findMany({
      where: whereClause,
      orderBy: { processedAt: 'desc' },
      select: {
        id: true,
        dwollaId: true,
        amount: true,
        currency: true,
        processedAt: true,
        customerName: true,
        companyName: true,
        customerId: true,
        customerEmail: true,
        correlationId: true,
        invoiceNumber: true,
        metadata: true
      }
    })
  }

  /**
   * Match ACH transactions to HubSpot customer data and policies
   */
  private async matchTransactionsToCustomers(
    transactions: any[],
    billingPeriod: string
  ): Promise<SummaryOfBenefitsReconciliation[]> {
    const reconciliationData: SummaryOfBenefitsReconciliation[] = []

    for (const transaction of transactions) {
      try {
        // Find HubSpot customer data
        let customerData = null

        // First try by Dwolla customer ID if available
        if (transaction.customerId) {
          customerData = await this.hubspotService.searchCustomer({
            searchTerm: transaction.customerId,
            searchType: 'dwolla_id'
          })
        }

        // Fallback to company name search
        if (!customerData && transaction.companyName) {
          customerData = await this.hubspotService.searchCustomer({
            searchTerm: transaction.companyName,
            searchType: 'business_name'
          })
        }

        // Fallback to customer email search
        if (!customerData && transaction.customerEmail) {
          customerData = await this.hubspotService.searchCustomer({
            searchTerm: transaction.customerEmail,
            searchType: 'email'
          })
        }

        if (!customerData) {
          log.warn('No HubSpot customer data found for transaction', {
            transactionId: transaction.id,
            dwollaId: transaction.dwollaId,
            companyName: transaction.companyName,
            customerEmail: transaction.customerEmail
          })
          continue
        }

        // Transform customer data into reconciliation format
        const formattedData = this.hubspotService.formatCustomerData(customerData)
        
        for (const sob of formattedData.summaryOfBenefits) {
          const employees: EmployeeCoverage[] = []
          
          // Group policies by policyholder (employee)
          const policiesByEmployee = new Map<string, PolicyLineItem[]>()
          
          for (const policy of sob.policies) {
            const employeeKey = policy.policyHolderName || 'Unknown Employee'
            
            if (!policiesByEmployee.has(employeeKey)) {
              policiesByEmployee.set(employeeKey, [])
            }

            const carrier = getCarrierByPolicyType(policy.productName)
            
            const policyLineItem: PolicyLineItem = {
              policyId: policy.id,
              policyType: policy.productName,
              policyNumber: policy.policyNumber || 'N/A',
              coverageAmount: policy.coverageAmount || 0,
              coverageLevel: policy.coverageLevel || 'Unknown',
              premiumDue: policy.costPerMonth || 0,
              carrier,
              planVariant: policy.planName
            }

            policiesByEmployee.get(employeeKey)!.push(policyLineItem)
          }

          // Create employee coverage objects
          for (const [employeeName, policies] of policiesByEmployee) {
            employees.push({
              employeeId: `${formattedData.company.id}-${employeeName}`,
              employeeName,
              policies
            })
          }

          const reconciliation: SummaryOfBenefitsReconciliation = {
            clientId: formattedData.company.id,
            clientName: formattedData.company.name,
            dwollaCustomerId: formattedData.company.dwollaId || transaction.customerId || '',
            billingPeriod,
            employees,
            totalAmountDue: Number(transaction.amount),
            paymentStatus: 'processed',
            paymentDate: transaction.processedAt,
            dwollaTransactionId: transaction.dwollaId
          }

          reconciliationData.push(reconciliation)
        }

      } catch (error) {
        log.error('Error matching transaction to customer', error as Error, {
          transactionId: transaction.id,
          dwollaId: transaction.dwollaId
        })
      }
    }

    return reconciliationData
  }

  /**
   * Break down reconciliation data by carrier
   */
  private async breakdownByCarrier(
    reconciliationData: SummaryOfBenefitsReconciliation[]
  ): Promise<CarrierPremiumBreakdown[]> {
    const carrierMap = new Map<string, CarrierPremiumBreakdown>()

    for (const account of reconciliationData) {
      for (const employee of account.employees) {
        for (const policy of employee.policies) {
          const { carrier } = policy

          // Initialize carrier breakdown if not exists
          if (!carrierMap.has(carrier)) {
            carrierMap.set(carrier, {
              carrier,
              totalPremium: 0,
              policyBreakdown: []
            })
          }

          const carrierData = carrierMap.get(carrier)!

          // Find or create policy type breakdown
          let policyBreakdown = carrierData.policyBreakdown.find(
            pb => pb.policyType === policy.policyType
          )

          if (!policyBreakdown) {
            policyBreakdown = {
              policyType: policy.policyType,
              totalPremium: 0,
              policyCount: 0,
              lineItems: []
            }
            carrierData.policyBreakdown.push(policyBreakdown)
          }

          // Add line item
          policyBreakdown.lineItems.push({
            clientId: account.clientId,
            clientName: account.clientName,
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            policyNumber: policy.policyNumber,
            premium: policy.premiumDue,
            coverageLevel: policy.coverageLevel,
            coverageAmount: policy.coverageAmount
          })

          // Update totals
          policyBreakdown.totalPremium += policy.premiumDue
          policyBreakdown.policyCount += 1
          carrierData.totalPremium += policy.premiumDue
        }
      }
    }

    return Array.from(carrierMap.values())
  }

  /**
   * Generate comprehensive reconciliation report
   */
  private generateReconciliationReport(
    reconciliationData: SummaryOfBenefitsReconciliation[],
    carrierBreakdown: CarrierPremiumBreakdown[],
    billingPeriod: string
  ): ReconciliationReport {
    const totalCollected = reconciliationData.reduce(
      (sum, account) => sum + account.totalAmountDue, 
      0
    )

    const totalEmployees = new Set(
      reconciliationData.flatMap(account => 
        account.employees.map(emp => emp.employeeId)
      )
    ).size

    const totalPolicies = carrierBreakdown.reduce(
      (sum, carrier) => sum + carrier.policyBreakdown.reduce(
        (pSum, policy) => pSum + policy.policyCount, 
        0
      ), 
      0
    )

    const carrierRemittances = carrierBreakdown.map(carrier => ({
      carrier: carrier.carrier,
      totalDue: carrier.totalPremium,
      policyDetails: carrier.policyBreakdown.map(policy => {
        // Create client roster
        const clientMap = new Map<string, {
          clientId: string
          clientName: string
          employeeCount: number
          totalPremium: number
        }>()

        policy.lineItems.forEach(item => {
          if (!clientMap.has(item.clientId)) {
            clientMap.set(item.clientId, {
              clientId: item.clientId,
              clientName: item.clientName,
              employeeCount: 0,
              totalPremium: 0
            })
          }

          const client = clientMap.get(item.clientId)!
          client.employeeCount++
          client.totalPremium += item.premium
        })

        return {
          policyType: policy.policyType,
          count: policy.policyCount,
          totalPremium: policy.totalPremium,
          clientRoster: Array.from(clientMap.values())
        }
      })
    }))

    return {
      reportId: `recon-${Date.now()}`,
      reportDate: new Date(),
      billingPeriod,
      totalCollected,
      totalAccountsProcessed: reconciliationData.length,
      carrierRemittances,
      reconciliationSummary: {
        totalAccountsProcessed: reconciliationData.length,
        totalEmployeesCovered: totalEmployees,
        totalPolicies,
        discrepancies: [] // Will be populated by validation
      }
    }
  }

  /**
   * Validate reconciliation for accuracy and completeness
   */
  private validateReconciliation(
    report: ReconciliationReport,
    originalTransactions: any[]
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // Validation 1: Total collected matches sum of carrier remittances
    const carrierTotal = report.carrierRemittances.reduce(
      (sum, carrier) => sum + carrier.totalDue, 
      0
    )

    if (Math.abs(report.totalCollected - carrierTotal) > 0.01) {
      errors.push({
        type: 'amount_mismatch',
        severity: 'error',
        message: `Total collected ($${report.totalCollected.toFixed(2)}) does not match carrier remittances ($${carrierTotal.toFixed(2)})`,
        details: {
          totalCollected: report.totalCollected,
          carrierTotal,
          difference: report.totalCollected - carrierTotal
        }
      })
    }

    // Validation 2: Check for unmapped carriers
    const unmappedCarriers = report.carrierRemittances.filter(
      c => c.carrier === 'Unknown'
    )

    if (unmappedCarriers.length > 0) {
      warnings.push({
        type: 'missing_mapping',
        severity: 'warning',
        message: `Found ${unmappedCarriers.length} unmapped carrier(s) with total premium: $${
          unmappedCarriers.reduce((sum, c) => sum + c.totalDue, 0).toFixed(2)
        }`,
        details: { unmappedCarriers }
      })
    }

    // Validation 3: Verify all processed transactions are included
    const originalTotal = originalTransactions.reduce(
      (sum, t) => sum + Number(t.amount), 
      0
    )

    if (Math.abs(originalTotal - report.totalCollected) > 0.01) {
      errors.push({
        type: 'data_inconsistency',
        severity: 'error',
        message: `Original transaction total ($${originalTotal.toFixed(2)}) does not match report total ($${report.totalCollected.toFixed(2)})`,
        details: {
          originalTotal,
          reportTotal: report.totalCollected,
          originalCount: originalTransactions.length,
          reportCount: report.totalAccountsProcessed
        }
      })
    }

    // Update report with validation results
    report.reconciliationSummary.discrepancies = [...errors, ...warnings]

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Generate carrier-specific remittance files
   */
  private generateCarrierRemittanceFiles(
    report: ReconciliationReport,
    carrierBreakdown: CarrierPremiumBreakdown[]
  ): CarrierRemittanceFile[] {
    return carrierBreakdown.map(carrier => ({
      carrier: carrier.carrier,
      remittanceDate: report.reportDate,
      billingPeriod: report.billingPeriod,
      totalAmount: carrier.totalPremium,
      fileFormat: 'csv' as const,
      policies: carrier.policyBreakdown.map(policy => ({
        policyType: policy.policyType,
        details: policy.lineItems.map(item => ({
          clientId: item.clientId,
          clientName: item.clientName,
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          policyNumber: item.policyNumber,
          premium: item.premium,
          coverageLevel: item.coverageLevel,
          coverageAmount: item.coverageAmount
        }))
      }))
    }))
  }
}