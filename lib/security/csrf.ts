import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { getEnv } from '@/lib/env'

export interface CSRFToken {
  token: string
  timestamp: number
  sessionId: string
}

export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32
  private static readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly HEADER_NAME = 'X-CSRF-Token'
  private static readonly COOKIE_NAME = 'csrf-token'

  /**
   * Generate a new CSRF token
   */
  static generateToken(sessionId: string): CSRFToken {
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex')
    const timestamp = Date.now()
    
    return {
      token,
      timestamp,
      sessionId
    }
  }

  /**
   * Create a signed CSRF token
   */
  static signToken(tokenData: CSRFToken): string {
    const secret = getEnv().NEXTAUTH_SECRET
    const payload = JSON.stringify(tokenData)
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    return `${Buffer.from(payload).toString('base64')}.${signature}`
  }

  /**
   * Verify a signed CSRF token
   */
  static verifyToken(signedToken: string, sessionId: string): boolean {
    try {
      const [payloadBase64, signature] = signedToken.split('.')
      if (!payloadBase64 || !signature) return false

      const payload = Buffer.from(payloadBase64, 'base64').toString()
      const tokenData: CSRFToken = JSON.parse(payload)

      // Verify signature
      const secret = getEnv().NEXTAUTH_SECRET
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      if (signature !== expectedSignature) return false

      // Verify session ID
      if (tokenData.sessionId !== sessionId) return false

      // Verify token hasn't expired
      if (Date.now() - tokenData.timestamp > this.TOKEN_EXPIRY) return false

      return true
    } catch {
      return false
    }
  }

  /**
   * Extract CSRF token from request
   */
  static extractToken(request: NextRequest): string | null {
    // Check header first (for AJAX requests)
    const headerToken = request.headers.get(this.HEADER_NAME)
    if (headerToken) return headerToken

    // Check form data for traditional form submissions
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      // This would need to be parsed from the body
      // For now, we'll require header-based tokens
    }

    // Check cookie as fallback
    const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value
    return cookieToken || null
  }

  /**
   * Check if request should be exempt from CSRF protection
   */
  static isExempt(request: NextRequest): boolean {
    const path = request.nextUrl.pathname

    // Public endpoints that don't need CSRF
    const publicPaths = [
      '/api/auth',
      '/api/health',
      '/_next',
      '/favicon.ico'
    ]

    return publicPaths.some(p => path.startsWith(p))
  }

  /**
   * Check if request is from a trusted API client
   */
  static isTrustedAPIClient(request: NextRequest): boolean {
    const apiKey = request.headers.get('X-API-Key')
    const signature = request.headers.get('X-Request-Signature')
    
    if (!apiKey || !signature) return false

    // Verify API key and request signature
    return this.verifyAPIRequest(request, apiKey, signature)
  }

  /**
   * Verify API request with HMAC signature
   */
  static verifyAPIRequest(
    request: NextRequest, 
    apiKey: string, 
    signature: string
  ): boolean {
    try {
      // In production, API keys would be stored in database
      // For now, we'll use environment variables
      const validAPIKeys = getEnv().AUTHORIZED_API_KEYS || []
      
      if (!validAPIKeys.includes(apiKey)) return false

      // Reconstruct the signature payload
      const method = request.method
      const path = request.nextUrl.pathname
      const timestamp = request.headers.get('X-Timestamp')
      const body = request.headers.get('X-Body-Hash') || ''

      if (!timestamp) return false

      // Check timestamp is within 5 minutes
      const requestTime = parseInt(timestamp)
      if (Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) return false

      // Create signature
      const payload = `${method}:${path}:${timestamp}:${body}`
      const expectedSignature = crypto
        .createHmac('sha256', apiKey)
        .update(payload)
        .digest('hex')

      return signature === expectedSignature
    } catch {
      return false
    }
  }

  /**
   * Generate request signature for API clients
   */
  static generateAPISignature(
    method: string,
    path: string,
    apiKey: string,
    body?: string
  ): { signature: string; timestamp: string; bodyHash?: string } {
    const timestamp = Date.now().toString()
    let bodyHash: string | undefined

    if (body) {
      bodyHash = crypto
        .createHash('sha256')
        .update(body)
        .digest('hex')
    }

    const payload = `${method}:${path}:${timestamp}:${bodyHash || ''}`
    const signature = crypto
      .createHmac('sha256', apiKey)
      .update(payload)
      .digest('hex')

    return { signature, timestamp, bodyHash }
  }
}

/**
 * CSRF exemption policy documentation
 * 
 * The following endpoints are exempt from CSRF protection:
 * 
 * 1. Authentication endpoints (/api/auth/*) - Handled by NextAuth
 * 2. Health check endpoints (/api/health) - No state changes
 * 3. Static assets (/_next/*, /favicon.ico) - No state changes
 * 
 * API endpoints can be exempt if they meet ALL of these criteria:
 * 1. Include a valid X-API-Key header
 * 2. Include a valid X-Request-Signature header
 * 3. Include a X-Timestamp header within 5 minutes
 * 4. For requests with bodies, include X-Body-Hash header
 * 
 * Signature calculation:
 * HMAC-SHA256(apiKey, "METHOD:PATH:TIMESTAMP:BODY_HASH")
 * 
 * Example:
 * GET /api/data with timestamp 1234567890
 * Signature = HMAC-SHA256(apiKey, "GET:/api/data:1234567890:")
 */