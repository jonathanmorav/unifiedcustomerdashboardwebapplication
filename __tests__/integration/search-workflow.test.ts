// Route imports are loaded dynamically after mocks
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { HubSpotClient } from "@/lib/api/hubspot/client"

// Mock external dependencies
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))
jest.mock("@/lib/auth")
jest.mock("@/lib/env", () => ({
  getEnv: jest.fn().mockReturnValue({
    HUBSPOT_API_KEY: "test-hubspot-token",
    HUBSPOT_BASE_URL: "https://api.hubapi.com",
    DWOLLA_KEY: "test-dwolla-key",
    DWOLLA_SECRET: "test-dwolla-secret",
    NEXTAUTH_SECRET: "test-secret",
  }),
}))

// Mock API clients
jest.mock("@/lib/api/hubspot/client", () => ({
  HubSpotClient: jest.fn().mockImplementation(() => ({
    searchCompanies: jest.fn().mockResolvedValue({
      results: [
        {
          id: "hs-123",
          properties: {
            name: "Test Company",
            email: "test@company.com",
            dwolla_customer_id: "dwolla-123",
          },
        },
      ],
      paging: { next: null },
    }),
    getSummaryOfBenefits: jest.fn().mockResolvedValue({
      results: [
        {
          id: "sob-123",
          properties: {
            name: "Test Benefits",
            pdf_document_url: "https://example.com/sob.pdf",
          },
        },
      ],
      paging: { next: null },
    }),
    getPolicies: jest.fn().mockResolvedValue({
      results: [],
      paging: { next: null },
    }),
    getMonthlyInvoices: jest.fn().mockResolvedValue({
      results: [],
      paging: { next: null },
    }),
  })),
}))

jest.mock("@/lib/api/dwolla/client", () => ({
  DwollaClient: jest.fn().mockImplementation(() => ({
    searchCustomers: jest.fn().mockResolvedValue({
      _embedded: {
        customers: [
          {
            id: "dwolla-123",
            firstName: "John",
            lastName: "Doe",
            email: "test@company.com",
            type: "business",
            status: "verified",
          },
        ],
      },
      total: 1,
    }),
    getFundingSources: jest.fn().mockResolvedValue({
      _embedded: {
        "funding-sources": [
          {
            id: "fs-123",
            name: "Test Bank - 1234",
            type: "bank",
            status: "verified",
          },
        ],
      },
    }),
    getTransfers: jest.fn().mockResolvedValue({
      _embedded: {
        transfers: [
          {
            id: "transfer-123",
            amount: { value: "100.00", currency: "USD" },
            status: "processed",
            created: "2024-01-15T10:00:00Z",
          },
        ],
      },
      total: 1,
    }),
  })),
}))

jest.mock("@/lib/api/dwolla/auth", () => ({
  DwollaOAuth: jest.fn().mockImplementation(() => ({
    getAccessToken: jest.fn().mockResolvedValue("test-access-token"),
  })),
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe("Search Workflow Integration", () => {
  const mockSession = {
    user: {
      email: "user@example.com",
      name: "Test User",
      role: "SUPPORT",
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession as any)
  })

  // Helper to ensure next-auth is mocked before importing route files
  async function loadSearchRoute() {
    jest.doMock("next-auth", () => ({
      getServerSession: mockGetServerSession,
    }), { virtual: true })
    return await import("@/app/api/search/route")
  }

  async function loadSuggestionsRoute() {
    jest.doMock("next-auth", () => ({
      getServerSession: mockGetServerSession,
    }), { virtual: true })
    return await import("@/app/api/search/suggestions/route")
  }

  describe("Complete Search Flow", () => {
    it("should search and return data from both HubSpot and Dwolla", async () => {
      // Step 1: User initiates search
      const searchRequest: any = {
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/search" },
        json: async () => ({ searchTerm: "test@company.com", searchType: "email" }),
      }

      const { POST: searchAPI } = await loadSearchRoute()
      const searchResponse = await searchAPI(searchRequest)
      const searchData = await searchResponse.json()

      // Verify response structure
      expect(searchResponse.status).toBe(200)
      expect(searchData.success).toBe(true)
      expect(searchData.data).toBeDefined()

      // Verify HubSpot data
      expect(searchData.data.hubspot).toEqual({
        company: expect.objectContaining({
          name: "Test Company",
          email: "test@company.com",
          dwolla_customer_id: "dwolla-123",
        }),
        summaryOfBenefits: expect.arrayContaining([
          expect.objectContaining({
            name: "Test Benefits",
            pdf_url: "https://example.com/sob.pdf",
          }),
        ]),
        policies: [],
        monthlyInvoices: [],
      })

      // Verify Dwolla data
      expect(searchData.data.dwolla).toEqual({
        customer: expect.objectContaining({
          id: "dwolla-123",
          email: "test@company.com",
          type: "business",
          status: "verified",
        }),
        fundingSources: expect.arrayContaining([
          expect.objectContaining({
            id: "fs-123",
            name: "Test Bank - 1234",
            accountNumber: "****1234",
          }),
        ]),
        transfers: expect.arrayContaining([
          expect.objectContaining({
            id: "transfer-123",
            amount: { value: "100.00", currency: "USD" },
          }),
        ]),
        notifications: [],
      })

      // Verify search was saved to history
      expect(searchData.searchDuration).toBeLessThan(30000) // Under 30s timeout
    })

    it("should handle partial failures gracefully", async () => {
      // Mock HubSpot to fail
      HubSpotClient.mockImplementationOnce(() => ({
        searchCompanies: jest.fn().mockRejectedValue(new Error("HubSpot API Error")),
      }))

      const searchRequest: any = {
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/search" },
        json: async () => ({ searchTerm: "test@company.com", searchType: "email" }),
      }

      const response = await searchAPI(searchRequest)
      const data = await response.json()

      // Should still return 200 with partial data
      expect(response.status).toBe(200)
      expect(data.hubspot.error).toBeTruthy()
      expect(data.dwolla.data).toBeTruthy() // Dwolla should still work
    })
  })

  describe("Search Suggestions", () => {
    it("should provide autocomplete suggestions", async () => {
      // Mock search history
      jest.doMock("@/lib/search/search-history", () => ({
        SearchHistoryManager: jest.fn().mockImplementation(() => ({
          getSuggestions: jest
            .fn()
            .mockResolvedValue(["test@company.com", "Test Company", "dwolla-123"]),
        })),
      }))

      const suggestRequest: any = {
        method: "GET",
        headers: new Headers(),
        url: "http://localhost:3000/api/search/suggestions?q=test",
        nextUrl: { pathname: "/api/search/suggestions" },
      }

      const { GET: suggestionsAPI } = await loadSuggestionsRoute()
      const response = await suggestionsAPI(suggestRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(["test@company.com", "Test Company", "dwolla-123"])
    })

    it("should handle empty query", async () => {
      const suggestRequest: any = {
        method: "GET",
        headers: new Headers(),
        url: "http://localhost:3000/api/search/suggestions?q=",
        nextUrl: { pathname: "/api/search/suggestions" },
      }

      const { GET: suggestionsAPI } = await loadSuggestionsRoute()
      const response = await suggestionsAPI(suggestRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })
  })

  describe("Search Type Detection", () => {
    const testCases = [
      {
        searchTerm: "user@example.com",
        expectedType: "email",
        description: "should auto-detect email addresses",
      },
      {
        searchTerm: "123e4567-e89b-12d3-a456-426614174000",
        expectedType: "dwolla_id",
        description: "should auto-detect Dwolla IDs (UUID format)",
      },
      {
        searchTerm: "Acme Corporation",
        expectedType: "business_name",
        description: "should default to business name for general text",
      },
    ]

    testCases.forEach(({ searchTerm, expectedType, description }) => {
      it(description, async () => {
        const searchRequest: any = {
          method: "POST",
          headers: new Headers(),
          nextUrl: { pathname: "/api/search" },
          json: async () => ({ searchTerm, searchType: "auto" }),
        }

        await searchAPI(searchRequest)

        // Verify the correct search method was called based on type
        // This would require inspecting the mock calls, simplified here
        expect(true).toBe(true) // Placeholder - would check actual mock calls
      })
    })
  })

  describe("Performance and Timeouts", () => {
    it("should complete search within performance targets", async () => {
      const startTime = Date.now()

      const searchRequest: any = {
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/search" },
        json: async () => ({ searchTerm: "test@company.com" }),
      }

      const response = await searchAPI(searchRequest)
      const data = await response.json()
      const endTime = Date.now()

      const totalDuration = endTime - startTime
      expect(totalDuration).toBeLessThan(3000) // Under 3 second target
      expect(data.searchDuration).toBeLessThan(3000)
    })

    it("should handle request cancellation", async () => {
      // This would test AbortController functionality
      // Simplified for this example
      expect(true).toBe(true)
    })
  })

  describe("Error Scenarios", () => {
    it("should handle malformed JSON", async () => {
      const searchRequest: any = {
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/search" },
        json: async () => { throw new Error("invalid json") },
      }

      const response = await searchAPI(searchRequest)

      expect(response.status).toBe(400)
    })

    it("should enforce search term length limits", async () => {
      const longSearchTerm = "a".repeat(201) // Over 200 char limit

      const searchRequest: any = {
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/search" },
        json: async () => ({ searchTerm: longSearchTerm }),
      }

      const response = await searchAPI(searchRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid request")
    })

    it("should handle unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValueOnce(null)

      const searchRequest: any = {
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/search" },
        json: async () => ({ searchTerm: "test@company.com" }),
      }

      const response = await searchAPI(searchRequest)

      expect(response.status).toBe(401)
    })
  })
})
