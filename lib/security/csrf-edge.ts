import { NextRequest } from "next/server"

export interface CSRFToken {
  token: string
  timestamp: number
  sessionId: string
}

export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32
  private static readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly HEADER_NAME = "X-CSRF-Token"
  private static readonly COOKIE_NAME = "csrf-token"

  /**
   * Generate a new CSRF token using Web Crypto API
   */
  static async generateToken(sessionId: string): Promise<CSRFToken> {
    const array = new Uint8Array(this.TOKEN_LENGTH)
    crypto.getRandomValues(array)
    const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
    const timestamp = Date.now()

    return {
      token,
      timestamp,
      sessionId,
    }
  }

  /**
   * Create a signed CSRF token using Web Crypto API
   */
  static async signToken(tokenData: CSRFToken): Promise<string> {
    const secret = process.env.NEXTAUTH_SECRET || "default-secret"
    const payload = JSON.stringify(tokenData)

    // Convert secret to key
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    // Sign the payload
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))

    // Convert to hex string
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const payloadBase64 = btoa(payload)
    return `${payloadBase64}.${signatureHex}`
  }

  /**
   * Verify a signed CSRF token using Web Crypto API
   */
  static async verifyToken(signedToken: string, sessionId: string): Promise<boolean> {
    try {
      const [payloadBase64, signatureHex] = signedToken.split(".")
      if (!payloadBase64 || !signatureHex) return false

      const payload = atob(payloadBase64)
      const tokenData: CSRFToken = JSON.parse(payload)

      // Verify signature
      const secret = process.env.NEXTAUTH_SECRET || "default-secret"
      const encoder = new TextEncoder()
      const keyData = encoder.encode(secret)
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      )

      const expectedSignature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))

      const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      if (signatureHex !== expectedSignatureHex) return false

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
    const headerToken = request.headers.get(this.HEADER_NAME) || request.headers.get("x-csrf-token")
    if (headerToken) return headerToken

    // Check cookie as fallback
    const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value
    return cookieToken || null
  }

  /**
   * Check if request should be exempt from CSRF protection
   */
  static isExempt(request: NextRequest): boolean {
    const path = request.nextUrl.pathname
    const method = request.method

    // GET requests are always exempt
    if (method === "GET" || method === "HEAD") {
      return true
    }

    // Public endpoints that don't need CSRF
    const publicPaths = [
      "/api/auth", // NextAuth handles its own CSRF
      "/auth", // NextAuth pages
      "/api/health",
      "/api/search", // Search is read-only
      "/_next",
      "/favicon.ico",
    ]

    return publicPaths.some((p) => path.startsWith(p))
  }

  /**
   * Check if request is from a trusted API client
   */
  static isTrustedAPIClient(request: NextRequest): boolean {
    const apiKey = request.headers.get("X-API-Key")
    const signature = request.headers.get("X-Request-Signature")

    if (!apiKey || !signature) return false

    // In Edge Runtime, we'll do a simpler check
    // In production, this would validate against stored API keys
    const authorizedKeys = (process.env.AUTHORIZED_API_KEYS || "").split(",").filter(Boolean)
    return authorizedKeys.includes(apiKey)
  }
}
