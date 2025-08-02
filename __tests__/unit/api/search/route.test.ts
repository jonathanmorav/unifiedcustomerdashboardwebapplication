// Mock all dependencies before imports
jest.mock("jose", () => ({}))
jest.mock("next-auth", () => ({
  getServerSession: jest.fn()
}))
jest.mock("@/lib/auth", () => ({
  authOptions: {}
}))
jest.mock("@/lib/logger", () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))
jest.mock("@/lib/search/unified-search", () => ({
  getUnifiedSearchEngine: jest.fn()
}))
jest.mock("@/lib/search/search-history", () => ({
  SearchHistoryManager: jest.fn().mockImplementation(() => ({
    saveSearch: jest.fn()
  }))
}))
jest.mock("@/lib/search/mock-data", () => ({
  mockSearchResult: jest.fn().mockResolvedValue({
    hubspot: { data: [], error: null },
    dwolla: { data: [], error: null },
  }),
}))
jest.mock("@/lib/middleware/error-handler", () => ({
  withErrorHandler: (handler: any) => handler
}))
jest.mock("@/lib/security/correlation", () => ({
  CorrelationTracking: {
    getCorrelationId: jest.fn().mockResolvedValue("test-correlation-id")
  }
}))
jest.mock("@/lib/errors", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  ValidationError: class ValidationError extends Error {},
  SystemError: class SystemError extends Error {}
}))

import { NextRequest } from "next/server"
import { POST, GET } from "@/app/api/search/route"
import { getServerSession } from "next-auth"
import { getUnifiedSearchEngine } from "@/lib/search/unified-search"
import { SearchHistoryManager } from "@/lib/search/search-history"
jest.mock("next-auth", () => ({
  getServerSession: jest.fn()
}))
jest.mock("@/lib/auth", () => ({
  authOptions: {}
}))
jest.mock("@/lib/logger", () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))
jest.mock("@/lib/search/unified-search", () => ({
  getUnifiedSearchEngine: jest.fn()
}))
jest.mock("@/lib/search/search-history", () => ({
  SearchHistoryManager: jest.fn().mockImplementation(() => ({
    saveSearch: jest.fn()
  }))
}))
jest.mock("@/lib/search/mock-data", () => ({
  mockSearchResult: jest.fn().mockResolvedValue({
    hubspot: { data: [], error: null },
    dwolla: { data: [], error: null },
  }),
}))
jest.mock("@/lib/middleware/error-handler", () => ({
  withErrorHandler: (handler: any) => handler
}))
jest.mock("@/lib/security/correlation", () => ({
  CorrelationTracking: {
    getCorrelationId: jest.fn().mockResolvedValue("test-correlation-id")
  }
}))
jest.mock("@/lib/errors", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  ValidationError: class ValidationError extends Error {},
  SystemError: class SystemError extends Error {}
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockGetUnifiedSearchEngine = getUnifiedSearchEngine as jest.MockedFunction<
  typeof getUnifiedSearchEngine
>
const mockSearchHistoryManager = SearchHistoryManager as jest.MockedClass<
  typeof SearchHistoryManager
>

describe("POST /api/search", () => {
  let mockSearchEngine: any
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock search engine
    mockSearchEngine = {
      search: jest.fn().mockResolvedValue({
        hubspot: { data: [], error: null },
        dwolla: { data: [], error: null },
      }),
    }
    mockGetUnifiedSearchEngine.mockReturnValue(mockSearchEngine)

    // Setup mock session
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com", name: "Test User" },
    } as any)

    // Mock environment variables
    process.env.DEMO_MODE = "false"
    process.env.HUBSPOT_ACCESS_TOKEN = "test-token"
  })

  it("should return 401 if user is not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null)

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("should return 400 for invalid request body", async () => {
    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "" }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Invalid request")
    expect(data.details).toBeDefined()
  })

  it("should successfully search with valid email", async () => {
    const mockResults = {
      hubspot: {
        data: {
          company: { name: "Test Company", id: "123" },
          summaryOfBenefits: [],
          policies: [],
          monthlyInvoices: [],
        },
        error: null,
      },
      dwolla: {
        data: {
          customer: { id: "dwolla-123", email: "test@example.com" },
          fundingSources: [],
          transfers: [],
          notifications: [],
        },
        error: null,
      },
    }

    mockSearchEngine.search.mockResolvedValueOnce(mockResults)

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({
        searchTerm: "test@example.com",
        searchType: "email",
      }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hubspot).toEqual(mockResults.hubspot)
    expect(data.dwolla).toEqual(mockResults.dwolla)
    expect(mockSearchEngine.search).toHaveBeenCalledWith(
      "test@example.com",
      "email",
      expect.any(AbortSignal)
    )
  })

  it("should handle search errors gracefully", async () => {
    mockSearchEngine.search.mockRejectedValueOnce(new Error("Search failed"))

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain("search failed")
  })

  it("should auto-detect search type when not specified", async () => {
    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    await POST(mockRequest)

    expect(mockSearchEngine.search).toHaveBeenCalledWith(
      "test@example.com",
      "auto",
      expect.any(AbortSignal)
    )
  })

  it("should save search to history", async () => {
    const saveSearchSpy = jest.spyOn(mockSearchHistoryManager.prototype, "saveSearch")

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    await POST(mockRequest)

    expect(saveSearchSpy).toHaveBeenCalledWith({
      searchTerm: "test@example.com",
      searchType: "auto",
      userId: "test@example.com",
      timestamp: expect.any(Date),
    })
  })

  it("should handle demo mode correctly", async () => {
    process.env.DEMO_MODE = "true"
    const { mockSearchResult } = await import("@/lib/search/mock-data")

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "demo@example.com" }),
    })

    await POST(mockRequest)

    expect(mockSearchResult).toHaveBeenCalledWith("demo@example.com", "auto")
    expect(mockSearchEngine.search).not.toHaveBeenCalled()
  })

  it("should respect search timeout", async () => {
    // Create a search that takes longer than timeout
    mockSearchEngine.search.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 35000))
    )

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain("search failed")
  })
})

describe("GET /api/search", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com", name: "Test User" },
    } as any)
  })

  it("should return 401 if user is not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null)

    const mockRequest = new NextRequest("http://localhost:3000/api/search")
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("should return user search history", async () => {
    const mockHistory = [
      {
        searchTerm: "test@example.com",
        searchType: "email",
        timestamp: new Date().toISOString(),
      },
      {
        searchTerm: "Test Company",
        searchType: "business_name",
        timestamp: new Date().toISOString(),
      },
    ]

    const getHistorySpy = jest
      .spyOn(mockSearchHistoryManager.prototype, "getHistory")
      .mockResolvedValue(mockHistory)

    const mockRequest = new NextRequest("http://localhost:3000/api/search")
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.history).toEqual(mockHistory)
    expect(getHistorySpy).toHaveBeenCalledWith("test@example.com")
  })

  it("should handle errors when fetching history", async () => {
    jest
      .spyOn(mockSearchHistoryManager.prototype, "getHistory")
      .mockRejectedValueOnce(new Error("Database error"))

    const mockRequest = new NextRequest("http://localhost:3000/api/search")
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Failed to fetch search history")
  })

  it("should return empty array when no history exists", async () => {
    jest.spyOn(mockSearchHistoryManager.prototype, "getHistory").mockResolvedValueOnce([])

    const mockRequest = new NextRequest("http://localhost:3000/api/search")
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.history).toEqual([])
  })
})
