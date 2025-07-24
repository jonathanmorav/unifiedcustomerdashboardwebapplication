import { MFAService } from "@/lib/security/mfa"
import { AccountSecurity } from "@/lib/security/account-security"
import bcrypt from "bcryptjs"
import speakeasy from "speakeasy"
import QRCode from "qrcode"
import { db } from "@/lib/db"

// Mock dependencies
jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mFARecovery: {
      create: jest.fn(),
    },
    loginAttempt: {
      create: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock("qrcode")
jest.mock("speakeasy")

describe("MFAService", () => {
  const mockUserId = "test-user-123"
  const mockEmail = "test@example.com"
  const mockSecret = {
    base32: "MOCK_SECRET_BASE32",
    otpauth_url: "otpauth://totp/Test:test@example.com?secret=MOCK_SECRET",
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mocks
    ;(speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret)
    ;(QRCode.toDataURL as jest.Mock).mockResolvedValue("data:image/png;base64,mockQRCode")
  })

  describe("setupMFA", () => {
    it("should generate MFA setup data without exposing secret", async () => {
      const result = await MFAService.setupMFA(mockUserId, mockEmail)

      expect(result.qrCode).toBe("data:image/png;base64,mockQRCode")
      expect(result.backupCodes).toHaveLength(10)
      expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(result.warning).toContain("backup codes")
      expect(result.secret).toBeUndefined() // Secret should never be exposed
    })

    it("should generate unique backup codes", async () => {
      const result = await MFAService.setupMFA(mockUserId, mockEmail)
      const uniqueCodes = new Set(result.backupCodes)

      expect(uniqueCodes.size).toBe(10)
    })

    it("should create QR code with correct parameters", async () => {
      await MFAService.setupMFA(mockUserId, mockEmail)

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: mockEmail,
        issuer: "Unified Customer Dashboard",
        length: 32,
      })

      expect(QRCode.toDataURL).toHaveBeenCalledWith(mockSecret.otpauth_url)
    })
  })

  describe("verifyTOTP", () => {
    const mockUser = {
      id: mockUserId,
      email: mockEmail,
      mfaEnabled: true,
      mfaSecret: "encrypted_secret",
      failedLoginAttempts: 0,
      lockedUntil: null,
    }

    beforeEach(() => {
      ;(db.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(db.loginAttempt.count as jest.Mock).mockResolvedValue(0)
    })

    it("should verify valid TOTP code", async () => {
      ;(speakeasy.totp.verify as jest.Mock).mockReturnValue(true)

      const result = await MFAService.verifyTOTP(mockUserId, "123456", "192.168.1.1")

      expect(result.success).toBe(true)
      expect(result.message).toContain("verified")
      expect(db.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: true,
          userId: mockUserId,
        }),
      })
    })

    it("should reject invalid TOTP code", async () => {
      ;(speakeasy.totp.verify as jest.Mock).mockReturnValue(false)

      const result = await MFAService.verifyTOTP(mockUserId, "000000", "192.168.1.1")

      expect(result.success).toBe(false)
      expect(result.message).toBe("Invalid code") // Generic error message
      expect(result.attemptsRemaining).toBeDefined()
    })

    it("should enforce rate limiting after failed attempts", async () => {
      ;(speakeasy.totp.verify as jest.Mock).mockReturnValue(false)
      ;(db.loginAttempt.count as jest.Mock).mockResolvedValue(2) // 2 recent failures

      const result = await MFAService.verifyTOTP(mockUserId, "000000", "192.168.1.1")

      expect(result.success).toBe(false)
      expect(result.attemptsRemaining).toBe(0) // 3 - 2 previous - 1 current = 0
      expect(result.lockoutMinutes).toBe(15)
    })

    it("should reject attempts when account is locked", async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // Locked for 10 more minutes
      }
      ;(db.user.findUnique as jest.Mock).mockResolvedValue(lockedUser)

      const result = await MFAService.verifyTOTP(mockUserId, "123456", "192.168.1.1")

      expect(result.success).toBe(false)
      expect(result.message).toBe("Invalid code") // Generic error message
      expect(result.lockoutMinutes).toBeGreaterThan(0)
      expect(speakeasy.totp.verify).not.toHaveBeenCalled() // Don't verify when locked
    })
  })

  describe("verifyBackupCode", () => {
    const mockUser = {
      id: mockUserId,
      email: mockEmail,
      mfaEnabled: true,
      mfaBackupCodes: ["hashed_code_1", "hashed_code_2", "hashed_code_3"],
    }

    beforeEach(() => {
      ;(db.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    })

    it("should verify and consume valid backup code", async () => {
      const backupCode = "ABCD-1234-WXYZ"

      // Mock bcrypt to match the first hashed code
      bcrypt.compare = jest
        .fn()
        .mockResolvedValueOnce(true) // First code matches
        .mockResolvedValue(false)

      const result = await MFAService.verifyBackupCode(mockUserId, backupCode, "192.168.1.1")

      expect(result.success).toBe(true)
      expect(result.codesRemaining).toBe(2) // 3 - 1 used = 2

      // Verify backup code was removed
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          mfaBackupCodes: ["hashed_code_2", "hashed_code_3"],
        },
      })

      // Verify usage was logged
      expect(db.mFARecovery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          code: expect.stringContaining("****"), // Code should be masked
        }),
      })
    })

    it("should reject invalid backup code", async () => {
      bcrypt.compare = jest.fn().mockResolvedValue(false) // No matches

      const result = await MFAService.verifyBackupCode(mockUserId, "INVALID-CODE", "192.168.1.1")

      expect(result.success).toBe(false)
      expect(result.message).toBe("Invalid code") // Generic error message
      expect(db.user.update).not.toHaveBeenCalled()
    })

    it("should reject when no backup codes remain", async () => {
      const userNoCodes = { ...mockUser, mfaBackupCodes: [] }
      ;(db.user.findUnique as jest.Mock).mockResolvedValue(userNoCodes)

      const result = await MFAService.verifyBackupCode(mockUserId, "ANY-CODE", "192.168.1.1")

      expect(result.success).toBe(false)
      expect(result.message).toBe("Invalid code") // Generic error message
      expect(result.needsNewCodes).toBe(true)
    })
  })

  describe("generateBackupCodes", () => {
    it("should generate new backup codes with fresh session check", async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        mfaEnabled: true,
      }
      ;(db.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      const sessionInfo = {
        lastAuth: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        ipAddress: "192.168.1.1",
      }

      const result = await MFAService.generateBackupCodes(mockUserId, sessionInfo)

      expect(result.success).toBe(true)
      expect(result.backupCodes).toHaveLength(10)
      expect(result.warning).toContain("safely")

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          mfaBackupCodes: expect.arrayContaining([
            expect.stringMatching(/^\$2[aby]\$\d+\$/), // bcrypt hash pattern
          ]),
        },
      })
    })

    it("should reject stale sessions", async () => {
      const sessionInfo = {
        lastAuth: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        ipAddress: "192.168.1.1",
      }

      const result = await MFAService.generateBackupCodes(mockUserId, sessionInfo)

      expect(result.success).toBe(false)
      expect(result.message).toContain("Fresh authentication required")
      expect(result.requiresReauth).toBe(true)
    })
  })
})
