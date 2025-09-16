import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { getUnifiedSearchEngine } from "@/lib/search/unified-search"
import { SearchHistoryManager } from "@/lib/search/search-history"

// Mock dependencies
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))
jest.mock("@/lib/auth")
jest.mock("@/lib/search/unified-search")
jest.mock("@/lib/search/search-history")
jest.mock("@/lib/search/mock-data", () => ({
  mockSearchResult: {
    searchTerm: "demo@example.com",
    searchType: "auto",
    timestamp: new Date(),
    duration: 10,
    hubspot: { success: true, duration: 5, data: {} as any },
    dwolla: { success: true, duration: 5, data: {} as any },
  },
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockGetUnifiedSearchEngine = getUnifiedSearchEngine as jest.MockedFunction<
  typeof getUnifiedSearchEngine
>
const mockSearchHistoryManager = SearchHistoryManager as jest.MockedClass<
  typeof SearchHistoryManager
>

// Helper to load route after mocks are applied
async function loadRoute() {
  // Ensure next-auth is mocked before importing route
  jest.doMock("next-auth", () => ({
    getServerSession: mockGetServerSession,
  }), { virtual: true })
  return await import("@/app/api/search/route")
}

describe("POST /api/search", () => {
  let mockSearchEngine: any
  let mockRequest: NextRequest

  function createMockRequest(url: string, method: string, body?: any) {
    return {
      method,
      headers: new Headers(),
      url,
      nextUrl: { pathname: new URL(url).pathname },
      json: async () => body,
    } as any
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock search engine
    mockSearchEngine = {
      search: jest.fn().mockResolvedValue({
        hubspot: { success: true, duration: 5, data: { company: { name: "Test Company", id: "123" }, summaryOfBenefits: [], monthlyInvoices: [], activeLists: [] } },
        dwolla: { success: true, duration: 5, data: { customer: { id: "dwolla-123", email: "test@example.com" }, fundingSources: [], transfers: [], notifications: [] } },
        searchTerm: "",
        searchType: "email",
        timestamp: new Date(),
        duration: 10,
      }),
      formatForDisplay: jest.fn().mockImplementation((result: any) => ({
        summary: { found: true, foundIn: ["both"], searchType: result.searchType, duration: `${result.duration}ms` },
        hubspot: { company: result.hubspot.data.company, summaryOfBenefits: [], monthlyInvoices: [], activeLists: [] },
        dwolla: { customer: result.dwolla.data.customer, fundingSources: [], transfers: [], notificationCount: 0, notifications: [] },
      })),
    }
    mockGetUnifiedSearchEngine.mockReturnValue(mockSearchEngine)

    // Setup mock session
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com", name: "Test User" },
    } as any)

    // Mock environment variables
    process.env.DEMO_MODE = "false"
    process.env.HUBSPOT_API_KEY = "test-token"
  })

  it("should return 401 if user is not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null)

    mockRequest = createMockRequest("http://localhost:3000/api/search", "POST", { searchTerm: "test@example.com" })

    const { POST } = await loadRoute()
    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(typeof data.error).toBe("string")
  })

  it("should return 400 for invalid request body", async () => {
    mockRequest = createMockRequest("http://localhost:3000/api/search", "POST", { searchTerm: "" })

    const { POST } = await loadRoute()
    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe("VALIDATION_ERROR")
    expect(data.errors).toBeDefined()
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

    mockRequest = createMockRequest("http://localhost:3000/api/search", "POST", { searchTerm: "test@example.com", searchType: "email" })

    const { POST } = await loadRoute()
    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.summary).toBeDefined()
    expect(data.data.hubspot.company).toEqual(expect.objectContaining({ name: "Test Company" }))
    expect(data.data.dwolla.customer).toEqual(expect.objectContaining({ id: "dwolla-123" }))
    expect(mockSearchEngine.search).toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: "test@example.com", searchType: "email" })
    )
  })

  it("should handle search errors gracefully", async () => {
    mockSearchEngine.search.mockRejectedValueOnce(new Error("Search failed"))

    mockRequest = createMockRequest("http://localhost:3000/api/search", "POST", { searchTerm: "test@example.com" })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(typeof data.error).toBe("string")
  })

  it("should auto-detect search type when not specified", async () => {
    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    const { POST } = await loadRoute()
    await POST(mockRequest)

    expect(mockSearchEngine.search).toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: "test@example.com", searchType: "auto" })
    )
  })

  it("should save search to history", async () => {
    const saveSearchSpy = jest.spyOn(SearchHistoryManager, "saveSearch").mockResolvedValue({} as any)

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    })

    const { POST } = await loadRoute()
    await POST(mockRequest)

    expect(saveSearchSpy).toHaveBeenCalled()
    // userId should be the session user email
    const lastCallArgs = (saveSearchSpy as jest.Mock).mock.calls.pop()
    expect(lastCallArgs[1]).toBe("test@example.com")
  })

  it("should handle demo mode correctly", async () => {
    process.env.DEMO_MODE = "true"
    const { mockSearchResult } = await import("@/lib/search/mock-data")

    mockRequest = createMockRequest("http://localhost:3000/api/search", "POST", { searchTerm: "demo@example.com" })

    const { POST } = await loadRoute()
    const response = await POST(mockRequest)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockSearchEngine.search).not.toHaveBeenCalled()
  })

  it("should respect search timeout", async () => {
    // Create a search that takes longer than timeout
    mockSearchEngine.search.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 35000))
    )

    mockRequest = createMockRequest("http://localhost:3000/api/search", "POST", { searchTerm: "test@example.com" })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(typeof data.error).toBe("string")
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

    const mockRequest = createMockRequest("http://localhost:3000/api/search", "GET")
    const { GET } = await loadRoute()
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
      .spyOn(SearchHistoryManager, "getHistory")
      .mockReturnValue(mockHistory as any)

    const mockRequest = createMockRequest("http://localhost:3000/api/search", "GET")
    const { GET } = await loadRoute()
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockHistory)
    expect(getHistorySpy).toHaveBeenCalledWith({ userId: "test@example.com", searchType: undefined, limit: 20 })
  })

  it("should handle errors when fetching history", async () => {
    jest
      .spyOn(SearchHistoryManager, "getHistory")
      .mockImplementation(() => { throw new Error("Database error") })

    const mockRequest = createMockRequest("http://localhost:3000/api/search", "GET")
    const { GET } = await loadRoute()
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(typeof data.error).toBe("string")
  })

  it("should return empty array when no history exists", async () => {
    jest.spyOn(SearchHistoryManager, "getHistory").mockReturnValueOnce([] as any)

    const mockRequest = new NextRequest("http://localhost:3000/api/search")
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual([])
  })
})
