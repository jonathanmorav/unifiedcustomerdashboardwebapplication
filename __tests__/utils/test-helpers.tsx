import { render, RenderOptions } from "@testing-library/react"
import React, { ReactElement } from "react"
import { ThemeProvider } from "next-themes"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import axe from "@axe-core/react"

// Mock session for testing
export const mockSession: Session = {
  user: {
    id: "user123",
    email: "test@example.com",
    name: "Test User",
    role: "ADMIN",
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

// Provider wrapper for tests
interface AllProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

function AllProviders({ children, session = mockSession }: AllProvidersProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}

// Custom render function with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { session?: Session | null }
) {
  const { session, ...renderOptions } = options || {}
  return render(ui, {
    wrapper: ({ children }) => <AllProviders session={session}>{children}</AllProviders>,
    ...renderOptions,
  })
}

// Mock fetch responses
export function mockFetch<T = unknown>(
  data: T,
  options: { ok?: boolean; status?: number } = {}
) {
  const { ok = true, status = 200 } = options
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  })
}

// Wait for async updates
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0))

// Mock console methods
export function mockConsole() {
  const originalConsole = { ...console }
  const mockError = jest.fn()
  const mockWarn = jest.fn()
  const mockLog = jest.fn()

  beforeAll(() => {
    console.error = mockError
    console.warn = mockWarn
    console.log = mockLog
  })

  afterAll(() => {
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.log = originalConsole.log
  })

  return { mockError, mockWarn, mockLog }
}

// Mock window.matchMedia
export function mockMatchMedia(matches: boolean = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock IntersectionObserver
export function mockIntersectionObserver() {
  const mockIntersectionObserver = jest.fn()
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  })
  window.IntersectionObserver = mockIntersectionObserver as unknown as typeof window.IntersectionObserver
}

// Generate test data
export function generateTestData<T extends { id: string }>(count: number, template: T): T[] {
  return Array.from({ length: count }, (_, i) => ({
    ...template,
    id: `${template.id}-${i}`,
  }))
}

// Assert accessibility
export async function assertAccessibility(container: HTMLElement) {
  const results = (await axe(container)) as {
    violations?: Array<{ id?: string; impact?: string; description?: string; nodes?: Array<{ html?: string }> }>
  }

  const violations = results.violations ?? []
  if (violations.length > 0) {
    const summary = violations
      .map(violation => `${violation.id ?? "unknown"} (${violation.impact ?? "unknown"}): ${violation.description ?? ""}`)
      .join("\n")
    throw new Error(`Accessibility violations found:\n${summary}`)
  }
}

// Mock router
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  pathname: "/",
  query: {},
  asPath: "/",
}

// Test IDs for common elements
export const testIds = {
  searchBar: "unified-search-bar",
  searchButton: "search-button",
  searchInput: "search-input",
  searchSuggestions: "search-suggestions",
  filterPanel: "filter-panel",
  dateFilter: "date-filter",
  amountFilter: "amount-filter",
  statusFilter: "status-filter",
  sortDropdown: "sort-dropdown",
  resultsList: "results-list",
  resultItem: "result-item",
  pagination: "pagination",
  savedSearches: "saved-searches",
  loadingSpinner: "loading-spinner",
  errorMessage: "error-message",
  emptyState: "empty-state",
}
