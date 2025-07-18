import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'

export interface LoginAttemptData {
  email: string
  success: boolean
  ipAddress?: string
  userAgent?: string
  reason?: string
}

export interface AccountLockoutConfig {
  maxFailedAttempts: number
  lockoutDuration: number // minutes
  resetWindow: number // minutes
}

export class AccountSecurity {
  private static readonly DEFAULT_CONFIG: AccountLockoutConfig = {
    maxFailedAttempts: 5,
    lockoutDuration: 30, // 30 minutes
    resetWindow: 15 // Reset counter after 15 minutes
  }

  /**
   * Record a login attempt
   */
  static async recordLoginAttempt(data: LoginAttemptData): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true }
    })

    await prisma.loginAttempt.create({
      data: {
        userId: user?.id,
        email: data.email,
        success: data.success,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        reason: data.reason
      }
    })

    if (user && !data.success) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 }
        }
      })

      // Check if account should be locked
      await this.checkAndLockAccount(user.id, data.ipAddress)
    } else if (user && data.success) {
      // Reset failed attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastLoginAt: new Date(),
          lastLoginIp: data.ipAddress
        }
      })
    }
  }

  /**
   * Check if account should be locked and lock if necessary
   */
  private static async checkAndLockAccount(
    userId: string,
    ipAddress?: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        failedLoginAttempts: true,
        email: true,
        role: true
      }
    })

    if (!user) return

    const config = this.getConfigForRole(user.role)

    if (user.failedLoginAttempts >= config.maxFailedAttempts) {
      const lockoutUntil = new Date(
        Date.now() + config.lockoutDuration * 60 * 1000
      )

      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: lockoutUntil }
      })

      // Log account lockout
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'ACCOUNT_LOCKED',
          resource: 'auth',
          ipAddress,
          metadata: {
            failedAttempts: user.failedLoginAttempts,
            lockoutDuration: config.lockoutDuration,
            lockedUntil: lockoutUntil.toISOString()
          }
        }
      })

      // TODO: Send email notification about account lockout
      // await sendAccountLockoutEmail(user.email, lockoutUntil)
    }
  }

  /**
   * Check if account is locked
   */
  static async isAccountLocked(email: string): Promise<{
    locked: boolean
    lockedUntil?: Date
    reason?: string
  }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        lockedUntil: true,
        isActive: true
      }
    })

    if (!user) {
      return { locked: false }
    }

    if (!user.isActive) {
      return { 
        locked: true, 
        reason: 'Account is deactivated. Please contact support.' 
      }
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { 
        locked: true, 
        lockedUntil: user.lockedUntil,
        reason: `Account is locked due to multiple failed login attempts. Try again after ${user.lockedUntil.toLocaleTimeString()}.`
      }
    }

    // Check if we should reset failed attempts
    await this.checkAndResetFailedAttempts(email)

    return { locked: false }
  }

  /**
   * Reset failed attempts if outside reset window
   */
  private static async checkAndResetFailedAttempts(email: string): Promise<void> {
    const config = this.DEFAULT_CONFIG
    const resetWindowStart = new Date(Date.now() - config.resetWindow * 60 * 1000)

    const recentFailedAttempts = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: resetWindowStart }
      }
    })

    if (recentFailedAttempts === 0) {
      await prisma.user.update({
        where: { email },
        data: { failedLoginAttempts: 0 }
      })
    }
  }

  /**
   * Unlock account (admin action)
   */
  static async unlockAccount(
    userId: string,
    unlockedBy: string,
    reason: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: null,
        failedLoginAttempts: 0
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: unlockedBy,
        action: 'ACCOUNT_UNLOCKED',
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
   * Get lockout configuration based on role
   */
  private static getConfigForRole(role: string): AccountLockoutConfig {
    // Could have different configs per role if needed
    // For now, using same config for all roles
    return this.DEFAULT_CONFIG
  }

  /**
   * Get recent login attempts for a user
   */
  static async getRecentLoginAttempts(
    email: string,
    limit: number = 10
  ) {
    return prisma.loginAttempt.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        success: true,
        ipAddress: true,
        userAgent: true,
        reason: true,
        createdAt: true
      }
    })
  }

  /**
   * Detect suspicious login patterns
   */
  static async detectSuspiciousActivity(
    userId: string,
    currentIp: string
  ): Promise<{
    suspicious: boolean
    reasons: string[]
  }> {
    const reasons: string[] = []

    // Get recent successful logins
    const recentLogins = await prisma.loginAttempt.findMany({
      where: {
        userId,
        success: true,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      },
      select: {
        ipAddress: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Check for rapid login attempts from different IPs
    const uniqueIps = new Set(recentLogins.map(l => l.ipAddress).filter(Boolean))
    if (uniqueIps.size > 3) {
      reasons.push('Multiple IP addresses in short time period')
    }

    // Check for login from new location
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginIp: true }
    })

    if (user?.lastLoginIp && user.lastLoginIp !== currentIp) {
      // In production, you'd want to use a geolocation service here
      reasons.push('Login from new IP address')
    }

    // Check for impossible travel (would need geolocation)
    // This is a placeholder for more sophisticated checks

    return {
      suspicious: reasons.length > 0,
      reasons
    }
  }

  /**
   * Escalate security event to support team
   */
  static async escalateSecurityEvent(
    userId: string,
    event: string,
    details: Record<string, any>
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SECURITY_EVENT_ESCALATED',
        resource: 'auth',
        metadata: {
          event,
          details,
          escalatedAt: new Date().toISOString()
        }
      }
    })

    // TODO: Send notification to security team
    // await notifySecurityTeam(userId, event, details)
  }
}