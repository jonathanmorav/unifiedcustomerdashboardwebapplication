import { CSRFProtection } from "@/lib/security/csrf"
import { NextRequest } from "next/server"

// Mock environment
jest.mock("@/lib/env", () => ({
  getEnv: jest.fn().mockReturnValue({
    NEXTAUTH_SECRET: "test-secret-key-for-testing",
  }),
}))

describe("CSRFProtection", () => {
  const mockSessionId = "test-session-123"

  describe("generateToken", () => {
    it("should generate a token with correct structure", () => {
      const token = CSRFProtection.generateToken(mockSessionId)

      expect(token).toHaveProperty("token")
      expect(token).toHaveProperty("timestamp")
      expect(token).toHaveProperty("sessionId")
      expect(token.token).toMatch(/^[a-f0-9]{64}$/) // 32 bytes in hex
      expect(token.sessionId).toBe(mockSessionId)
      expect(typeof token.timestamp).toBe("number")
    })

    it("should generate unique tokens", () => {
      const token1 = CSRFProtection.generateToken(mockSessionId)
      const token2 = CSRFProtection.generateToken(mockSessionId)

      expect(token1.token).not.toBe(token2.token)
    })
  })

  describe("signToken", () => {
    it("should create a signed token string", () => {
      const tokenData = {
        token: "test-token-123",
        timestamp: Date.now(),
        sessionId: mockSessionId,
      }

      const signed = CSRFProtection.signToken(tokenData)

      expect(signed).toContain(".")
      const [payload, signature] = signed.split(".")
      expect(payload).toBeTruthy()
      expect(signature).toBeTruthy()
    })
  })

  describe("verifyToken", () => {
    it("should verify a valid signed token", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      const signed = CSRFProtection.signToken(tokenData)

      const isValid = CSRFProtection.verifyToken(signed, mockSessionId)

      expect(isValid).toBe(true)
    })

    it("should reject token with wrong session ID", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      const signed = CSRFProtection.signToken(tokenData)

      const isValid = CSRFProtection.verifyToken(signed, "different-session")

      expect(isValid).toBe(false)
    })

    it("should reject expired tokens", () => {
      const oldTokenData = {
        token: "test-token",
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        sessionId: mockSessionId,
      }
      const signed = CSRFProtection.signToken(oldTokenData)

      const isValid = CSRFProtection.verifyToken(signed, mockSessionId)

      expect(isValid).toBe(false)
    })

    it("should reject tampered tokens", () => {
      const tokenData = CSRFProtection.generateToken(mockSessionId)
      const signed = CSRFProtection.signToken(tokenData)
      
      // Tamper with the signature part (after the dot)
      const [payload, signature] = signed.split(".")
      // Change multiple characters in the signature to ensure it's invalid
      const tamperedSignature = signature.substring(0, signature.length - 4) + "XXXX"
      const tampered = `${payload}.${tamperedSignature}`

      const isValid = CSRFProtection.verifyToken(tampered, mockSessionId)

      expect(isValid).toBe(false)
    })

    it("should reject malformed tokens", () => {
      expect(CSRFProtection.verifyToken("invalid-token", mockSessionId)).toBe(false)
      expect(CSRFProtection.verifyToken("", mockSessionId)).toBe(false)
      expect(CSRFProtection.verifyToken("no.signature", mockSessionId)).toBe(false)
    })
  })

  describe("extractToken", () => {
    it("should extract CSRF token from header", () => {
      const token = "test-csrf-token"

      // Mock NextRequest
      const mockRequest = {
        headers: {
          get: jest.fn((name) => (name.toLowerCase() === "x-csrf-token" ? token : null)),
        },
        cookies: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any

      const extracted = CSRFProtection.extractToken(mockRequest)

      expect(extracted).toBe(token)
    })

    it("should extract CSRF token from cookie", () => {
      const token = "test-csrf-token"

      // Mock NextRequest
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        cookies: {
          get: jest.fn().mockReturnValue({ value: token }),
        },
      } as any

      const extracted = CSRFProtection.extractToken(mockRequest)

      expect(extracted).toBe(token)
    })

    it("should return null when no token found", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        cookies: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any

      const extracted = CSRFProtection.extractToken(mockRequest)

      expect(extracted).toBeNull()
    })
  })

  describe("generateAPISignature", () => {
    it("should generate API signature for GET request", () => {
      const method = "GET"
      const path = "/api/data"
      const apiKey = "test-api-key"

      const result = CSRFProtection.generateAPISignature(method, path, apiKey)

      expect(result).toHaveProperty("signature")
      expect(result).toHaveProperty("timestamp")
      expect(result.signature).toMatch(/^[a-f0-9]{64}$/)
      expect(result.bodyHash).toBeUndefined()
    })

    it("should generate API signature with body hash", () => {
      const method = "POST"
      const path = "/api/data"
      const apiKey = "test-api-key"
      const body = JSON.stringify({ data: "test" })

      const result = CSRFProtection.generateAPISignature(method, path, apiKey, body)

      expect(result).toHaveProperty("signature")
      expect(result).toHaveProperty("timestamp")
      expect(result).toHaveProperty("bodyHash")
      expect(result.bodyHash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe("isExempt", () => {
    it("should exempt auth endpoints", () => {
      const mockRequest = {
        nextUrl: { pathname: "/api/auth/signin" },
      } as any

      expect(CSRFProtection.isExempt(mockRequest)).toBe(true)
    })

    it("should exempt health endpoints", () => {
      const mockRequest = {
        nextUrl: { pathname: "/api/health" },
      } as any

      expect(CSRFProtection.isExempt(mockRequest)).toBe(true)
    })

    it("should not exempt other API endpoints", () => {
      const mockRequest = {
        nextUrl: { pathname: "/api/search" },
      } as any

      expect(CSRFProtection.isExempt(mockRequest)).toBe(false)
    })
  })
})
