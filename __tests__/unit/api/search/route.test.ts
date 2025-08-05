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
  SearchHistoryManager: {
    saveSearch: jest.fn().mockResolvedValue(undefined),
    getHistory: jest.fn().mockReturnValue([])
  }
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

// Mock NextRequest and NextResponse
jest.mock("next/server", () => {
  // Create a mock NextRequest class inside the mock factory
  class MockNextRequest {
    private _url: string
    private _method: string
    private _body: any
    private _headers: Map<string, string>

    constructor(url: string, init?: RequestInit) {
      this._url = url
      this._method = init?.method || "GET"
      this._headers = new Map()
      this._body = init?.body
      
      if (init?.headers) {
        const headers = init.headers as any
        if (headers instanceof Map) {
          headers.forEach((value: string, key: string) => {
            this._headers.set(key, value)
          })
        } else if (typeof headers === 'object') {
          Object.entries(headers).forEach(([key, value]) => {
            this._headers.set(key, value as string)
          })
        }
      }
    }

    get url() {
      return this._url
    }

    get method() {
      return this._method
    }

    get headers() {
      return {
        get: (name: string) => this._headers.get(name),
        has: (name: string) => this._headers.has(name),
        set: (name: string, value: string) => this._headers.set(name, value),
        forEach: (callback: (value: string, key: string) => void) => {
          this._headers.forEach(callback)
        }
      }
    }

    async json() {
      if (typeof this._body === "string") {
        return JSON.parse(this._body)
      }
      return this._body
    }

    async text() {
      return this._body?.toString() || ""
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (data: any, init?: ResponseInit) => ({
        status: init?.status || 200,
        json: async () => data,
      }),
    },
  }
})

import { NextRequest } from "next/server"
import { POST, GET } from "@/app/api/search/route"
import { getServerSession } from "next-auth"
import { getUnifiedSearchEngine } from "@/lib/search/unified-search"
import { SearchHistoryManager } from "@/lib/search/search-history"

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockGetUnifiedSearchEngine = getUnifiedSearchEngine as jest.MockedFunction<
  typeof getUnifiedSearchEngine
>
const mockSearchHistoryManager = SearchHistoryManager as any

describe("POST /api/search", () => {
  let mockSearchEngine: any
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: jest.fn(() => "test-uuid-123")
      },
      writable: true
    })

    // Setup mock search engine
    mockSearchEngine = {
      search: jest.fn().mockResolvedValue({
        hubspot: { data: [], error: null },
        dwolla: { data: [], error: null },
      }),
      formatForDisplay: jest.fn((result) => result),
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
    }) as any

    await expect(POST(mockRequest)).rejects.toThrow("Authentication required")
  })

  it("should return 400 for invalid request body", async () => {
    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "" }),
    }) as any

    await expect(POST(mockRequest)).rejects.toThrow("Invalid search request")
  })

  it("should successfully search with valid email", async () => {
    const mockResults = {
      searchTerm: "test@example.com",
      searchType: "email",
      hubspot: {
        success: true,
        data: {
          company: { name: "Test Company", id: "123" },
          summaryOfBenefits: [],
          policies: [],
          monthlyInvoices: [],
        },
      },
      dwolla: {
        success: true,
        data: {
          customer: { id: "dwolla-123", email: "test@example.com" },
          fundingSources: [],
          transfers: [],
          notifications: [],
        },
      },
    }

    mockSearchEngine.search.mockResolvedValueOnce(mockResults)
    mockSearchEngine.formatForDisplay.mockReturnValueOnce(mockResults)

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({
        searchTerm: "test@example.com",
        searchType: "email",
      }),
    }) as any

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResults)
    expect(mockSearchEngine.search).toHaveBeenCalledWith({
      searchTerm: "test@example.com",
      searchType: "email",
      signal: expect.any(AbortSignal)
    })
  })

  it("should handle search errors gracefully", async () => {
    mockSearchEngine.search.mockRejectedValueOnce(new Error("Search failed"))

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    }) as any

    await expect(POST(mockRequest)).rejects.toThrow()
  })

  it("should auto-detect search type when not specified", async () => {
    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    }) as any

    await POST(mockRequest)

    expect(mockSearchEngine.search).toHaveBeenCalledWith({
      searchTerm: "test@example.com",
      searchType: "auto",
      signal: expect.any(AbortSignal)
    })
  })

  it("should save search to history", async () => {
    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    }) as any

    await POST(mockRequest)

    expect(mockSearchHistoryManager.saveSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        hubspot: expect.any(Object),
        dwolla: expect.any(Object),
      }),
      "test@example.com"
    )
  })

  it("should handle demo mode correctly", async () => {
    process.env.DEMO_MODE = "true"

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "demo@example.com" }),
    }) as any

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(mockSearchEngine.search).not.toHaveBeenCalled()
    expect(mockSearchEngine.formatForDisplay).toHaveBeenCalled()
  })

  it.skip("should respect search timeout", async () => {
    // Create a search that takes longer than timeout
    mockSearchEngine.search.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 35000))
    )

    mockRequest = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      body: JSON.stringify({ searchTerm: "test@example.com" }),
    }) as any

    // The promise should be rejected due to timeout
    const searchPromise = POST(mockRequest)
    
    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(35000)
    
    // Since the search takes too long, the request should complete but possibly with an error
    await expect(searchPromise).resolves.toBeDefined()
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

    const mockRequest = new NextRequest("http://localhost:3000/api/search") as any
    
    await expect(GET(mockRequest)).rejects.toThrow("Authentication required")
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

    mockSearchHistoryManager.getHistory.mockReturnValueOnce(mockHistory)

    const mockRequest = new NextRequest("http://localhost:3000/api/search") as any
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockHistory)
    expect(mockSearchHistoryManager.getHistory).toHaveBeenCalledWith({
      userId: "test@example.com",
      searchType: undefined,
      limit: 20
    })
  })

  it.skip("should handle errors when fetching history", async () => {
    mockSearchHistoryManager.getHistory.mockImplementationOnce(() => {
      throw new Error("Database error")
    })

    const mockRequest = new NextRequest("http://localhost:3000/api/search") as any
    
    await expect(GET(mockRequest)).rejects.toThrow()
  })

  it("should return empty array when no history exists", async () => {
    mockSearchHistoryManager.getHistory.mockReturnValueOnce([])

    const mockRequest = new NextRequest("http://localhost:3000/api/search") as any
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual([])
  })
})