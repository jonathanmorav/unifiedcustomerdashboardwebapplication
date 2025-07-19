import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { Encryption } from './encryption'
import { getEnv } from '@/lib/env'
import { log } from '@/lib/logger'

export interface MFASetupData {
  qrCodeUrl: string
  backupCodes: string[]
}

export interface MFAVerificationResult {
  success: boolean
  reason?: string
}

export class MFAService {
  private static readonly APP_NAME = 'Unified Customer Dashboard'
  private static readonly TOTP_WINDOW = 2 // Allow 2 time steps for clock drift

  /**
   * Generate MFA setup data for a user
   */
  static async setupMFA(userId: string, userEmail: string): Promise<MFASetupData> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${this.APP_NAME} (${userEmail})`,
      issuer: this.APP_NAME,
      length: 32
    })

    // Generate backup codes
    const backupCodes = Encryption.generateBackupCodes(10)
    const hashedBackupCodes = backupCodes.map(code => Encryption.hashBackupCode(code))

    // Encrypt secret for storage
    const encryptedSecret = Encryption.encrypt(secret.base32)

    // Store encrypted data
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: hashedBackupCodes,
        mfaEnabled: false // Not enabled until first successful verification
      }
    })

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

    // Log MFA setup initiation
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_SETUP_INITIATED',
        resource: 'auth',
        metadata: {
          timestamp: new Date().toISOString()
        }
      }
    })

    return {
      qrCodeUrl,
      backupCodes
    }
  }

  /**
   * Verify TOTP code and enable MFA if not already enabled
   */
  static async verifyTOTP(
    userId: string,
    token: string,
    ipAddress?: string
  ): Promise<MFAVerificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        mfaSecret: true,
        email: true
      }
    })

    if (!user?.mfaSecret) {
      return { success: false, reason: 'MFA not configured' }
    }

    // Decrypt secret
    let secret: string
    try {
      secret = Encryption.decrypt(user.mfaSecret)
    } catch (error) {
      log.error('Failed to decrypt MFA secret', error as Error, {
        userId,
        operation: 'mfa_decrypt'
      })
      return { success: false, reason: 'MFA configuration error' }
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: this.TOTP_WINDOW
    })

    if (verified) {
      // Enable MFA on first successful verification
      if (!user.mfaEnabled) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            mfaEnabled: true,
            mfaEnforcedAt: new Date()
          }
        })

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'MFA_ENABLED',
            resource: 'auth',
            ipAddress,
            metadata: {
              timestamp: new Date().toISOString()
            }
          }
        })
      }

      return { success: true }
    }

    // Log failed attempt
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_VERIFICATION_FAILED',
        resource: 'auth',
        ipAddress,
        metadata: {
          timestamp: new Date().toISOString()
        }
      }
    })

    return { success: false, reason: 'Invalid code' }
  }

  /**
   * Verify backup code
   */
  static async verifyBackupCode(
    userId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<MFAVerificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaBackupCodes: true,
        email: true
      }
    })

    if (!user || user.mfaBackupCodes.length === 0) {
      return { success: false, reason: 'No backup codes available' }
    }

    // Check if code matches any stored hash
    const codeIndex = user.mfaBackupCodes.findIndex(
      hash => Encryption.verifyBackupCode(code, hash)
    )

    if (codeIndex === -1) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'MFA_BACKUP_CODE_FAILED',
          resource: 'auth',
          ipAddress,
          userAgent,
          metadata: {
            timestamp: new Date().toISOString()
          }
        }
      })

      return { success: false, reason: 'Invalid backup code' }
    }

    // Remove used backup code
    const updatedCodes = user.mfaBackupCodes.filter((_, index) => index !== codeIndex)
    
    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: updatedCodes }
    })

    // Log successful use
    await prisma.mFARecovery.create({
      data: {
        userId,
        code: Encryption.hashBackupCode(code),
        ipAddress,
        userAgent
      }
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_BACKUP_CODE_USED',
        resource: 'auth',
        ipAddress,
        userAgent,
        metadata: {
          remainingCodes: updatedCodes.length,
          timestamp: new Date().toISOString()
        }
      }
    })

    return { success: true }
  }

  /**
   * Disable MFA for a user
   */
  static async disableMFA(
    userId: string,
    reason: string,
    performedBy?: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaEnforcedAt: null
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: performedBy || userId,
        action: 'MFA_DISABLED',
        resource: 'auth',
        resourceId: userId,
        metadata: {
          targetUserId: userId,
          reason,
          timestamp: new Date().toISOString()
        }
      }
    })
  }

  /**
   * Generate new backup codes
   */
  static async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = Encryption.generateBackupCodes(10)
    const hashedBackupCodes = backupCodes.map(code => Encryption.hashBackupCode(code))

    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedBackupCodes }
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_BACKUP_CODES_REGENERATED',
        resource: 'auth',
        metadata: {
          count: backupCodes.length,
          timestamp: new Date().toISOString()
        }
      }
    })

    return backupCodes
  }

  /**
   * Check if MFA should be enforced for a user
   */
  static async shouldEnforceMFA(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        mfaEnabled: true
      }
    })

    if (!user) return false

    // MFA is mandatory for all roles per security requirements
    return true
  }

  /**
   * Get MFA status for a user
   */
  static async getMFAStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        mfaEnforcedAt: true,
        mfaBackupCodes: true
      }
    })

    if (!user) return null

    return {
      enabled: user.mfaEnabled,
      enforcedAt: user.mfaEnforcedAt,
      backupCodesRemaining: user.mfaBackupCodes.length,
      required: await this.shouldEnforceMFA(userId)
    }
  }
}