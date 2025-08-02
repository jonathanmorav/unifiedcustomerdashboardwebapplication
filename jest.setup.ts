// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"
import { TextEncoder, TextDecoder } from "util"

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

// Polyfill setImmediate for winston
global.setImmediate =
  global.setImmediate || ((fn: any, ...args: any[]) => setTimeout(fn, 0, ...args))

// Mock Next.js Request/Response objects
global.Request = class Request {
  url: string
  method: string
  headers: Headers
  body: any

  constructor(input: string | Request, init?: RequestInit) {
    if (typeof input === "string") {
      this.url = input
    } else {
      this.url = input.url
    }
    this.method = init?.method || "GET"
    this.headers = new Headers(init?.headers)
    this.body = init?.body
  }

  async json() {
    if (typeof this.body === "string") {
      return JSON.parse(this.body)
    }
    return this.body
  }

  async text() {
    return this.body?.toString() || ""
  }
} as any

global.Response = class Response {
  body: any
  status: number
  statusText: string
  headers: Headers

  constructor(body?: any, init?: ResponseInit) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || "OK"
    this.headers = new Headers(init?.headers)
  }

  async json() {
    if (typeof this.body === "string") {
      return JSON.parse(this.body)
    }
    return this.body
  }

  async text() {
    return this.body?.toString() || ""
  }

  static json(data: any, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        ...init?.headers,
        "content-type": "application/json",
      },
    })
  }
} as any

global.Headers = class Headers {
  private headers: Map<string, string> = new Map()

  constructor(init?: HeadersInit) {
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.set(key, value))
      } else if (init instanceof Headers) {
        init.forEach((value, key) => this.set(key, value))
      } else {
        Object.entries(init).forEach(([key, value]) => this.set(key, value))
      }
    }
  }

  get(name: string) {
    return this.headers.get(name.toLowerCase())
  }

  set(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value)
  }

  has(name: string) {
    return this.headers.has(name.toLowerCase())
  }

  forEach(callback: (value: string, key: string) => void) {
    this.headers.forEach(callback)
  }
} as any

// Mock environment variables for all tests
process.env.NEXTAUTH_URL = "http://localhost:3000"
process.env.NEXTAUTH_SECRET = "test-secret-for-testing-only"
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
process.env.ALLOWED_EMAILS = "test@example.com,admin@example.com"
process.env.HUBSPOT_ACCESS_TOKEN = "test-hubspot-token"
process.env.HUBSPOT_BASE_URL = "https://api.hubapi.com"
process.env.DWOLLA_KEY = "test-dwolla-key"
process.env.DWOLLA_SECRET = "test-dwolla-secret"
process.env.DWOLLA_ENVIRONMENT = "sandbox"
process.env.DWOLLA_BASE_URL = "https://api-sandbox.dwolla.com"
// NODE_ENV is already set by Jest to 'test'

// Mock crypto for CSRF token generation
Object.defineProperty(global, "crypto", {
  value: {
    randomBytes: (size: number) => Buffer.alloc(size, "test"),
    createHmac: () => ({
      update: () => ({
        digest: () => "test-hmac",
      }),
    }),
  },
})

// Mock ResizeObserver for responsive components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver for lazy loading
global.IntersectionObserver = class IntersectionObserver {
  root = null
  rootMargin = ''
  thresholds = []
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
} as any

// Mock scrollIntoView for navigation tests
Element.prototype.scrollIntoView = jest.fn()

// Mock window.matchMedia for theme tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: "/",
      query: {},
      asPath: "/",
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return "/"
  },
  useParams() {
    return {}
  },
}))

// Mock NextAuth
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: "unauthenticated",
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock Prisma client
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    searchHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    savedSearch: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    loginAttempt: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    mfaToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

// Mock fetch for API tests
global.fetch = jest.fn()

// Setup console mocking
const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  // Suppress console output in tests unless debugging
  console.log = jest.fn()
  console.warn = jest.fn()
  console.error = (...args: any[]) => {
    // Still show actual errors but filter out React warnings
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") || args[0].includes("Warning: useLayoutEffect"))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.log = originalLog
  console.error = originalError
  console.warn = originalWarn
})

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})

// Cleanup after each test
afterEach(() => {
  jest.restoreAllMocks()
})
