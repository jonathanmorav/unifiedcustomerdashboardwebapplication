import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/reconciliation/premium/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { PremiumReconciliationEngine } from '@/lib/reconciliation/premium-reconciliation-engine'
import { log } from '@/lib/logger'
import type { ReconciliationJobResponse } from '@/lib/types/reconciliation'

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.GOOGLE_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
process.env.AUTHORIZED_EMAILS = 'test@example.com'
process.env.APP_URL = 'http://localhost:3000'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    reconciliationJob: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))
jest.mock('@/lib/reconciliation/premium-reconciliation-engine')
jest.mock('@/lib/logger')

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

describe('Premium Reconciliation API Routes', () => {
  let mockEngine: jest.Mocked<PremiumReconciliationEngine>

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default auth session
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { email: 'test@example.com' },
    })

    // Setup mock engine
    mockEngine = {
      runPremiumReconciliation: jest.fn(),
    } as any
    ;(PremiumReconciliationEngine as jest.MockedClass<typeof PremiumReconciliationEngine>)
      .mockImplementation(() => mockEngine)
  })

  describe('GET /api/reconciliation/premium', () => {
    it('should return specific job details when jobId is provided', async () => {
      const mockJob = {
        id: 'job-123',
        type: 'premium_reconciliation',
        status: 'completed',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:30:00Z'),
        createdAt: new Date('2024-01-15T09:55:00Z'),
        results: {
          report: {
            reportId: 'report-123',
            billingPeriod: '2024-01',
            totalCollected: 50000,
            totalAccountsProcessed: 10,
          },
          validation: {
            isValid: true,
            errors: [],
            warnings: [],
          },
          carrierFiles: [
            { carrier: 'MetLife', totalAmount: 30000 },
            { carrier: 'Prudential', totalAmount: 20000 },
          ],
        },
        errors: null,
      }

      ;(prisma.reconciliationJob.findUnique as jest.Mock).mockResolvedValue(mockJob)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium?jobId=job-123')
      const response = await GET(request)
      const data = await response.json()

      expect(prisma.reconciliationJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-123' },
      })
      expect(response.status).toBe(200)
      expect(data.jobId).toBe('job-123')
      expect(data.status).toBe('completed')
      expect(data.report).toEqual(mockJob.results.report)
      expect(data.validationResult).toEqual(mockJob.results.validation)
      expect(data.carrierFiles).toEqual(mockJob.results.carrierFiles)
      expect(data.error).toBeUndefined()
    })

    it('should return 404 when job is not found', async () => {
      ;(prisma.reconciliationJob.findUnique as jest.Mock).mockResolvedValue(null)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium?jobId=non-existent')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ error: 'Job not found' })
    })

    it('should return list of jobs with filtering', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'premium_reconciliation',
          status: 'completed',
          createdAt: new Date('2024-01-15'),
          startedAt: new Date('2024-01-15'),
          completedAt: new Date('2024-01-15'),
          config: { billingPeriod: '2024-01' },
          results: null,
          errors: null,
        },
        {
          id: 'job-2',
          type: 'premium_reconciliation',
          status: 'failed',
          createdAt: new Date('2024-01-14'),
          startedAt: new Date('2024-01-14'),
          completedAt: new Date('2024-01-14'),
          config: { billingPeriod: '2024-01' },
          results: null,
          errors: { message: 'Test error' },
        },
      ]

      ;(prisma.reconciliationJob.findMany as jest.Mock).mockResolvedValue(mockJobs)

      const request = new MockNextRequest(
        'http://localhost:3000/api/reconciliation/premium?billingPeriod=2024-01&status=completed'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(prisma.reconciliationJob.findMany).toHaveBeenCalledWith({
        where: {
          type: 'premium_reconciliation',
          config: {
            path: ['billingPeriod'],
            equals: '2024-01',
          },
          status: 'completed',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      expect(response.status).toBe(200)
      expect(data.jobs).toHaveLength(2)
    })

    it('should return 401 when unauthorized', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should handle errors gracefully', async () => {
      ;(prisma.reconciliationJob.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      )

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium')
      const response = await GET(request)
      const data = await response.json()

      expect(log.error).toHaveBeenCalledWith(
        'Error fetching reconciliation data',
        expect.any(Error),
        { operation: 'get_reconciliation_data' }
      )
      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch reconciliation data' })
    })
  })

  describe('POST /api/reconciliation/premium', () => {
    it('should create and start a new reconciliation job', async () => {
      const mockJob = {
        id: 'job-new',
        type: 'premium_reconciliation',
        status: 'pending',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        config: {
          billingPeriod: '2024-01',
          dateRange: null,
          includePending: false,
          forceRun: false,
        },
        createdBy: 'test@example.com',
      }

      ;(prisma.reconciliationJob.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue(mockJob)
      ;(prisma.reconciliationJob.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: 'completed',
      })

      mockEngine.runPremiumReconciliation.mockResolvedValue({
        report: {
          reportId: 'report-new',
          billingPeriod: '2024-01',
          totalCollected: 25000,
        } as any,
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
        },
        carrierFiles: [],
      })

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: '2024-01',
          includePending: false,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(prisma.reconciliationJob.create).toHaveBeenCalledWith({
        data: {
          type: 'premium_reconciliation',
          status: 'pending',
          config: {
            billingPeriod: '2024-01',
            dateRange: undefined,
            includePending: false,
            forceRun: false,
          },
          createdBy: 'test@example.com',
        },
      })
      expect(response.status).toBe(201)
      expect(data.jobId).toBe('job-new')
      expect(data.status).toBe('pending')
      expect(data.startedAt).toBeDefined()

      // Wait for async processing to start
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockEngine.runPremiumReconciliation).toHaveBeenCalledWith(
        '2024-01',
        { dateRange: undefined, includePending: false }
      )
    })

    it('should handle date range parameters', async () => {
      const mockJob = {
        id: 'job-date',
        type: 'premium_reconciliation',
        status: 'pending',
        createdAt: new Date(),
        createdBy: 'test@example.com',
      }

      ;(prisma.reconciliationJob.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue(mockJob)

      mockEngine.runPremiumReconciliation.mockResolvedValue({
        report: {} as any,
        validation: { isValid: true, errors: [], warnings: [] },
        carrierFiles: [],
      })

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: '2024-01',
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(201)

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockEngine.runPremiumReconciliation).toHaveBeenCalledWith(
        '2024-01',
        {
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
          includePending: false,
        }
      )
    })

    it('should return 400 when billingPeriod is missing', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'billingPeriod is required' })
    })

    it('should handle existing job when forceRun is false', async () => {
      const existingJob = {
        id: 'job-existing',
        status: 'running',
      }

      ;(prisma.reconciliationJob.findFirst as jest.Mock).mockResolvedValue(existingJob)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: '2024-01',
          forceRun: false,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        jobId: 'job-existing',
        status: 'running',
        message: 'A reconciliation job for this billing period is already in progress',
      })
      expect(prisma.reconciliationJob.create).not.toHaveBeenCalled()
    })

    it('should override existing job when forceRun is true', async () => {
      const existingJob = {
        id: 'job-existing',
        status: 'running',
      }

      const newJob = {
        id: 'job-forced',
        type: 'premium_reconciliation',
        status: 'pending',
        createdAt: new Date(),
        createdBy: 'test@example.com',
      }

      ;(prisma.reconciliationJob.findFirst as jest.Mock).mockResolvedValue(existingJob)
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue(newJob)

      mockEngine.runPremiumReconciliation.mockResolvedValue({
        report: {} as any,
        validation: { isValid: true, errors: [], warnings: [] },
        carrierFiles: [],
      })

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: '2024-01',
          forceRun: true,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(prisma.reconciliationJob.create).toHaveBeenCalled()
    })

    it('should handle reconciliation engine errors', async () => {
      const mockJob = {
        id: 'job-error',
        type: 'premium_reconciliation',
        status: 'pending',
        createdAt: new Date(),
        createdBy: 'test@example.com',
      }

      ;(prisma.reconciliationJob.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue(mockJob)

      const engineError = new Error('Engine failure')
      mockEngine.runPremiumReconciliation.mockRejectedValue(engineError)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: '2024-01',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(201) // Job creation succeeds

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify error was logged
      expect(log.error).toHaveBeenCalledWith(
        'Background reconciliation job failed',
        engineError,
        {
          jobId: 'job-error',
          billingPeriod: '2024-01',
        }
      )

      // Verify job was updated with failed status
      expect(prisma.reconciliationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-error' },
        data: expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(Date),
          errors: {
            message: 'Engine failure',
            stack: expect.any(String),
          },
        }),
      })
    })

    it('should return 401 when unauthorized', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: '2024-01',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })
})