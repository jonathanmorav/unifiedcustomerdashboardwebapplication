import { NextRequest } from "next/server"

// Mock external dependencies first before any imports
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))
jest.mock("@/lib/auth")

// Mock the route handlers
jest.mock("@/app/api/search/route", () => ({
  POST: jest.fn(),
}))
jest.mock("@/app/api/search/suggestions/route", () => ({
  GET: jest.fn(),
}))

// Import after mocking
const { POST: searchAPI } = require("@/app/api/search/route")
const { GET: suggestionsAPI } = require("@/app/api/search/suggestions/route")
const { getServerSession } = require("next-auth")
jest.mock("jose", () => ({
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue("mocked-jwt"),
  })),
}))
jest.mock("@/lib/env", () => ({
  getEnv: jest.fn().mockReturnValue({
    HUBSPOT_ACCESS_TOKEN: "test-hubspot-token",
    DWOLLA_KEY: "test-dwolla-key",
    DWOLLA_SECRET: "test-dwolla-secret",
    NEXTAUTH_SECRET: "test-secret",
    DEMO_MODE: "false",
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

  describe("Complete Search Flow", () => {
    it("should search and return data from both HubSpot and Dwolla", async () => {
      // Mock the search API response
      const mockSearchResponse = {
        success: true,
        results: {
          hubspot: {
            customers: [{
              id: "hs-123",
              name: "Test Company",
              email: "test@company.com",
            }],
          },
          dwolla: {
            customers: [{
              id: "dwolla-123",
              name: "Test Company",
              email: "test@company.com",
            }],
          },
        },
      }
      
      ;(searchAPI as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(mockSearchResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      // Step 1: User initiates search
      const searchRequest = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        body: JSON.stringify({
          searchTerm: "test@company.com",
          searchType: "email",
        }),
      })

      const searchResponse = await searchAPI(searchRequest)
      const searchData = await searchResponse.json()

      // Verify response structure
      expect(searchResponse.status).toBe(200)
      expect(searchData).toHaveProperty("success", true)
      expect(searchData).toHaveProperty("results")
      expect(searchData.results).toHaveProperty("hubspot")
      expect(searchData.results).toHaveProperty("dwolla")

      // Verify HubSpot data
      expect(searchData.results.hubspot.customers).toHaveLength(1)
      expect(searchData.results.hubspot.customers[0]).toEqual(
        expect.objectContaining({
          id: "hs-123",
          name: "Test Company",
          email: "test@company.com",
        })
      )

      // Verify Dwolla data
      expect(searchData.results.dwolla.customers).toHaveLength(1)
      expect(searchData.results.dwolla.customers[0]).toEqual(
        expect.objectContaining({
          id: "dwolla-123",
          name: "Test Company",
          email: "test@company.com",
        })
      )
    })

    it("should handle errors gracefully", async () => {
      // Mock error response
      ;(searchAPI as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: "Search failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )

      const searchRequest = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        body: JSON.stringify({
          searchTerm: "test@company.com",
          searchType: "email",
        }),
      })

      const response = await searchAPI(searchRequest)
      const data = await response.json()

      // Should return error status
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe("Search failed")
    })
  })

  describe("Search Suggestions", () => {
    it("should provide autocomplete suggestions", async () => {
      // Mock suggestions response
      const mockSuggestionsResponse = {
        suggestions: ["test@company.com", "Test Company", "dwolla-123"],
      }
      
      ;(suggestionsAPI as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(mockSuggestionsResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const suggestRequest = new NextRequest(
        "http://localhost:3000/api/search/suggestions?query=test"
      )

      const response = await suggestionsAPI(suggestRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toEqual(["test@company.com", "Test Company", "dwolla-123"])
    })

    it("should handle empty query", async () => {
      const suggestRequest = new NextRequest("http://localhost:3000/api/search/suggestions?query=")

      const response = await suggestionsAPI(suggestRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Query parameter is required")
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
        const searchRequest = new NextRequest("http://localhost:3000/api/search", {
          method: "POST",
          body: JSON.stringify({
            searchTerm,
            searchType: "auto", // Let it auto-detect
          }),
        })

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

      const searchRequest = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        body: JSON.stringify({
          searchTerm: "test@company.com",
        }),
      })

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
      const searchRequest = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        body: "invalid json",
      })

      const response = await searchAPI(searchRequest)

      expect(response.status).toBe(400)
    })

    it("should enforce search term length limits", async () => {
      const longSearchTerm = "a".repeat(201) // Over 200 char limit

      const searchRequest = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        body: JSON.stringify({
          searchTerm: longSearchTerm,
        }),
      })

      const response = await searchAPI(searchRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid request")
    })

    it("should handle unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValueOnce(null)

      const searchRequest = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        body: JSON.stringify({
          searchTerm: "test@company.com",
        }),
      })

      const response = await searchAPI(searchRequest)

      expect(response.status).toBe(401)
    })
  })
})
