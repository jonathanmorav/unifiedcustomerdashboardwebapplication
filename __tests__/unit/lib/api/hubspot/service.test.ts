import { HubSpotService } from "@/lib/api/hubspot/service"
import { HubSpotClient } from "@/lib/api/hubspot/client"
import {
  HubSpotCompany,
  HubSpotSummaryOfBenefits,
  HubSpotPolicy,
  HubSpotSearchParams,
} from "@/lib/types/hubspot"

// Mock the HubSpot client
jest.mock("@/lib/api/hubspot/client", () => ({
  HubSpotClient: jest.fn().mockImplementation(() => ({
    searchCompanies: jest.fn(),
    getCompanySummaryOfBenefits: jest.fn(),
    getMonthlyInvoices: jest.fn(),
    getCompanyListMemberships: jest.fn(),
    getSummaryOfBenefitsPolicies: jest.fn(),
  })),
  HubSpotAPIError: class HubSpotAPIError extends Error {
    constructor(message: string, public status?: number) {
      super(message)
      this.name = "HubSpotAPIError"
    }
  }
}))

describe("HubSpotService", () => {
  let service: HubSpotService
  let mockClient: jest.Mocked<HubSpotClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = new HubSpotClient() as jest.Mocked<HubSpotClient>
    service = new HubSpotService()
    ;(service as any).client = mockClient
  })

  describe("searchCustomer", () => {
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

    it("should search customer by email", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce([mockCompany])
      mockClient.getCompanySummaryOfBenefits.mockResolvedValueOnce([])
      mockClient.getMonthlyInvoices.mockResolvedValueOnce([])
      mockClient.getCompanyListMemberships.mockResolvedValueOnce({ lists: [], total: 0 })

      const result = await service.searchCustomer({ searchTerm: "test@company.com", searchType: "email" })

      expect(result).toEqual({
        company: mockCompany,
        summaryOfBenefits: [],
        policies: [],
        monthlyInvoices: [],
        activeLists: [],
      })

      expect(mockClient.searchCompanies).toHaveBeenCalledWith("test@company.com", "email")
    })

    it("should search customer by dwolla ID", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce([mockCompany])
      mockClient.getCompanySummaryOfBenefits.mockResolvedValueOnce([])
      mockClient.getMonthlyInvoices.mockResolvedValueOnce([])
      mockClient.getCompanyListMemberships.mockResolvedValueOnce({ lists: [], total: 0 })

      const params: HubSpotSearchParams = {
        searchTerm: "dwolla-123",
        searchType: "dwolla_id"
      }

      await service.searchCustomer(params)

      expect(mockClient.searchCompanies).toHaveBeenCalledWith("dwolla-123", "dwolla_id")
    })

    it("should search customer by name", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce([mockCompany])
      mockClient.getCompanySummaryOfBenefits.mockResolvedValueOnce([])
      mockClient.getMonthlyInvoices.mockResolvedValueOnce([])
      mockClient.getCompanyListMemberships.mockResolvedValueOnce({ lists: [], total: 0 })

      const params: HubSpotSearchParams = {
        searchTerm: "Test Company",
        searchType: "name"
      }

      await service.searchCustomer(params)

      expect(mockClient.searchCompanies).toHaveBeenCalledWith("Test Company", "name")
    })

    it("should search customer by business name", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce([mockCompany])
      mockClient.getCompanySummaryOfBenefits.mockResolvedValueOnce([])
      mockClient.getMonthlyInvoices.mockResolvedValueOnce([])
      mockClient.getCompanyListMemberships.mockResolvedValueOnce({ lists: [], total: 0 })

      const params: HubSpotSearchParams = {
        searchTerm: "Test Business",
        searchType: "business_name"
      }

      await service.searchCustomer(params)

      // business_name is mapped to name for the API
      expect(mockClient.searchCompanies).toHaveBeenCalledWith("Test Business", "name")
    })

    it("should handle no company found", async () => {
      mockClient.searchCompanies.mockResolvedValueOnce([])

      const result = await service.searchCustomer({ searchTerm: "notfound@example.com", searchType: "email" })

      expect(result).toBeNull()
    })

    it("should handle API errors gracefully", async () => {
      mockClient.searchCompanies.mockRejectedValueOnce(new Error("API Error"))

      await expect(service.searchCustomer({ searchTerm: "test@company.com", searchType: "email" })).rejects.toThrow("API Error")
    })

    it("should get policies for each summary of benefits", async () => {
      const mockSOB = {
        id: "sob-123",
        properties: {
          name: "Test SOB",
        },
      }
      const mockPolicy = {
        id: "policy-123",
        properties: {
          policy_name: "Test Policy",
        },
      }
      
      mockClient.searchCompanies.mockResolvedValueOnce([mockCompany])
      mockClient.getCompanySummaryOfBenefits.mockResolvedValueOnce([mockSOB])
      mockClient.getMonthlyInvoices.mockResolvedValueOnce([])
      mockClient.getCompanyListMemberships.mockResolvedValueOnce({ lists: [], total: 0 })
      mockClient.getSummaryOfBenefitsPolicies.mockResolvedValueOnce([mockPolicy])

      const result = await service.searchCustomer({ searchTerm: "test@company.com", searchType: "email" })

      expect(mockClient.getSummaryOfBenefitsPolicies).toHaveBeenCalledWith("sob-123")
      expect(result?.policies).toEqual([mockPolicy])
    })
  })

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network error")
      ;(networkError as any).code = "ECONNREFUSED"

      mockClient.searchCompanies.mockRejectedValueOnce(networkError)

      await expect(service.searchCustomer({ searchTerm: "test@example.com", searchType: "email" })).rejects.toThrow("Network error")
    })

    it("should handle rate limit errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded")
      ;(rateLimitError as any).response = { status: 429 }

      mockClient.searchCompanies.mockRejectedValueOnce(rateLimitError)

      await expect(service.searchCustomer({ searchTerm: "test@example.com", searchType: "email" })).rejects.toThrow("Rate limit exceeded")
    })
  })
})