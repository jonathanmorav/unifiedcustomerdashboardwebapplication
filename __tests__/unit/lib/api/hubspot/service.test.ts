import { HubSpotService } from "@/lib/api/hubspot/service"
import { HubSpotClient } from "@/lib/api/hubspot/client"
import {
  HubSpotCompany,
  HubSpotSummaryOfBenefits,
  HubSpotPolicy,
  HubSpotSearchParams,
} from "@/lib/types/hubspot"

// Mock the HubSpot client
jest.mock("@/lib/api/hubspot/client")

describe("HubSpotService", () => {
  let service: HubSpotService
  let mockClient: jest.Mocked<HubSpotClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = new HubSpotClient() as jest.Mocked<HubSpotClient>
    service = new HubSpotService()
    ;(service as any).client = mockClient
  })

  describe("searchCompany", () => {
    const mockCompany: HubSpotCompany = {
      id: "123",
      properties: {
        name: "Test Company",
        dwolla_customer_id: "dwolla-123",
        email: "test@company.com",
        business_name: "Test Business",
        createdate: "2024-01-01",
        hs_lastmodifieddate: "2024-01-15",
      },
    }

    it("should search company by email", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce({
        results: [mockCompany],
        paging: { next: null },
      })

      const params: HubSpotSearchParams = {
        email: "test@company.com",
      }

      const result = await service.searchCompany(params)

      expect(result).toEqual({
        data: {
          company: mockCompany.properties,
          summaryOfBenefits: [],
          policies: [],
          monthlyInvoices: [],
        },
        error: null,
      })

      expect(mockClient.searchCompanies).toHaveBeenCalledWith([
        {
          propertyName: "email",
          operator: "EQ",
          value: "test@company.com",
        },
      ])
    })

    it("should search company by dwolla ID", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce({
        results: [mockCompany],
        paging: { next: null },
      })

      const params: HubSpotSearchParams = {
        dwolla_id: "dwolla-123",
      }

      await service.searchCompany(params)

      expect(mockClient.searchCompanies).toHaveBeenCalledWith([
        {
          propertyName: "dwolla_customer_id",
          operator: "EQ",
          value: "dwolla-123",
        },
      ])
    })

    it("should search company by name", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce({
        results: [mockCompany],
        paging: { next: null },
      })

      const params: HubSpotSearchParams = {
        name: "Test Company",
      }

      await service.searchCompany(params)

      expect(mockClient.searchCompanies).toHaveBeenCalledWith([
        {
          propertyName: "name",
          operator: "CONTAINS_TOKEN",
          value: "Test Company",
        },
      ])
    })

    it("should search company by business name", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce({
        results: [mockCompany],
        paging: { next: null },
      })

      const params: HubSpotSearchParams = {
        business_name: "Test Business",
      }

      await service.searchCompany(params)

      expect(mockClient.searchCompanies).toHaveBeenCalledWith([
        {
          propertyName: "business_name",
          operator: "CONTAINS_TOKEN",
          value: "Test Business",
        },
      ])
    })

    it("should handle no company found", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce({
        results: [],
        paging: { next: null },
      })

      const result = await service.searchCompany({ email: "notfound@example.com" })

      expect(result).toEqual({
        data: null,
        error: {
          code: "COMPANY_NOT_FOUND",
          message: "No company found with the provided search criteria",
        },
      })
    })

    it("should handle API errors gracefully", async () => {
      mockClient.searchCompanies.mockRejectedValueOnce(new Error("API Error"))

      const result = await service.searchCompany({ email: "test@company.com" })

      expect(result).toEqual({
        data: null,
        error: {
          code: "HUBSPOT_API_ERROR",
          message: "Failed to search company: API Error",
        },
      })
    })

    it("should support abort signal", async () => {
      const abortController = new AbortController()
      mockClient.searchCompanies.mockResolvedValueOnce({
        results: [mockCompany],
        paging: { next: null },
      })

      await service.searchCompany({ email: "test@company.com" }, abortController.signal)

      expect(mockClient.searchCompanies).toHaveBeenCalledWith(
        expect.any(Array),
        abortController.signal
      )
    })
  })

  describe("getSummaryOfBenefits", () => {
    const mockSOB: HubSpotSummaryOfBenefits = {
      id: "sob-123",
      properties: {
        name: "Test SOB",
        pdf_document_url: "https://example.com/sob.pdf",
        effective_date: "2024-01-01",
        status: "active",
      },
      associations: {
        companies: {
          results: [{ id: "123", type: "company_to_summary_of_benefits" }],
        },
      },
    }

    it("should get summary of benefits for company", async () => {
      mockClient.getSummaryOfBenefits.mockResolvedValueOnce({
        results: [mockSOB],
        paging: { next: null },
      })

      const result = await service.getSummaryOfBenefits("123")

      expect(result).toEqual([
        {
          id: "sob-123",
          name: "Test SOB",
          pdf_url: "https://example.com/sob.pdf",
          effective_date: "2024-01-01",
          status: "active",
        },
      ])

      expect(mockClient.getSummaryOfBenefits).toHaveBeenCalledWith("123", undefined)
    })

    it("should handle missing associations", async () => {
      const sobWithoutAssoc = {
        ...mockSOB,
        associations: undefined,
      }

      mockClient.getSummaryOfBenefits.mockResolvedValueOnce({
        results: [sobWithoutAssoc],
        paging: { next: null },
      })

      const result = await service.getSummaryOfBenefits("123")

      expect(result).toEqual([
        {
          id: "sob-123",
          name: "Test SOB",
          pdf_url: "https://example.com/sob.pdf",
          effective_date: "2024-01-01",
          status: "active",
        },
      ])
    })

    it("should handle API errors", async () => {
      mockClient.getSummaryOfBenefits.mockRejectedValueOnce(new Error("API Error"))

      const result = await service.getSummaryOfBenefits("123")

      expect(result).toEqual([])
    })
  })

  describe("getPolicies", () => {
    const mockPolicy: HubSpotPolicy = {
      id: "policy-123",
      properties: {
        policy_number: "POL-123",
        policy_name: "Test Policy",
        carrier_name: "Test Carrier",
        policy_type: "Health",
        effective_date: "2024-01-01",
        termination_date: "2024-12-31",
        status: "active",
      },
      associations: {
        companies: {
          results: [{ id: "123", type: "company_to_policy" }],
        },
      },
    }

    it("should get policies for company", async () => {
      mockClient.getPolicies.mockResolvedValueOnce({
        results: [mockPolicy],
        paging: { next: null },
      })

      const result = await service.getPolicies("123")

      expect(result).toEqual([
        {
          id: "policy-123",
          policy_number: "POL-123",
          policy_name: "Test Policy",
          carrier_name: "Test Carrier",
          policy_type: "Health",
          effective_date: "2024-01-01",
          termination_date: "2024-12-31",
          status: "active",
        },
      ])

      expect(mockClient.getPolicies).toHaveBeenCalledWith("123", undefined)
    })

    it("should handle empty policy list", async () => {
      mockClient.getPolicies.mockResolvedValueOnce({
        results: [],
        paging: { next: null },
      })

      const result = await service.getPolicies("123")

      expect(result).toEqual([])
    })

    it("should handle API errors", async () => {
      mockClient.getPolicies.mockRejectedValueOnce(new Error("API Error"))

      const result = await service.getPolicies("123")

      expect(result).toEqual([])
    })
  })

  describe("getMonthlyInvoices", () => {
    it("should get monthly invoices", async () => {
      mockClient.getMonthlyInvoices.mockResolvedValueOnce({
        results: [
          {
            id: "inv-1",
            properties: {
              invoice_number: "INV-001",
              amount: 1000,
              due_date: "2024-02-01",
              status: "paid",
            },
          },
        ],
        paging: { next: null },
      })

      const result = await service.getMonthlyInvoices("123")

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        invoice_number: "INV-001",
        amount: 1000,
        status: "paid",
      })
    })
  })

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network error")
      ;(networkError as any).code = "ECONNREFUSED"

      mockClient.searchCompanies.mockRejectedValueOnce(networkError)

      const result = await service.searchCompany({ email: "test@example.com" })

      expect(result.error?.code).toBe("HUBSPOT_API_ERROR")
      expect(result.error?.message).toContain("Network error")
    })

    it("should handle rate limit errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded")
      ;(rateLimitError as any).response = { status: 429 }

      mockClient.searchCompanies.mockRejectedValueOnce(rateLimitError)

      const result = await service.searchCompany({ email: "test@example.com" })

      expect(result.error?.code).toBe("HUBSPOT_API_ERROR")
      expect(result.error?.message).toContain("Rate limit exceeded")
    })
  })
})
