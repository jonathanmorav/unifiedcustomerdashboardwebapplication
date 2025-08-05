import { ReconciliationEngine, getReconciliationEngine } from '@/lib/reconciliation/reconciliation-engine'
import { prisma } from '@/lib/db'
import { DwollaClient } from '@/lib/api/dwolla/client'
import { log } from '@/lib/logger'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    reconciliationJob: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    reconciliationCheck: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    reconciliationDiscrepancy: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    webhookEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    aCHTransaction: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/api/dwolla/client')
jest.mock('@/lib/logger')

describe('ReconciliationEngine', () => {
  let engine: ReconciliationEngine
  let mockDwollaClient: jest.Mocked<DwollaClient>

  beforeEach(() => {
    jest.clearAllMocks()
    engine = new ReconciliationEngine()
    mockDwollaClient = new DwollaClient() as jest.Mocked<DwollaClient>
  })

  describe('runReconciliation', () => {
    it('should prevent concurrent reconciliation runs', async () => {
      const mockJob = {
        id: 'job-123',
        type: 'test_reconciliation',
        status: 'pending',
        createdBy: 'system',
        createdAt: new Date(),
      }

      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValueOnce(mockJob)
      ;(prisma.reconciliationJob.update as jest.Mock).mockResolvedValue({ ...mockJob, status: 'running' })
      ;(prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.reconciliationCheck.create as jest.Mock).mockResolvedValue({ id: 'check-123' })
      ;(prisma.reconciliationCheck.update as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue([])

      // Start first reconciliation
      const firstRun = engine.runReconciliation('transfer_status_reconciliation')

      // Try to start second reconciliation
      const secondRun = engine.runReconciliation('transfer_status_reconciliation')

      // Second run should fail
      await expect(secondRun).rejects.toThrow('Reconciliation already in progress')

      // Wait for first run to complete
      await firstRun
    })

    it('should create and update reconciliation job correctly', async () => {
      const mockJob = {
        id: 'job-123',
        type: 'transfer_status_reconciliation',
        status: 'pending',
        createdBy: 'system',
        createdAt: new Date(),
      }

      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValueOnce(mockJob)
      ;(prisma.reconciliationJob.update as jest.Mock).mockImplementation((args) => {
        return Promise.resolve({ ...mockJob, ...args.data })
      })
      ;(prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.reconciliationCheck.create as jest.Mock).mockResolvedValue({ id: 'check-123' })
      ;(prisma.reconciliationCheck.update as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue([])

      const result = await engine.runReconciliation('transfer_status_reconciliation')

      // Verify job creation
      expect(prisma.reconciliationJob.create).toHaveBeenCalledWith({
        data: {
          type: 'transfer_status_reconciliation',
          status: 'pending',
          config: {
            configs: ['transfer_status_reconciliation'],
            forceRun: false,
          },
          createdBy: 'system',
        },
      })

      // Verify job updates
      expect(prisma.reconciliationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'running',
          startedAt: expect.any(Date),
        }),
      })

      expect(prisma.reconciliationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      })
    })

    it('should handle reconciliation errors gracefully', async () => {
      const error = new Error('Database connection failed')
      ;(prisma.reconciliationJob.create as jest.Mock).mockRejectedValueOnce(error)

      await expect(engine.runReconciliation()).rejects.toThrow('Database connection failed')
      
      // Verify engine is not stuck in running state
      const mockJob = { id: 'job-456' }
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValueOnce(mockJob)
      ;(prisma.reconciliationJob.update as jest.Mock).mockResolvedValue(mockJob)
      ;(prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.reconciliationCheck.create as jest.Mock).mockResolvedValue({ id: 'check-456' })
      ;(prisma.reconciliationCheck.update as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue([])

      // Should be able to run again
      await expect(engine.runReconciliation()).resolves.toBeDefined()
    })
  })

  describe('reconcileResource', () => {
    it('should detect status mismatches', async () => {
      const webhookEvent = {
        id: 'event-123',
        resourceId: 'transfer-123',
        resourceType: 'transfer',
        eventType: 'transfer_completed',
        payload: { status: 'completed', amount: { value: '100.00', currency: 'USD' } },
        eventTimestamp: new Date(),
      }

      const dbTransfer = {
        dwollaId: 'transfer-123',
        status: 'pending', // Mismatch with webhook
        amount: 100,
        metadata: {},
      }

      ;(prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([webhookEvent])
      ;(prisma.aCHTransaction.findUnique as jest.Mock).mockResolvedValue(dbTransfer)
      ;(prisma.reconciliationCheck.create as jest.Mock).mockResolvedValue({ id: 'check-789' })
      ;(prisma.reconciliationDiscrepancy.create as jest.Mock).mockResolvedValue({ id: 'disc-123' })
      ;(prisma.reconciliationCheck.update as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue({ id: 'job-789' })
      ;(prisma.reconciliationJob.update as jest.Mock).mockResolvedValue({ id: 'job-789' })
      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue([])

      await engine.runReconciliation('transfer_status_reconciliation', true)

      // Verify discrepancy was created
      expect(prisma.reconciliationDiscrepancy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          field: 'status',
          dwollaValue: JSON.stringify('completed'),
          localValue: JSON.stringify('pending'),
          resourceType: 'transfer',
          resourceId: 'transfer-123',
        }),
      })
    })

    it('should detect amount mismatches', async () => {
      const webhookEvent = {
        id: 'event-124',
        resourceId: 'transfer-124',
        resourceType: 'transfer',
        eventType: 'transfer_completed',
        payload: { status: 'completed', amount: { value: '100.50', currency: 'USD' } },
        eventTimestamp: new Date(),
      }

      const dbTransfer = {
        dwollaId: 'transfer-124',
        status: 'completed',
        amount: 99.50, // Amount mismatch
        metadata: {},
      }

      ;(prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([webhookEvent])
      ;(prisma.aCHTransaction.findUnique as jest.Mock).mockResolvedValue(dbTransfer)
      ;(prisma.reconciliationCheck.create as jest.Mock).mockResolvedValue({ id: 'check-890' })
      ;(prisma.reconciliationDiscrepancy.create as jest.Mock).mockResolvedValue({ id: 'disc-124' })
      ;(prisma.reconciliationCheck.update as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue({ id: 'job-890' })
      ;(prisma.reconciliationJob.update as jest.Mock).mockResolvedValue({ id: 'job-890' })
      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue([])

      await engine.runReconciliation('transfer_status_reconciliation', true)

      // Verify amount discrepancy was created
      expect(prisma.reconciliationDiscrepancy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          field: 'amount',
          dwollaValue: JSON.stringify(100.5),
          localValue: JSON.stringify(99.5),
          resourceType: 'transfer',
          resourceId: 'transfer-124',
        }),
      })
    })

    it('should auto-resolve discrepancies when configured', async () => {
      const webhookEvent = {
        id: 'event-125',
        resourceId: 'transfer-125',
        resourceType: 'transfer',
        eventType: 'transfer_completed',
        payload: { status: 'completed' },
        eventTimestamp: new Date(),
      }

      const dbTransfer = {
        dwollaId: 'transfer-125',
        status: 'pending',
        amount: 100,
        metadata: {},
      }

      const mockDiscrepancy = {
        id: 'disc-125',
        resourceType: 'transfer',
        resourceId: 'transfer-125',
        field: 'status',
      }

      ;(prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([webhookEvent])
      ;(prisma.aCHTransaction.findUnique as jest.Mock).mockResolvedValue(dbTransfer)
      ;(prisma.reconciliationCheck.create as jest.Mock).mockResolvedValue({ id: 'check-891' })
      ;(prisma.reconciliationDiscrepancy.create as jest.Mock).mockResolvedValue(mockDiscrepancy)
      ;(prisma.reconciliationDiscrepancy.update as jest.Mock).mockResolvedValue({})
      ;(prisma.webhookEvent.create as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationCheck.update as jest.Mock).mockResolvedValue({})
      ;(prisma.reconciliationJob.create as jest.Mock).mockResolvedValue({ id: 'job-891' })
      ;(prisma.reconciliationJob.update as jest.Mock).mockResolvedValue({ id: 'job-891' })
      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue([])

      await engine.runReconciliation('transfer_status_reconciliation', true)

      // Verify auto-resolution
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'transfer_reconciled',
          resourceType: 'transfer',
          resourceId: 'transfer-125',
          processingState: 'queued',
        }),
      })

      expect(prisma.reconciliationDiscrepancy.update).toHaveBeenCalledWith({
        where: { id: 'disc-125' },
        data: expect.objectContaining({
          resolved: true,
          resolvedAt: expect.any(Date),
          resolvedBy: 'system',
        }),
      })
    })
  })

  describe('resolveDiscrepancy', () => {
    it('should handle manual discrepancy resolution', async () => {
      const mockDiscrepancy = {
        id: 'disc-456',
        resourceType: 'transfer',
        resourceId: 'transfer-456',
        field: 'status',
        resolved: false,
      }

      ;(prisma.reconciliationDiscrepancy.findUnique as jest.Mock).mockResolvedValue(mockDiscrepancy)
      ;(prisma.reconciliationDiscrepancy.update as jest.Mock).mockResolvedValue({
        ...mockDiscrepancy,
        resolved: true,
      })

      const result = await engine.resolveDiscrepancy('disc-456', {
        type: 'accept_actual',
        details: { reason: 'Webhook was outdated' },
      })

      expect(prisma.reconciliationDiscrepancy.update).toHaveBeenCalledWith({
        where: { id: 'disc-456' },
        data: expect.objectContaining({
          resolved: true,
          resolvedAt: expect.any(Date),
          resolvedBy: 'manual',
        }),
      })
    })

    it('should reject resolution of already resolved discrepancies', async () => {
      const mockDiscrepancy = {
        id: 'disc-789',
        resolved: true,
        resolvedAt: new Date(),
      }

      ;(prisma.reconciliationDiscrepancy.findUnique as jest.Mock).mockResolvedValue(mockDiscrepancy)

      await expect(
        engine.resolveDiscrepancy('disc-789', { type: 'accept_webhook' })
      ).rejects.toThrow('Discrepancy already resolved')
    })

    it('should handle non-existent discrepancies', async () => {
      ;(prisma.reconciliationDiscrepancy.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        engine.resolveDiscrepancy('non-existent', { type: 'accept_webhook' })
      ).rejects.toThrow('Discrepancy not found')
    })
  })

  describe('getReconciliationHistory', () => {
    it('should retrieve reconciliation history within time range', async () => {
      const mockJobs = [
        { id: 'job-1', createdAt: new Date() },
        { id: 'job-2', createdAt: new Date(Date.now() - 60 * 60 * 1000) },
      ]

      ;(prisma.reconciliationJob.findMany as jest.Mock).mockResolvedValue(mockJobs)

      const result = await engine.getReconciliationHistory(24)

      expect(prisma.reconciliationJob.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      })

      expect(result).toEqual(mockJobs)
    })
  })

  describe('getJobDiscrepancies', () => {
    it('should retrieve unresolved discrepancies for a job', async () => {
      const mockChecks = [
        {
          id: 'check-1',
          discrepancies: [
            { id: 'disc-1', resolved: false },
            { id: 'disc-2', resolved: false },
          ],
        },
        {
          id: 'check-2',
          discrepancies: [{ id: 'disc-3', resolved: false }],
        },
      ]

      ;(prisma.reconciliationCheck.findMany as jest.Mock).mockResolvedValue(mockChecks)

      const result = await engine.getJobDiscrepancies('job-123')

      expect(prisma.reconciliationCheck.findMany).toHaveBeenCalledWith({
        where: {
          metadata: {
            path: ['jobId'],
            equals: 'job-123',
          },
        },
        include: {
          discrepancies: {
            where: { resolved: false },
          },
        },
      })

      expect(result).toHaveLength(3)
    })
  })

  describe('scheduleReconciliations', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.spyOn(global, 'setInterval')
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should schedule hourly and daily reconciliations', () => {
      engine.scheduleReconciliations()

      expect(setInterval).toHaveBeenCalledTimes(2)
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000) // hourly
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 24 * 60 * 60 * 1000) // daily
    })
  })
})

describe('getReconciliationEngine', () => {
  it('should return singleton instance', () => {
    const engine1 = getReconciliationEngine()
    const engine2 = getReconciliationEngine()

    expect(engine1).toBe(engine2)
  })
})