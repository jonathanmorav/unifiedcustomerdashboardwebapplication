import { CSRFProtection } from "@/lib/security/csrf"
import { NextRequest } from "next/server"
import crypto from "crypto"

describe("CSRFProtection", () => {
  const mockSessionId = "test-session-123"
  const mockApiKey = "test-api-key"

  describe("generateToken", () => {
    it("should generate a valid CSRF token", () => {
      const token = CSRFProtection.generateToken(mockSessionId)

      expect(token).toBeDefined()
      expect(token.token).toBeDefined()
      expect(token.csrfToken).toBeDefined()
      expect(token.expiry).toBeGreaterThan(Date.now())
    })

    it("should generate unique tokens for different sessions", () => {
      const token1 = CSRFProtection.generateToken("session-1")
      const token2 = CSRFProtection.generateToken("session-2")

      expect(token1.token).not.toBe(token2.token)
      expect(token1.csrfToken).not.toBe(token2.csrfToken)
    })
  })

  describe("verifyToken", () => {
    it("should verify a valid token", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      const isValid = CSRFProtection.verifyToken(tokenData.csrfToken, mockSessionId)

      expect(isValid).toBe(true)
    })

    it("should reject token with wrong session ID", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      const isValid = CSRFProtection.verifyToken(tokenData.csrfToken, "wrong-session")

      expect(isValid).toBe(false)
    })

    it("should reject tampered token", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      const tamperedToken = tokenData.csrfToken.slice(0, -1) + "x"
      const isValid = CSRFProtection.verifyToken(tamperedToken, mockSessionId)

      expect(isValid).toBe(false)
    })

    it("should reject expired token", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      // Manually create an expired token
      const expiredToken = {
        token: tokenData.token,
        expiry: Date.now() - 1000,
      }
      const expiredSignedToken = `${Buffer.from(JSON.stringify(expiredToken)).toString("base64")}.invalid`

      const isValid = CSRFProtection.verifyToken(expiredSignedToken, mockSessionId)

      expect(isValid).toBe(false)
    })
  })

  describe("verifyAPIRequest", () => {
    const createMockRequest = (headers: Record<string, string>, body?: any) => {
      const url = "http://localhost:3000/api/test"
      const request = new NextRequest(url, {
        method: "POST",
        headers: new Headers(headers),
        body: body ? JSON.stringify(body) : undefined,
      })
      return request
    }

    it("should verify valid API request with signature", async () => {
      const timestamp = Date.now().toString()
      const body = { test: "data" }
      const bodyHash = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex")

      const signaturePayload = `POST:/api/test:${timestamp}:${bodyHash}`
      const signature = crypto
        .createHmac("sha256", mockApiKey)
        .update(signaturePayload)
        .digest("hex")

      const request = createMockRequest(
        {
          "X-API-Key": mockApiKey,
          "X-Request-Signature": signature,
          "X-Timestamp": timestamp,
          "X-Body-Hash": bodyHash,
        },
        body
      )

      const isValid = await CSRFProtection.verifyAPIRequest(request, mockApiKey, signature)

      expect(isValid).toBe(true)
    })

    it("should reject request with invalid signature", async () => {
      const timestamp = Date.now().toString()
      const request = createMockRequest({
        "X-API-Key": mockApiKey,
        "X-Request-Signature": "invalid-signature",
        "X-Timestamp": timestamp,
      })

      const isValid = await CSRFProtection.verifyAPIRequest(
        request,
        mockApiKey,
        "invalid-signature"
      )

      expect(isValid).toBe(false)
    })

    it("should reject request with expired timestamp", async () => {
      const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString() // 6 minutes old
      const signature = crypto
        .createHmac("sha256", mockApiKey)
        .update(`POST:/api/test:${oldTimestamp}:`)
        .digest("hex")

      const request = createMockRequest({
        "X-API-Key": mockApiKey,
        "X-Request-Signature": signature,
        "X-Timestamp": oldTimestamp,
      })

      const isValid = await CSRFProtection.verifyAPIRequest(request, mockApiKey, signature)

      expect(isValid).toBe(false)
    })
  })
})
