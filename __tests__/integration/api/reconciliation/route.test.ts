import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/reconciliation/route'
import { getReconciliationEngine } from '@/lib/reconciliation/reconciliation-engine'
import { getReconciliationReporter } from '@/lib/reconciliation/reconciliation-reporter'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'

// Mock dependencies
jest.mock('@/lib/reconciliation/reconciliation-engine')
jest.mock('@/lib/reconciliation/reconciliation-reporter')
jest.mock('@/lib/auth/api', () => ({
  requireAuth: jest.fn(),
}))
jest.mock('@/lib/logger')

// Mock NextRequest
class MockNextRequest extends Request {
  public nextUrl: URL

  constructor(url: string, init?: RequestInit) {
    super(url, init)
    this.nextUrl = new URL(url)
  }
}

describe('Reconciliation API Routes', () => {
  let mockEngine: any
  let mockReporter: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock reconciliation engine
    mockEngine = {
      runReconciliation: jest.fn(),
      getReconciliationHistory: jest.fn(),
    }
    ;(getReconciliationEngine as jest.Mock).mockReturnValue(mockEngine)

    // Setup mock reconciliation reporter
    mockReporter = {
      generateReport: jest.fn(),
    }
    ;(getReconciliationReporter as jest.Mock).mockReturnValue(mockReporter)

    // Setup auth mock - default to authenticated
    ;(requireAuth as jest.Mock).mockResolvedValue({ 
      user: { id: 'user-123', email: 'test@example.com' } 
    })
  })

  describe('GET /api/reconciliation', () => {
    it('should return reconciliation history', async () => {
      const mockHistory = [
        {
          id: 'job-1',
          type: 'transfer_status_reconciliation',
          status: 'completed',
          createdAt: new Date('2024-01-01'),
          completedAt: new Date('2024-01-01'),
        },
        {
          id: 'job-2',
          type: 'transfer_status_reconciliation',
          status: 'failed',
          createdAt: new Date('2024-01-02'),
          completedAt: new Date('2024-01-02'),
        },
      ]

      mockEngine.getReconciliationHistory.mockResolvedValue(mockHistory)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation?hours=48')
      const response = await GET(request)
      const data = await response.json()

      expect(requireAuth).toHaveBeenCalledWith(request)
      expect(mockEngine.getReconciliationHistory).toHaveBeenCalledWith(48)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.count).toBe(2)
      expect(data.runs).toHaveLength(2)
      expect(data.runs[0].id).toBe('job-1')
      expect(data.runs[1].id).toBe('job-2')
    })

    it('should generate report for specific run', async () => {
      const mockReport = {
        id: 'job-123',
        summary: {
          totalChecks: 100,
          discrepancies: 5,
          resolved: 3,
        },
        checks: [],
      }

      mockReporter.generateReport.mockResolvedValue(mockReport)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation?runId=job-123')
      const response = await GET(request)
      const data = await response.json()

      expect(requireAuth).toHaveBeenCalledWith(request)
      expect(mockReporter.generateReport).toHaveBeenCalledWith('job-123')
      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        report: mockReport,
      })
    })

    it('should use default hours when not specified', async () => {
      mockEngine.getReconciliationHistory.mockResolvedValue([])

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation')
      const response = await GET(request)

      expect(mockEngine.getReconciliationHistory).toHaveBeenCalledWith(24)
      expect(response.status).toBe(200)
    })

    it('should handle authentication failure', async () => {
      ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        success: false,
        error: 'Failed to get reconciliation history',
      })
    })

    it('should handle engine errors gracefully', async () => {
      mockEngine.getReconciliationHistory.mockRejectedValue(new Error('Database error'))

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation')
      const response = await GET(request)
      const data = await response.json()

      expect(log.error).toHaveBeenCalledWith(
        'Failed to get reconciliation history',
        expect.any(Error)
      )
      expect(response.status).toBe(500)
      expect(data).toEqual({
        success: false,
        error: 'Failed to get reconciliation history',
      })
    })
  })

  describe('POST /api/reconciliation', () => {
    it('should start a new reconciliation run', async () => {
      const mockRun = {
        id: 'job-new',
        type: 'transfer_status_reconciliation',
        status: 'running',
        createdAt: new Date(),
        startedAt: new Date(),
      }

      mockEngine.runReconciliation.mockResolvedValue(mockRun)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configName: 'transfer_status_reconciliation',
          forceRun: false,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(requireAuth).toHaveBeenCalledWith(request)
      expect(mockEngine.runReconciliation).toHaveBeenCalledWith(
        'transfer_status_reconciliation',
        false
      )
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.run.id).toBe('job-new')
      expect(data.run.status).toBe('running')
      expect(data.run.type).toBe('transfer_status_reconciliation')
    })

    it('should handle forceRun parameter', async () => {
      const mockRun = {
        id: 'job-force',
        type: 'all',
        status: 'running',
        createdAt: new Date(),
      }

      mockEngine.runReconciliation.mockResolvedValue(mockRun)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceRun: true,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockEngine.runReconciliation).toHaveBeenCalledWith(undefined, true)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle authentication failure', async () => {
      ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle concurrent run prevention', async () => {
      const error = new Error('Reconciliation already in progress')
      mockEngine.runReconciliation.mockRejectedValue(error)

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configName: 'transfer_status_reconciliation',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(log.error).toHaveBeenCalledWith(
        'Failed to start reconciliation',
        error
      )
      expect(response.status).toBe(500)
      expect(data).toEqual({
        success: false,
        error: 'Reconciliation already in progress',
      })
    })

    it('should handle generic errors with fallback message', async () => {
      mockEngine.runReconciliation.mockRejectedValue('String error')

      const request = new MockNextRequest('http://localhost:3000/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        success: false,
        error: 'Failed to start reconciliation',
      })
    })
  })
})