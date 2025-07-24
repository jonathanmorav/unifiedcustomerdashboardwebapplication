import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { MFAService } from "@/lib/security/mfa"
import { AccountSecurity } from "@/lib/security/account-security"
import { rateLimiter, rateLimitConfigs } from "@/lib/security/rate-limit"
import { z } from "zod"
import { headers } from "next/headers"
import { log } from "@/lib/logger"

// Rate limit configuration for MFA endpoints
const mfaRateLimitConfig = {
  ...rateLimitConfigs.auth,
  name: "mfa-setup",
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Only 3 attempts per 5 minutes
}

// GET - Get MFA setup data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimiter.limit(request, {
      ...mfaRateLimitConfig,
      keyGenerator: () => `mfa-setup:${session.user.id}`,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter?.toString() || "300",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
          },
        }
      )
    }

    // Check if MFA is already set up
    const status = await MFAService.getMFAStatus(session.user.id)

    if (status?.enabled) {
      return NextResponse.json(
        { error: "Configuration error" }, // Generic error
        { status: 400 }
      )
    }

    // Verify fresh session (require recent authentication)
    const sessionAge = Date.now() - new Date(session.expires).getTime()
    const FRESH_SESSION_WINDOW = 15 * 60 * 1000 // 15 minutes

    if (sessionAge > FRESH_SESSION_WINDOW) {
      return NextResponse.json(
        {
          error: "Session verification required",
          requiresReauth: true,
        },
        { status: 403 }
      )
    }

    // Generate MFA setup data
    const setupData = await MFAService.setupMFA(session.user.id, session.user.email)

    // Never return the secret directly - only QR code and backup codes
    const response = NextResponse.json({
      qrCode: setupData.qrCodeUrl,
      backupCodes: setupData.backupCodes,
      // Add warning about backup codes
      warning: "Save these backup codes in a secure location. They will not be shown again.",
    })

    // Security headers
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")

    return response
  } catch (error) {
    log.error("MFA setup error", error as Error, {
      userId: session?.user?.id,
      operation: "mfa_setup",
    })

    // Log error internally but return generic message
    await AccountSecurity.escalateSecurityEvent(session?.user?.id || "unknown", "MFA_SETUP_ERROR", {
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json(
      { error: "Configuration error" }, // Always generic
      { status: 500 }
    )
  }
}

// POST - Verify initial setup and enable MFA
const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, "Invalid format"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined

    // Apply rate limiting - stricter for verification
    const rateLimitResult = await rateLimiter.limit(request, {
      ...mfaRateLimitConfig,
      max: 3, // Only 3 attempts
      windowMs: 15 * 60 * 1000, // 15 minutes
      keyGenerator: () => `mfa-verify:${session.user.id}`,
      onLimitReached: async () => {
        // Escalate after repeated failures
        await AccountSecurity.escalateSecurityEvent(
          session.user.id,
          "MFA_VERIFICATION_RATE_LIMITED",
          {
            ipAddress,
            timestamp: new Date().toISOString(),
          }
        )
      },
    })

    if (!rateLimitResult.success) {
      const response = NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      )

      response.headers.set("Retry-After", rateLimitResult.retryAfter?.toString() || "900")
      response.headers.set("Cache-Control", "no-store")

      return response
    }

    const body = await request.json()
    const validation = verifySchema.safeParse(body)

    if (!validation.success) {
      // Log invalid attempts
      await AccountSecurity.recordLoginAttempt({
        email: session.user.email!,
        success: false,
        ipAddress,
        userAgent: request.headers.get("user-agent") || undefined,
        reason: "Invalid MFA code format",
      })

      return NextResponse.json(
        { error: "Verification failed" }, // Generic error
        { status: 400 }
      )
    }

    const result = await MFAService.verifyTOTP(session.user.id, validation.data.code, ipAddress)

    if (!result.success) {
      // Log failed verification
      await AccountSecurity.recordLoginAttempt({
        email: session.user.email!,
        success: false,
        ipAddress,
        userAgent: request.headers.get("user-agent") || undefined,
        reason: "Invalid MFA code",
      })

      // Check if we should escalate
      const attempts = await AccountSecurity.getRecentLoginAttempts(session.user.email!, 5)

      const recentFailures = attempts.filter((a) => !a.success).length
      if (recentFailures >= 3) {
        await AccountSecurity.escalateSecurityEvent(session.user.id, "MFA_REPEATED_FAILURES", {
          failures: recentFailures,
          ipAddress,
          timestamp: new Date().toISOString(),
        })
      }

      return NextResponse.json(
        { error: "Verification failed" }, // Always generic
        { status: 400 }
      )
    }

    // Success - log it
    await AccountSecurity.recordLoginAttempt({
      email: session.user.email!,
      success: true,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
      reason: "MFA enabled successfully",
    })

    const response = NextResponse.json({
      success: true,
      message: "Security configuration updated successfully",
    })

    // Security headers
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    response.headers.set("Pragma", "no-cache")

    return response
  } catch (error) {
    log.error("MFA verification error", error as Error, {
      userId: session?.user?.id,
      operation: "mfa_verification",
    })

    // Log error internally
    await AccountSecurity.escalateSecurityEvent(
      session?.user?.id || "unknown",
      "MFA_VERIFICATION_ERROR",
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }
    )

    return NextResponse.json(
      { error: "Verification failed" }, // Always generic
      { status: 500 }
    )
  }
}
