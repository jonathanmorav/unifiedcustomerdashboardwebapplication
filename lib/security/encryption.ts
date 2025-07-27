import crypto from "crypto"
import { getEnv } from "@/lib/env"

// Type augmentation for GCM-specific methods
interface CipherGCM extends crypto.Cipher {
  getAuthTag(): Buffer
}

interface DecipherGCM extends crypto.Decipher {
  setAuthTag(tag: Buffer): this
}

/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */
export class Encryption {
  private static algorithm = "aes-256-gcm"
  private static keyLength = 32 // 256 bits
  private static ivLength = 16 // 128 bits
  private static tagLength = 16 // 128 bits
  private static saltLength = 32 // 256 bits

  /**
   * Derive encryption key from secret
   */
  private static deriveKey(secret: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(secret, salt, 100000, this.keyLength, "sha256")
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  static encrypt(data: string): string {
    const secret = getEnv().NEXTAUTH_SECRET
    const salt = crypto.randomBytes(this.saltLength)
    const key = this.deriveKey(secret, salt)
    const iv = crypto.randomBytes(this.ivLength)

    const cipher = crypto.createCipheriv(this.algorithm, key, iv) as CipherGCM

    const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()])

    // Use GCM-specific method with proper typing
    const tag = cipher.getAuthTag()

    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted])

    return combined.toString("base64")
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  static decrypt(encryptedData: string): string {
    const secret = getEnv().NEXTAUTH_SECRET
    const combined = Buffer.from(encryptedData, "base64")

    // Extract components
    const salt = combined.slice(0, this.saltLength)
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength)
    const tag = combined.slice(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength
    )
    const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength)

    const key = this.deriveKey(secret, salt)
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as DecipherGCM
    
    // Use GCM-specific method with proper typing
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return decrypted.toString("utf8")
  }

  /**
   * Generate secure random backup codes
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = []

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto
        .randomBytes(6)
        .toString("base64")
        .replace(/[+/=]/g, "") // Remove special characters
        .substring(0, 8)
        .toUpperCase()

      codes.push(code)
    }

    return codes
  }

  /**
   * Hash backup code for storage
   */
  static hashBackupCode(code: string): string {
    return crypto.createHash("sha256").update(code.toUpperCase()).digest("base64")
  }

  /**
   * Verify backup code
   */
  static verifyBackupCode(code: string, hash: string): boolean {
    const codeHash = this.hashBackupCode(code)
    return crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hash))
  }
}
