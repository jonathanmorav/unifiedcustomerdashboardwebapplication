import { HubSpotClient } from "./client"
import type {
  HubSpotCustomerData,
  HubSpotObject,
  HubSpotCompany,
  HubSpotPolicy,
} from "@/lib/types/hubspot"
import { log } from "@/lib/logger"

export interface HubSpotSearchParams {
  searchTerm: string
  searchType: "email" | "name" | "business_name" | "dwolla_id"
}

export class HubSpotService {
  private client: HubSpotClient

  constructor() {
    this.client = new HubSpotClient()
  }

  /**
   * Search for customer data in HubSpot by various parameters
   */
  async searchCustomer(params: HubSpotSearchParams): Promise<HubSpotCustomerData | null> {
    try {
      log.debug(`HubSpotService.searchCustomer called with searchTerm=${params.searchTerm} searchType=${params.searchType}`)
      
      // Map business_name to name for the API
      const apiSearchType = params.searchType === "business_name" ? "name" : params.searchType

      // Search for companies
      const companies = await this.client.searchCompanies(params.searchTerm, apiSearchType)
      log.debug(`HubSpotService.searchCustomer: found ${companies.length} companies`)

      if (!companies.length) {
        log.debug(`HubSpotService.searchCustomer: No companies found for term ${params.searchTerm}`)
        return null
      }

      // Use the first matching company
      const company = companies[0]
      log.debug(`HubSpotService.searchCustomer: Using first company with ID ${company.id}`)

      // Get all related data in parallel
      const [summaryOfBenefits, monthlyInvoices, listMemberships] = await Promise.all([
        this.client.getCompanySummaryOfBenefits(company.id),
        this.client.getMonthlyInvoices("companies", company.id),
        this.client.getCompanyListMemberships(company.id),
      ])

      log.debug(`HubSpotService.searchCustomer: Fetched ${summaryOfBenefits.length} Summary of Benefits, ${monthlyInvoices.length} Monthly Invoices`)

      // Get policies for each SOB in parallel
      const policiesPromises = summaryOfBenefits.map((sob) =>
        this.client.getSummaryOfBenefitsPolicies(sob.id)
      )
      const policiesArrays = await Promise.all(policiesPromises)

      // Flatten all policies into a single array
      const allPolicies = policiesArrays.flat()

      log.debug(`HubSpotService.searchCustomer: Total policies fetched: ${allPolicies.length}`)

      // Get Clarity sessions by searching for contacts associated with the company
      let claritySessions = []
      try {
        // First, get contacts associated with the company
        const contacts = await this.client.getAssociations("companies", company.id, "contacts")
        
        log.info(`Found ${contacts.results?.length || 0} contacts for company ${company.id}`, {
          companyName: company.properties.name,
          contactIds: contacts.results?.map(c => c.id) || [],
          operation: 'hubspot_get_contacts_for_clarity'
        })
        
        if (contacts.results && contacts.results.length > 0) {
          // For now, just get engagements for the first contact
          // In production, you might want to aggregate across all contacts
          const primaryContactId = contacts.results[0].id
          const engagements = await this.client.getContactEngagements(primaryContactId)
          
          log.info(`Found ${engagements.length} engagements for contact ${primaryContactId}`, {
            engagementTypes: engagements.map(e => e.type || 'unknown'),
            operation: 'hubspot_get_engagements'
          })
          
          claritySessions = this.client.parseClaritySessionsFromEngagements(engagements)
          
          log.info(`HubSpotService.searchCustomer: Found ${claritySessions.length} Clarity sessions`, {
            sessionIds: claritySessions.map(s => s.id),
            operation: 'hubspot_clarity_sessions_parsed'
          })
        }
      } catch (error) {
        log.warn("Failed to fetch Clarity sessions", {
          companyId: company.id,
          error: error instanceof Error ? error.message : String(error),
          operation: 'hubspot_fetch_clarity_sessions'
        })
      }

      const result = {
        company,
        summaryOfBenefits,
        policies: allPolicies,
        monthlyInvoices,
        activeLists: listMemberships.lists,
        claritySessions,
      }
      
      log.debug(`HubSpotService.searchCustomer: Returning complete customer data for company ${company.id} with ${listMemberships.total} active lists and ${claritySessions.length} Clarity sessions`)
      return result
    } catch (error) {
      log.error("Error searching HubSpot customer", error as Error, {
        searchTerm: params.searchTerm,
        searchType: params.searchType,
        operation: 'hubspot_search_customer'
      })
      throw error
    }
  }

  /**
   * Get complete customer data by company ID
   */
  async getCustomerDataByCompanyId(companyId: string): Promise<HubSpotCustomerData | null> {
    try {
      // Get company details
      const companyObject = await this.client.getObjectById<HubSpotCompany["properties"]>(
        "companies",
        companyId,
        ["name", "domain", "email___owner", "dwolla_customer_id", "onboarding_status", "onboarding_step", "hs_object_id"]
      )

      // Convert to HubSpotCompany format
      const company: HubSpotCompany = companyObject

      // Get all related data in parallel
      const [summaryOfBenefits, monthlyInvoices, listMemberships] = await Promise.all([
        this.client.getCompanySummaryOfBenefits(companyId),
        this.client.getMonthlyInvoices("companies", companyId),
        this.client.getCompanyListMemberships(companyId),
      ])

      // Get policies for each SOB in parallel
      const policiesPromises = summaryOfBenefits.map((sob) =>
        this.client.getSummaryOfBenefitsPolicies(sob.id)
      )
      const policiesArrays = await Promise.all(policiesPromises)

      // Flatten all policies into a single array
      const allPolicies = policiesArrays.flat()

      // Get Clarity sessions
      let claritySessions = []
      try {
        const contacts = await this.client.getAssociations("companies", companyId, "contacts")
        
        if (contacts.results && contacts.results.length > 0) {
          const primaryContactId = contacts.results[0].id
          const engagements = await this.client.getContactEngagements(primaryContactId)
          claritySessions = this.client.parseClaritySessionsFromEngagements(engagements)
        }
      } catch (error) {
        log.warn("Failed to fetch Clarity sessions", {
          companyId,
          error: error instanceof Error ? error.message : String(error),
          operation: 'hubspot_fetch_clarity_sessions'
        })
      }

      return {
        company,
        summaryOfBenefits,
        policies: allPolicies,
        monthlyInvoices,
        activeLists: listMemberships.lists,
        claritySessions,
      }
    } catch (error) {
      log.error("Error getting HubSpot customer data", error as Error, {
        companyId,
        operation: 'hubspot_get_customer_data'
      })
      throw error
    }
  }

  /**
   * Format HubSpot data for display
   */
  formatCustomerData(data: HubSpotCustomerData): {
    company: {
      id: string
      name: string
      ownerEmail: string | null
      dwollaId: string | null
      onboardingStatus: string | null
      onboardingStep: string | null
    }
    summaryOfBenefits: Array<{
      id: string
      amountToDraft: number
      feeAmount: number
      pdfDocumentUrl: string | null
      totalPolicies: number
      policies: Array<{
        id: string
        policyNumber: string
        policyHolderName: string
        coverageType: string
        premiumAmount: number
        effectiveDate: string
        expirationDate: string | null
        status: string
      }>
    }>
    monthlyInvoices: Array<{
      id: string
      invoiceNumber: string
      invoiceDate: string
      totalAmount: number
      status: string
    }>
    activeLists: Array<{
      listId: number
      listName: string
      listType: "STATIC" | "DYNAMIC"
      membershipTimestamp: string | null
    }>
  } {
    // Group policies by SOB
    const policiesBySob = new Map<string, HubSpotObject<HubSpotPolicy["properties"]>[]>()

    // Create SOB to policies mapping
    data.summaryOfBenefits.forEach((sob) => {
      policiesBySob.set(sob.id, [])
    })

    // This is simplified - in reality, we'd need to track which policies belong to which SOB
    // For now, we'll distribute policies evenly or based on some logic
    data.policies.forEach((policy, index) => {
      const sobIndex = index % data.summaryOfBenefits.length
      const sobId = data.summaryOfBenefits[sobIndex]?.id
      if (sobId && policiesBySob.has(sobId)) {
        policiesBySob.get(sobId)!.push(policy)
      }
    })

    return {
      company: {
        id: data.company?.id || "",
        name: data.company?.properties?.name || "",
        ownerEmail: data.company?.properties?.email___owner || null,
        dwollaId: data.company?.properties?.dwolla_customer_id || null,
        onboardingStatus: data.company?.properties?.onboarding_status || null,
        onboardingStep: data.company?.properties?.onboarding_step || null,
      },
      summaryOfBenefits: data.summaryOfBenefits.map((sob) => ({
        id: sob.id,
        amountToDraft: Number(sob.properties.amount_to_draft) || 0,
        feeAmount: Number(sob.properties.fee_amount) || 0,
        pdfDocumentUrl: sob.properties.pdf_document_url || null,
        totalPolicies: policiesBySob.get(sob.id)?.length || 0,
        policies: (policiesBySob.get(sob.id) || []).map((policy) => ({
          id: policy.id,
          policyNumber: String(policy.properties.policy_number || ""),
          policyHolderName: String(policy.properties.policy_holder_name || ""),
          coverageType: String(policy.properties.coverage_type || ""),
          premiumAmount: Number(policy.properties.premium_amount) || 0,
          effectiveDate: String(policy.properties.effective_date || ""),
          expirationDate: policy.properties.expiration_date
            ? String(policy.properties.expiration_date)
            : null,
          status: String(policy.properties.status || ""),
        })),
      })),
      monthlyInvoices: (data.monthlyInvoices || []).map((invoice) => ({
        id: invoice.id,
        invoiceNumber: String(invoice.properties.invoice_number || ""),
        invoiceDate: String(invoice.properties.invoice_date || ""),
        totalAmount: Number(invoice.properties.total_amount) || 0,
        status: String(invoice.properties.status || ""),
      })),
      activeLists: (data.activeLists || []).map((list) => ({
        listId: list.listId,
        listName: list.listName,
        listType: list.listType,
        membershipTimestamp: list.membershipTimestamp || null,
      })),
    }
  }
}
