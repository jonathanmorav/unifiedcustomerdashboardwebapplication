import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import { AccountSecurity } from './account-security'

export interface PasswordOptions {
  minLength?: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireNumbers?: boolean
  requireSpecialChars?: boolean
}

const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
}

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
}

export class PasswordService {
  private static readonly SALT_ROUNDS = 12
  private static readonly PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || ''
  
  /**
   * Hash a password using bcrypt with pepper
   */
  static async hashPassword(password: string): Promise<string> {
    const pepperedPassword = password + this.PASSWORD_PEPPER
    return bcrypt.hash(pepperedPassword, this.SALT_ROUNDS)
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    const pepperedPassword = password + this.PASSWORD_PEPPER
    return bcrypt.compare(pepperedPassword, hash)
  }

  /**
   * Verify a user's password and record the attempt
   */
  static async verifyUserPassword(
    userId: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user with password hash
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          isActive: true,
        },
      })

      if (!user) {
        return { success: false, error: 'User not found' }
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated' }
      }

      // Check if user has a password set (OAuth users might not)
      if (!user.passwordHash) {
        await log.warn('Password verification attempted for user without password', {
          userId,
          email: user.email,
          operation: 'password_verify_no_password',
        })
        return { success: false, error: 'No password set for this account' }
      }

      // Verify the password
      const isValid = await this.verifyPassword(password, user.passwordHash)

      // Record the attempt
      await AccountSecurity.recordLoginAttempt({
        email: user.email,
        success: isValid,
        ipAddress,
        userAgent,
        reason: isValid ? 'Password verification successful' : 'Invalid password',
      })

      if (!isValid) {
        await log.warn('Failed password verification', {
          userId,
          email: user.email,
          ipAddress,
          operation: 'password_verify_failed',
        })
      }

      return { success: isValid }
    } catch (error) {
      await log.error('Password verification error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'password_verify_error',
      })
      return { success: false, error: 'Verification failed' }
    }
  }

  /**
   * Validate password strength and requirements
   */
  static validatePassword(
    password: string,
    options: PasswordOptions = DEFAULT_PASSWORD_OPTIONS
  ): PasswordValidationResult {
    const errors: string[] = []
    const opts = { ...DEFAULT_PASSWORD_OPTIONS, ...options }

    // Length check
    if (password.length < (opts.minLength || 8)) {
      errors.push(`Password must be at least ${opts.minLength} characters long`)
    }

    // Uppercase check
    if (opts.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    // Lowercase check
    if (opts.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    // Number check
    if (opts.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    // Special character check
    if (opts.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    // Common password check
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password')
    }

    // Calculate strength
    let strength: PasswordValidationResult['strength'] = 'weak'
    if (errors.length === 0) {
      const score = this.calculatePasswordScore(password)
      if (score >= 80) strength = 'very-strong'
      else if (score >= 60) strength = 'strong'
      else if (score >= 40) strength = 'medium'
    }

    return {
      valid: errors.length === 0,
      errors,
      strength,
    }
  }

  /**
   * Calculate password strength score (0-100)
   */
  private static calculatePasswordScore(password: string): number {
    let score = 0

    // Length bonus
    score += Math.min(password.length * 4, 40)

    // Character variety bonus
    if (/[a-z]/.test(password)) score += 10
    if (/[A-Z]/.test(password)) score += 10
    if (/\d/.test(password)) score += 10
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 20

    // Pattern penalty
    if (/(.)\1{2,}/.test(password)) score -= 10 // Repeated characters
    if (/^[a-zA-Z]+$/.test(password)) score -= 10 // Only letters
    if (/^\d+$/.test(password)) score -= 20 // Only numbers

    // Entropy bonus
    const uniqueChars = new Set(password).size
    score += Math.min(uniqueChars * 2, 10)

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Check if password is in common password list
   */
  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password',
      '123456',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
      '1234567890',
      'qwerty',
      'abc123',
      'Password1',
      'password1',
      '123456789',
      'welcome123',
      'password@123',
    ]

    return commonPasswords.includes(password.toLowerCase())
  }

  /**
   * Update user password
   */
  static async updatePassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate password
      const validation = this.validatePassword(newPassword)
      if (!validation.valid) {
        return { success: false, error: validation.errors.join('. ') }
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword)

      // Update in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
        },
      })

      await log.info('Password updated successfully', {
        userId,
        operation: 'password_update',
      })

      return { success: true }
    } catch (error) {
      await log.error('Password update error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'password_update_error',
      })
      return { success: false, error: 'Failed to update password' }
    }
  }

  /**
   * Check if password needs to be changed (e.g., expired)
   */
  static async checkPasswordExpiry(
    userId: string,
    maxAgeDays: number = 90
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true },
    })

    if (!user?.passwordChangedAt) {
      return true // No record of password change, should update
    }

    const daysSinceChange = Math.floor(
      (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysSinceChange > maxAgeDays
  }
}