import { HubSpotClient } from "./client"
import type {
  HubSpotCustomerData,
  HubSpotObject,
  HubSpotCompany,
  HubSpotPolicy,
  Policy,
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
      console.log(
        `[CLARITY DEBUG] searchCustomer called with searchTerm=${params.searchTerm} searchType=${params.searchType}`
      )
      log.debug(
        `HubSpotService.searchCustomer called with searchTerm=${params.searchTerm} searchType=${params.searchType}`
      )

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

      log.debug(
        `HubSpotService.searchCustomer: Fetched ${summaryOfBenefits.length} Summary of Benefits, ${monthlyInvoices.length} Monthly Invoices`
      )

      // Get policies for each SOB in parallel
      const policiesPromises = summaryOfBenefits.map((sob) =>
        this.client.getSummaryOfBenefitsPolicies(sob.id)
      )
      const policiesArrays = await Promise.all(policiesPromises)

      // Flatten all policies into a single array
      const allPolicies = policiesArrays.flat()

      log.debug(`HubSpotService.searchCustomer: Total policies fetched: ${allPolicies.length}`)



      const result = {
        company,
        summaryOfBenefits,
        policies: allPolicies,
        monthlyInvoices,
        activeLists: listMemberships.lists,
      }

      log.debug(
        `HubSpotService.searchCustomer: Returning complete customer data for company ${company.id} with ${listMemberships.total} active lists`
      )
      return result
    } catch (error) {
      log.error("Error searching HubSpot customer", error as Error, {
        searchTerm: params.searchTerm,
        searchType: params.searchType,
        operation: "hubspot_search_customer",
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
        [
          "name",
          "domain",
          "email___owner",
          "dwolla_customer_id",
          "onboarding_status",
          "onboarding_step",
          "hs_object_id",
        ]
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



      return {
        company,
        summaryOfBenefits,
        policies: allPolicies,
        monthlyInvoices,
        activeLists: listMemberships.lists,
      }
    } catch (error) {
      log.error("Error getting HubSpot customer data", error as Error, {
        companyId,
        operation: "hubspot_get_customer_data",
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
      policies: Policy[]
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
          policyNumber: String(policy.properties.policyholder || ""),
          policyHolderName: policy.properties.first_name && policy.properties.last_name 
            ? `${policy.properties.first_name} ${policy.properties.last_name}`
            : String(policy.properties.policyholder || ""),
          productName: String(policy.properties.product_name || ""),
          planName: policy.properties.plan_name ? String(policy.properties.plan_name) : undefined,
          costPerMonth: Number(policy.properties.cost_per_month) || 0,

          effectiveDate: String(policy.properties.policy_effective_date || ""),
          terminationDate: policy.properties.policy_termination_date
            ? String(policy.properties.policy_termination_date)
            : undefined,
          coverageLevel: policy.properties.coverage_level_display 
            ? String(policy.properties.coverage_level_display)
            : policy.properties.coverage_level 
              ? String(policy.properties.coverage_level)
              : undefined,
          coverageAmount: policy.properties.coverage_amount 
            ? Number(policy.properties.coverage_amount)
            : undefined,
          coverageAmountSpouse: policy.properties.coverage_amount_spouse
            ? Number(policy.properties.coverage_amount_spouse)
            : undefined,
          coverageAmountChildren: policy.properties.coverage_amount_children
            ? Number(policy.properties.coverage_amount_children)
            : undefined,
          companyName: policy.properties.company_name 
            ? String(policy.properties.company_name)
            : undefined,
          productCode: policy.properties.product_code
            ? String(policy.properties.product_code)
            : undefined,
          renewalDate: policy.properties.renewal_date
            ? String(policy.properties.renewal_date)
            : undefined,
          notes: policy.properties.notes
            ? String(policy.properties.notes)
            : undefined,
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
