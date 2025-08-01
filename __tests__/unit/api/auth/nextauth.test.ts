import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog } from "@/lib/security/audit"
import { User } from "next-auth"
import { AdapterUser } from "next-auth/adapters"

// Mock dependencies
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock("@/lib/security/audit", () => ({
  createAuditLog: jest.fn(),
}))

jest.mock("@/lib/env", () => ({
  getEnv: jest.fn().mockReturnValue({
    ALLOWED_EMAILS: "test@example.com,admin@example.com",
    NEXTAUTH_SECRET: "test-secret",
  }),
}))

describe("NextAuth Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ALLOWED_EMAILS = "test@example.com,admin@example.com"
  })

  describe("callbacks.signIn", () => {
    const mockUser: User = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
    }

    it("should allow whitelisted email to sign in", async () => {
      const result = await authOptions.callbacks?.signIn?.({
        user: mockUser,
        account: null,
        profile: undefined,
        email: undefined,
        credentials: undefined,
      })

      expect(result).toBe(true)
    })

    it("should deny non-whitelisted email", async () => {
      const nonWhitelistedUser: User = {
        ...mockUser,
        email: "notallowed@example.com",
      }

      const result = await authOptions.callbacks?.signIn?.({
        user: nonWhitelistedUser,
        account: null,
        profile: undefined,
        email: undefined,
        credentials: undefined,
      })

      expect(result).toBe(false)
    })

    it("should deny users without email", async () => {
      const userWithoutEmail: User = {
        ...mockUser,
        email: null,
      }

      const result = await authOptions.callbacks?.signIn?.({
        user: userWithoutEmail,
        account: null,
        profile: undefined,
        email: undefined,
        credentials: undefined,
      })

      expect(result).toBe(false)
    })

    it("should handle wildcard domain whitelist", async () => {
      process.env.ALLOWED_EMAILS = "*@company.com"

      const companyUser: User = {
        ...mockUser,
        email: "anyone@company.com",
      }

      const result = await authOptions.callbacks?.signIn?.({
        user: companyUser,
        account: null,
        profile: undefined,
        email: undefined,
        credentials: undefined,
      })

      expect(result).toBe(true)
    })
  })

  describe("callbacks.session", () => {
    const mockToken = {
      sub: "1",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/pic.jpg",
      role: "SUPPORT",
    }

    const mockSession = {
      expires: new Date().toISOString(),
      user: {
        email: "test@example.com",
      },
    }

    it("should populate session with token data", async () => {
      const result = await authOptions.callbacks?.session?.({
        session: mockSession as any,
        token: mockToken,
        user: {} as AdapterUser,
      })

      expect(result.user).toEqual({
        id: "1",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/pic.jpg",
        role: "SUPPORT",
      })
    })

    it("should handle missing token data gracefully", async () => {
      const incompleteToken = { sub: "1" }

      const result = await authOptions.callbacks?.session?.({
        session: mockSession as any,
        token: incompleteToken,
        user: {} as AdapterUser,
      })

      expect(result.user.id).toBe("1")
      expect(result.user.email).toBe("test@example.com")
    })
  })

  describe("callbacks.jwt", () => {
    const mockToken = {
      sub: "1",
      email: "test@example.com",
    }

    it("should add user role on first sign in", async () => {
      const mockUser = {
        id: "1",
        email: "test@example.com",
        role: "ADMIN",
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser)

      const result = await authOptions.callbacks?.jwt?.({
        token: mockToken,
        user: mockUser as any,
        account: null,
        profile: undefined,
        isNewUser: false,
      })

      expect(result.role).toBe("ADMIN")
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        select: { role: true },
      })
    })

    it("should preserve existing token data", async () => {
      const existingToken = {
        ...mockToken,
        role: "SUPPORT",
        customField: "value",
      }

      const result = await authOptions.callbacks?.jwt?.({
        token: existingToken,
        user: null as any,
        account: null,
        profile: undefined,
        isNewUser: false,
      })

      expect(result).toEqual(existingToken)
    })

    it("should handle database errors gracefully", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockRejectedValueOnce(new Error("Database error"))

      const mockUser = {
        id: "1",
        email: "test@example.com",
      }

      const result = await authOptions.callbacks?.jwt?.({
        token: mockToken,
        user: mockUser as any,
        account: null,
        profile: undefined,
        isNewUser: false,
      })

      expect(result.role).toBe("SUPPORT") // Default role
    })
  })

  describe("events", () => {
    it("should create audit log on sign in", async () => {
      const mockUser = {
        id: "1",
        email: "test@example.com",
      }

      await authOptions.events?.signIn?.({
        user: mockUser as any,
        account: null,
        profile: undefined,
        isNewUser: false,
      })

      expect(createAuditLog).toHaveBeenCalledWith({
        userId: "1",
        action: "SIGN_IN",
        metadata: {
          email: "test@example.com",
          timestamp: expect.any(String),
        },
      })
    })

    it("should create audit log on sign out", async () => {
      const mockSession = {
        sessionToken: "token-123",
        userId: "1",
        expires: new Date(),
      }

      await authOptions.events?.signOut?.({
        session: mockSession as any,
      })

      expect(createAuditLog).toHaveBeenCalledWith({
        userId: "1",
        action: "SIGN_OUT",
        metadata: {
          sessionToken: "token-123",
          timestamp: expect.any(String),
        },
      })
    })

    it("should handle sign out without session gracefully", async () => {
      await authOptions.events?.signOut?.({
        session: null as any,
      })

      expect(createAuditLog).not.toHaveBeenCalled()
    })
  })

  describe("session configuration", () => {
    it("should have correct session strategy", () => {
      expect(authOptions.session?.strategy).toBe("jwt")
    })

    it("should have 30 minute session timeout", () => {
      expect(authOptions.session?.maxAge).toBe(30 * 60) // 30 minutes in seconds
    })

    it("should update session activity", () => {
      expect(authOptions.session?.updateAge).toBe(5 * 60) // 5 minutes in seconds
    })
  })

  describe("pages configuration", () => {
    it("should have custom sign in page", () => {
      expect(authOptions.pages?.signIn).toBe("/auth/signin")
    })

    it("should have custom error page", () => {
      expect(authOptions.pages?.error).toBe("/auth/error")
    })
  })
})
