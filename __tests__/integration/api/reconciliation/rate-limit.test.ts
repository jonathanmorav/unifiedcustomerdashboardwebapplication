import { NextRequest } from 'next/server'
import { POST as reconciliationPOST } from '@/app/api/reconciliation/route'
import { POST as premiumPOST } from '@/app/api/reconciliation/premium/route'
import { getReconciliationEngine } from '@/lib/reconciliation/reconciliation-engine'
import { getServerSession } from 'next-auth'
import { requireAuth } from '@/lib/auth/api'
import { rateLimiter } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.GOOGLE_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
process.env.AUTHORIZED_EMAILS = 'test@example.com'
process.env.APP_URL = 'http://localhost:3000'

// Mock dependencies
jest.mock('@/lib/reconciliation/reconciliation-engine')
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))
jest.mock('@/lib/auth/api', () => ({
  requireAuth: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    reconciliationJob: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
    },
  },
}))
jest.mock('@/lib/logger')
jest.mock('@/lib/reconciliation/premium-reconciliation-engine')

// Mock NextRequest
class MockNextRequest extends Request {
  public nextUrl: URL

  constructor(url: string, init?: RequestInit) {
    super(url, init)
    this.nextUrl = new URL(url)
  }

  async json() {
    if (this.body) {
      const text = await this.text()
      return JSON.parse(text)
    }
    return {}
  }
}

describe('Reconciliation API Rate Limiting', () => {
  let mockEngine: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear rate limiter stores
    ;(rateLimiter as any).stores.clear()

    // Setup default mocks
    ;(requireAuth as jest.Mock).mockResolvedValue({ 
      user: { id: 'user-123', email: 'test@example.com' } 
    })
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { email: 'test@example.com' },
    })
    
    mockEngine = {
      runReconciliation: jest.fn().mockResolvedValue({
        id: 'job-123',
        status: 'running',
      }),
    }
    ;(getReconciliationEngine as jest.Mock).mockReturnValue(mockEngine)
    
    ;(prisma.reconciliationJob.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue({
      id: 'job-new',
      type: 'premium_reconciliation',
      status: 'pending',
      createdAt: new Date(),
    })
    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({})
    ;(prisma.auditLog.count as jest.Mock).mockResolvedValue(0)
  })

  describe('Basic Reconciliation Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({ configName: 'test' }),
      })

      const response = await reconciliationPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Success responses don't include rate limit headers
    })

    it('should block requests exceeding rate limit', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({ configName: 'test' }),
        })

        const response = await reconciliationPOST(request)
        expect(response.status).toBe(200)
      }

      // The 6th request should be blocked
      const blockedRequest = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({ configName: 'test' }),
      })

      const response = await reconciliationPOST(blockedRequest)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Too many reconciliation requests')
      expect(data.retryAfter).toBeDefined()
      expect(response.headers.get('Retry-After')).toBeDefined()
      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('should track rate limits per IP address', async () => {
      // Make requests from different IPs
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3']
      
      for (const ip of ips) {
        const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-forwarded-for': ip,
          },
          body: JSON.stringify({ configName: 'test' }),
        })

        const response = await reconciliationPOST(request)
        expect(response.status).toBe(200)
      }

      // Each IP should have their own limit
      expect(mockEngine.runReconciliation).toHaveBeenCalledTimes(3)
    })

    it('should log rate limit violations', async () => {
      // Exceed the rate limit
      for (let i = 0; i < 6; i++) {
        const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({ configName: 'test' }),
        })

        await reconciliationPOST(request)
      }

      // Verify audit log was created for the violation
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RATE_LIMIT_EXCEEDED',
          resource: '/api/reconciliation',
          ipAddress: '192.168.1.1',
        }),
      })
    })
  })

  describe('Premium Reconciliation Rate Limiting', () => {
    it('should enforce stricter limits for premium reconciliation', async () => {
      // Premium limit is 2 requests per 15 minutes
      for (let i = 0; i < 2; i++) {
        const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({ billingPeriod: '2024-01' }),
        })

        const response = await premiumPOST(request)
        expect(response.status).toBe(201)
      }

      // The 3rd request should be blocked
      const blockedRequest = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({ billingPeriod: '2024-01' }),
      })

      const response = await premiumPOST(blockedRequest)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Too many premium reconciliation requests')
      expect(response.headers.get('X-RateLimit-Limit')).toBe('2')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('should track premium rate limits per user', async () => {
      const users = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' },
      ]

      for (const user of users) {
        ;(getServerSession as jest.Mock).mockResolvedValue({ user })

        const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingPeriod: '2024-01' }),
        })

        const response = await premiumPOST(request)
        expect(response.status).toBe(201)
      }

      // Each user should have their own limit
      expect(prisma.reconciliationJob.create).toHaveBeenCalledTimes(2)
    })

    it('should provide appropriate retry-after header', async () => {
      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingPeriod: '2024-01' }),
        })

        await premiumPOST(request)
      }

      // Get the blocked response
      const lastResponse = await premiumPOST(
        new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingPeriod: '2024-01' }),
        })
      )

      const retryAfter = lastResponse.headers.get('Retry-After')
      expect(retryAfter).toBeDefined()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(900) // 15 minutes max
    })
  })

  describe('Rate Limit Edge Cases', () => {
    it('should handle missing IP address', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configName: 'test' }),
      })

      const response = await reconciliationPOST(request)
      expect(response.status).toBe(200)
    })

    it('should handle authentication failures before rate limiting', async () => {
      ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configName: 'test' }),
      })

      const response = await reconciliationPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unauthorized')
      // Rate limiting should not have been applied
    })

    it('should handle malformed requests', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Missing required billingPeriod
      })

      const response = await premiumPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('billingPeriod is required')
      // Rate limit should still be consumed
      expect(prisma.reconciliationJob.create).not.toHaveBeenCalled()
    })
  })
})