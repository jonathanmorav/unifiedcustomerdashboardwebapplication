import { SessionManagement } from '@/lib/security/session-management'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// Mock database is already provided in jest.setup.ts

describe('SessionManagement', () => {
  const mockUserId = 'test-user-123'
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createDeviceFingerprint', () => {
    it('should generate consistent fingerprint for same device', () => {
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      const acceptLanguage = 'en-US,en;q=0.9'
      const acceptEncoding = 'gzip, deflate, br'

      const fingerprint1 = SessionManagement.createDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding)
      const fingerprint2 = SessionManagement.createDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding)

      expect(fingerprint1).toBe(fingerprint2)
      expect(fingerprint1).toMatch(/^[a-f0-9]{16}$/) // Truncated SHA256 hash
    })

    it('should generate different fingerprints for different devices', () => {
      const fingerprint1 = SessionManagement.createDeviceFingerprint(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'en-US'
      )
      
      const fingerprint2 = SessionManagement.createDeviceFingerprint(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
        'en-GB'
      )

      expect(fingerprint1).not.toBe(fingerprint2)
    })
  })

  describe('detectSessionAnomalies', () => {
    const currentDevice = {
      fingerprint: 'current-device-fingerprint',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Current Browser',
      lastActive: new Date(),
    }

    it('should detect new device anomaly', async () => {
      const existingSessions = [
        {
          id: 'session-1',
          metadata: {
            deviceFingerprint: 'different-device-fingerprint',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 Different Browser',
          },
        },
      ]

      ;(prisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([])

      const anomalies = await SessionManagement.detectSessionAnomalies(mockUserId, currentDevice)

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'NEW_DEVICE',
          severity: 'medium',
        })
      )
    })

    it('should detect new location anomaly', async () => {
      const existingSessions = [
        {
          id: 'session-1',
          metadata: {
            deviceFingerprint: currentDevice.fingerprint,
            ipAddress: '10.0.0.1', // Different subnet
            userAgent: currentDevice.userAgent,
          },
        },
      ]

      ;(prisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([])

      const anomalies = await SessionManagement.detectSessionAnomalies(mockUserId, currentDevice)

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'NEW_LOCATION',
          severity: 'low',
        })
      )
    })

    it('should detect impossible travel anomaly', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      const existingSessions = [
        {
          id: 'session-1',
          metadata: {
            deviceFingerprint: 'other-device',
            ipAddress: '203.0.113.0', // Very different IP (simulating different country)
            userAgent: 'Different Browser',
            lastActive: fiveMinutesAgo,
          },
        },
      ]

      ;(prisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([])

      const anomalies = await SessionManagement.detectSessionAnomalies(mockUserId, currentDevice)

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'IMPOSSIBLE_TRAVEL',
          severity: 'high',
          description: expect.stringContaining('locations within'),
        })
      )
    })

    it('should detect concurrent sessions anomaly', async () => {
      const existingSessions = [
        {
          id: 'session-1',
          metadata: { ipAddress: '10.0.0.1' },
        },
        {
          id: 'session-2',
          metadata: { ipAddress: '10.0.0.2' },
        },
        {
          id: 'session-3',
          metadata: { ipAddress: '10.0.0.3' },
        },
      ]

      ;(prisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([])

      const anomalies = await SessionManagement.detectSessionAnomalies(mockUserId, currentDevice)

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'CONCURRENT_SESSIONS',
          severity: 'medium',
          description: expect.stringContaining('3 active sessions'),
        })
      )
    })

    it('should not report anomalies for normal behavior', async () => {
      const existingSessions = [
        {
          id: 'session-1',
          metadata: {
            deviceFingerprint: currentDevice.fingerprint,
            ipAddress: currentDevice.ipAddress,
            userAgent: currentDevice.userAgent,
          },
        },
      ]

      ;(prisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([])

      const anomalies = await SessionManagement.detectSessionAnomalies(mockUserId, currentDevice)

      expect(anomalies).toHaveLength(0)
    })
  })

  describe('checkConcurrentSessions', () => {
    it('should allow sessions within limit', async () => {
      ;(prisma.session.count as jest.Mock).mockResolvedValue(2)

      const result = await SessionManagement.checkConcurrentSessions(mockUserId, 'current-session')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(2)
      expect(result.limit).toBe(3)
    })

    it('should block sessions exceeding limit', async () => {
      ;(prisma.session.count as jest.Mock).mockResolvedValue(3)

      const result = await SessionManagement.checkConcurrentSessions(mockUserId, 'current-session')

      expect(result.allowed).toBe(false)
      expect(result.count).toBe(3)
      expect(result.limit).toBe(3)
      expect(result.shouldRevoke).toBe(true)
    })

    it('should identify oldest session for revocation', async () => {
      ;(prisma.session.count as jest.Mock).mockResolvedValue(3)
      
      const oldestSession = {
        id: 'oldest-session',
        expires: new Date('2025-01-01'),
      }
      
      ;(prisma.session.findFirst as jest.Mock).mockResolvedValue(oldestSession)

      const result = await SessionManagement.checkConcurrentSessions(mockUserId, 'current-session')

      expect(result.oldestSession).toBe('oldest-session')
      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          id: { not: 'current-session' },
        },
        orderBy: { expires: 'asc' },
      })
    })
  })

  describe('revokeSession', () => {
    it('should revoke specific session and log audit', async () => {
      const sessionId = 'session-to-revoke'
      const reason = 'User initiated logout'

      ;(prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

      const result = await SessionManagement.revokeSession(mockUserId, sessionId, reason)

      expect(result).toBe(1)
      
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          id: sessionId,
        },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          action: 'SESSION_REVOKED',
          resource: 'session',
          resourceId: sessionId,
          metadata: { reason },
        }),
      })
    })
  })

  describe('revokeAllSessions', () => {
    it('should revoke all sessions except current', async () => {
      const currentSessionId = 'current-session'

      ;(prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 5 })

      const result = await SessionManagement.revokeAllSessions(mockUserId, currentSessionId)

      expect(result).toBe(5)
      
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          id: { not: currentSessionId },
        },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ALL_SESSIONS_REVOKED',
          metadata: { 
            count: 5,
            exceptSessionId: currentSessionId,
          },
        }),
      })
    })

    it('should revoke all sessions when no exception provided', async () => {
      ;(prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 3 })

      const result = await SessionManagement.revokeAllSessions(mockUserId)

      expect(result).toBe(3)
      
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      })
    })
  })
})