import { DwollaService } from "@/lib/api/dwolla/service"
import { DwollaClient } from "@/lib/api/dwolla/client"
import { DwollaOAuth } from "@/lib/api/dwolla/auth"
import {
  DwollaCustomer,
  DwollaFundingSource,
  DwollaTransfer,
  DwollaSearchParams,
  DwollaServiceResult,
} from "@/lib/types/dwolla"

// Mock dependencies
jest.mock("@/lib/api/dwolla/client", () => ({
  DwollaClient: jest.fn().mockImplementation(() => ({
    searchCustomers: jest.fn(),
    getCustomer: jest.fn(),
    getCustomerByDwollaId: jest.fn(),
    getFundingSources: jest.fn(),
    getTransfers: jest.fn(),
    getCustomerFundingSources: jest.fn(),
    getCustomerTransfers: jest.fn(),
    getCustomerNotifications: jest.fn(),
  })),
}))

jest.mock("@/lib/api/dwolla/auth", () => ({
  DwollaOAuth: jest.fn().mockImplementation(() => ({
    getAccessToken: jest.fn().mockResolvedValue("test-access-token"),
  })),
}))

describe("DwollaService", () => {
  let service: DwollaService
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Create service - it will use the mocked dependencies
    service = new DwollaService()

    // Get reference to the mocked client
    mockClient = (service as any).client
  })

  describe("searchCustomer", () => {
    const mockCustomer: DwollaCustomer = {
      id: "dwolla-123",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      type: "business",
      status: "verified",
      created: "2024-01-01T00:00:00Z",
      businessName: "Test Business",
      controller: {
        firstName: "Jane",
        lastName: "Doe",
        title: "CEO",
        dateOfBirth: "1990-01-01",
        ssn: "****",
        address: {
          address1: "123 Main St",
          city: "Austin",
          stateProvinceRegion: "TX",
          postalCode: "78701",
          country: "US",
        },
      },
    }

    it("should search customer by email", async () => {
      mockClient.searchCustomers.mockResolvedValueOnce([mockCustomer])
      mockClient.getCustomerFundingSources.mockResolvedValueOnce([])
      mockClient.getCustomerTransfers.mockResolvedValueOnce([])
      mockClient.getCustomerNotifications.mockResolvedValueOnce([])

      const params: DwollaSearchParams = { searchTerm: "john@example.com", searchType: "email" }
      const result = await service.searchCustomer(params)

      expect(result).toEqual({
        customer: {
          id: mockCustomer.id,
          email: mockCustomer.email,
          name: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
          businessName: mockCustomer.businessName,
          type: mockCustomer.type,
          created: mockCustomer.created,
        },
        fundingSources: [],
        transfers: [],
        notifications: [],
        notificationCount: 0,
      })

      expect(mockClient.searchCustomers).toHaveBeenCalledWith({ email: "john@example.com", limit: 1 }, undefined)
    })

    it("should search customer by dwolla ID", async () => {
      mockClient.getCustomerByDwollaId.mockResolvedValueOnce(mockCustomer)
      mockClient.getCustomerFundingSources.mockResolvedValueOnce([])
      mockClient.getCustomerTransfers.mockResolvedValueOnce([])
      mockClient.getCustomerNotifications.mockResolvedValueOnce([])

      const params: DwollaSearchParams = { searchTerm: "dwolla-123", searchType: "dwolla_id" }
      const result = await service.searchCustomer(params)

      expect(result?.customer).toEqual({
        id: mockCustomer.id,
        email: mockCustomer.email,
        name: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
        businessName: mockCustomer.businessName,
        type: mockCustomer.type,
        created: mockCustomer.created,
      })
      expect(mockClient.getCustomerByDwollaId).toHaveBeenCalledWith("dwolla-123", undefined)
    })

    it("should search customer by name", async () => {
      mockClient.searchCustomers.mockResolvedValueOnce([mockCustomer])
      mockClient.getCustomerFundingSources.mockResolvedValueOnce([])
      mockClient.getCustomerTransfers.mockResolvedValueOnce([])
      mockClient.getCustomerNotifications.mockResolvedValueOnce([])

      const params: DwollaSearchParams = { searchTerm: "John Doe", searchType: "name" }
      const result = await service.searchCustomer(params)

      expect(result?.customer).toEqual({
        id: mockCustomer.id,
        email: mockCustomer.email,
        name: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
        businessName: mockCustomer.businessName,
        type: mockCustomer.type,
        created: mockCustomer.created,
      })
      expect(mockClient.searchCustomers).toHaveBeenCalledWith({ limit: 25, offset: 0 }, undefined)
    })

    it("should handle customer not found", async () => {
      mockClient.searchCustomers.mockResolvedValueOnce([])

      const result = await service.searchCustomer({ searchTerm: "notfound@example.com", searchType: "email" })

      expect(result).toBeNull()
    })

    it("should handle API errors", async () => {
      mockClient.searchCustomers.mockRejectedValueOnce(new Error("API Error"))

      await expect(
        service.searchCustomer({ searchTerm: "test@example.com", searchType: "email" })
      ).rejects.toThrow("API Error")
    })

    it("should support abort signal", async () => {
      const abortController = new AbortController()
      mockClient.searchCustomers.mockResolvedValueOnce({
        _embedded: { customers: [mockCustomer] },
        total: 1,
      })

      await service.searchCustomer({ email: "test@example.com" }, abortController.signal)

      expect(mockClient.searchCustomers).toHaveBeenCalledWith(
        "test@example.com",
        abortController.signal
      )
    })
  })

  describe("getFundingSources", () => {
    const mockFundingSource: DwollaFundingSource = {
      id: "fs-123",
      status: "verified",
      type: "bank",
      bankAccountType: "checking",
      name: "Test Bank Account",
      created: "2024-01-01T00:00:00Z",
      removed: false,
      channels: ["ach"],
      bankName: "Test Bank",
      fingerprint: "abc123",
    }

    it("should get funding sources with masked account numbers", async () => {
      mockClient.getFundingSources.mockResolvedValueOnce({
        _embedded: {
          "funding-sources": [
            {
              ...mockFundingSource,
              name: "Test Bank Account - 1234",
            },
          ],
        },
      })

      const result = await service.getFundingSources("dwolla-123")

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        ...mockFundingSource,
        name: "Test Bank Account - 1234",
        accountNumber: "****1234", // Masked account number
      })
    })

    it("should handle funding sources without account numbers", async () => {
      mockClient.getFundingSources.mockResolvedValueOnce({
        _embedded: {
          "funding-sources": [
            {
              ...mockFundingSource,
              name: "Balance",
            },
          ],
        },
      })

      const result = await service.getFundingSources("dwolla-123")

      expect(result[0].accountNumber).toBeUndefined()
    })

    it("should handle empty funding sources", async () => {
      mockClient.getFundingSources.mockResolvedValueOnce({
        _embedded: { "funding-sources": [] },
      })

      const result = await service.getFundingSources("dwolla-123")

      expect(result).toEqual([])
    })

    it("should handle API errors", async () => {
      mockClient.getFundingSources.mockRejectedValueOnce(new Error("API Error"))

      const result = await service.getFundingSources("dwolla-123")

      expect(result).toEqual([])
    })
  })

  describe("getTransfers", () => {
    const mockTransfer: DwollaTransfer = {
      id: "transfer-123",
      status: "processed",
      amount: {
        value: "100.00",
        currency: "USD",
      },
      created: "2024-01-15T10:00:00Z",
      source: {
        type: "funding-source",
        id: "fs-source-123",
      },
      destination: {
        type: "funding-source",
        id: "fs-dest-123",
      },
      sourceAccount: "Test Source Account",
      destinationAccount: "Test Destination Account",
      clearing: {
        source: "standard",
        destination: "next-available",
      },
      correlationId: "order-123",
    }

    it("should get transfers with formatted data", async () => {
      mockClient.getTransfers.mockResolvedValueOnce({
        _embedded: { transfers: [mockTransfer] },
        total: 1,
      })

      const result = await service.getTransfers("dwolla-123", 10)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockTransfer)
      expect(mockClient.getTransfers).toHaveBeenCalledWith("dwolla-123", 10, undefined)
    })

    it("should use default limit of 25", async () => {
      mockClient.getTransfers.mockResolvedValueOnce({
        _embedded: { transfers: [] },
        total: 0,
      })

      await service.getTransfers("dwolla-123")

      expect(mockClient.getTransfers).toHaveBeenCalledWith("dwolla-123", 25, undefined)
    })

    it("should handle empty transfers", async () => {
      mockClient.getTransfers.mockResolvedValueOnce({
        _embedded: { transfers: [] },
        total: 0,
      })

      const result = await service.getTransfers("dwolla-123")

      expect(result).toEqual([])
    })

    it("should handle API errors", async () => {
      mockClient.getTransfers.mockRejectedValueOnce(new Error("API Error"))

      const result = await service.getTransfers("dwolla-123")

      expect(result).toEqual([])
    })
  })

  describe("getNotifications", () => {
    it("should return placeholder notifications", async () => {
      const result = await service.getNotifications("dwolla-123")

      expect(result).toEqual([])
    })
  })

  describe("error handling", () => {
    it("should handle OAuth token refresh errors", async () => {
      mockAuth.getAccessToken.mockRejectedValueOnce(new Error("Token refresh failed"))
      mockClient.searchCustomers.mockRejectedValueOnce(new Error("Unauthorized"))

      const result = await service.searchCustomer({ email: "test@example.com" })

      expect(result.error?.code).toBe("DWOLLA_API_ERROR")
      expect(result.error?.message).toBe("Failed to search customer")
    })

    it("should handle rate limit errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded")
      ;(rateLimitError as any).response = {
        status: 429,
        headers: { "x-rate-limit-reset": "1234567890" },
      }

      mockClient.searchCustomers.mockRejectedValueOnce(rateLimitError)

      const result = await service.searchCustomer({ email: "test@example.com" })

      expect(result.error?.code).toBe("DWOLLA_API_ERROR")
    })

    it("should handle network timeouts", async () => {
      const timeoutError = new Error("Request timeout")
      ;(timeoutError as any).code = "ECONNABORTED"

      mockClient.searchCustomers.mockRejectedValueOnce(timeoutError)

      const result = await service.searchCustomer({ email: "test@example.com" })

      expect(result.error?.code).toBe("DWOLLA_API_ERROR")
    })
  })

  describe("data masking", () => {
    it("should mask SSN in customer data", async () => {
      const customerWithSSN = {
        ...mockCustomer,
        ssn: "123-45-6789",
      }

      mockClient.searchCustomers.mockResolvedValueOnce({
        _embedded: { customers: [customerWithSSN] },
        total: 1,
      })

      const result = await service.searchCustomer({ email: "test@example.com" })

      // Service should not expose full SSN
      expect(result.data?.customer.ssn).toBeUndefined()
    })

    it("should extract last 4 digits from bank name", async () => {
      mockClient.getFundingSources.mockResolvedValueOnce({
        _embedded: {
          "funding-sources": [
            {
              id: "fs-123",
              name: "Chase Checking - 9876",
              type: "bank",
              status: "verified",
            },
          ],
        },
      })

      const result = await service.getFundingSources("dwolla-123")

      expect(result[0].accountNumber).toBe("****9876")
    })
  })
})
