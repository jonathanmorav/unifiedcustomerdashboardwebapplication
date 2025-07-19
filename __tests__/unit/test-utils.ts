import { NextRequest } from 'next/server'

// Mock NextRequest for testing
export function createMockRequest(
  url: string,
  options?: {
    method?: string
    body?: any
    headers?: Record<string, string>
  }
) {
  const { method = 'GET', body, headers = {} } = options || {}
  
  return {
    url,
    method,
    headers: new Map(Object.entries(headers)),
    json: async () => body ? JSON.parse(JSON.stringify(body)) : {},
    text: async () => body ? JSON.stringify(body) : '',
    formData: async () => new FormData(),
  } as unknown as NextRequest
}

// Mock session helper
export function mockSession(user?: { email?: string; name?: string; role?: string }) {
  return user
    ? {
        user: {
          email: user.email || 'test@example.com',
          name: user.name || 'Test User',
          role: user.role || 'SUPPORT',
        },
        expires: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }
    : null
}

// Helper to create mock API responses
export function createMockResponse(data: any, status = 200) {
  return {
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Map(),
  }
}

// Mock search results
export const mockSearchResults = {
  hubspot: {
    data: {
      company: {
        id: 'hs-123',
        name: 'Test Company',
        email: 'test@company.com',
        dwolla_customer_id: 'dwolla-123',
        createdate: '2024-01-01',
        hs_lastmodifieddate: '2024-01-15',
      },
      summaryOfBenefits: [
        {
          id: 'sob-123',
          name: 'Test Benefits',
          pdf_url: 'https://example.com/sob.pdf',
          effective_date: '2024-01-01',
          status: 'active',
        },
      ],
      policies: [],
      monthlyInvoices: [],
    },
    error: null,
  },
  dwolla: {
    data: {
      customer: {
        id: 'dwolla-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@company.com',
        type: 'business',
        status: 'verified',
        created: '2024-01-01T00:00:00Z',
      },
      fundingSources: [
        {
          id: 'fs-123',
          name: 'Test Bank - 1234',
          type: 'bank',
          status: 'verified',
          accountNumber: '****1234',
        },
      ],
      transfers: [
        {
          id: 'transfer-123',
          amount: { value: '100.00', currency: 'USD' },
          status: 'processed',
          created: '2024-01-15T10:00:00Z',
        },
      ],
      notifications: [],
    },
    error: null,
  },
}