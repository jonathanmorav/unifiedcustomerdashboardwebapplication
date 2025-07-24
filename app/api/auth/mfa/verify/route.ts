import { NextRequest, NextResponse } from "next/server"
import { MFAService } from "@/lib/security/mfa"
import { AccountSecurity } from "@/lib/security/account-security"
import { rateLimiter } from "@/lib/security/rate-limit"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { log } from "@/lib/logger"

// Input validation
const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(8), // 6 digits for TOTP, 8 for backup codes
  sessionToken: z.string(), // Temporary token from first auth step
})

// Rate limit configuration - very strict for MFA verification
const mfaVerifyRateLimitConfig = {
  name: "mfa-login-verify",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per 15 minutes
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = verifySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request" }, // Generic error
        { status: 400 }
      )
    }

    const { email, code, sessionToken } = validation.data
    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    // Apply rate limiting by email
    const rateLimitResult = await rateLimiter.limit(request, {
      ...mfaVerifyRateLimitConfig,
      keyGenerator: () => `mfa-login:${email}`,
      onLimitReached: async () => {
        // Escalate repeated failures
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        })

        if (user) {
          await AccountSecurity.escalateSecurityEvent(user.id, "MFA_LOGIN_RATE_LIMITED", {
            email,
            ipAddress,
            timestamp: new Date().toISOString(),
          })
        }
      },
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter?.toString() || "900",
            "Cache-Control": "no-store",
          },
        }
      )
    }

    // Verify session token (from first auth step)
    // In production, this would validate against a temporary session store
    // For now, we'll validate the user exists and has MFA enabled
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        mfaEnabled: true,
        lockedUntil: true,
      },
    })

    if (!user || !user.mfaEnabled) {
      // Log suspicious attempt
      await AccountSecurity.recordLoginAttempt({
        email,
        success: false,
        ipAddress,
        userAgent,
        reason: "MFA verification attempted for invalid account",
      })

      return NextResponse.json(
        { error: "Authentication failed" }, // Generic
        { status: 401 }
      )
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Account temporarily unavailable" }, // Generic
        { status: 403 }
      )
    }

    let verificationResult: { success: boolean; reason?: string }

    // Determine if it's a TOTP code or backup code
    if (code.length === 6 && /^\d+$/.test(code)) {
      // TOTP code
      verificationResult = await MFAService.verifyTOTP(user.id, code, ipAddress)
    } else if (code.length === 8) {
      // Backup code
      verificationResult = await MFAService.verifyBackupCode(user.id, code, ipAddress, userAgent)
    } else {
      verificationResult = { success: false, reason: "Invalid code format" }
    }

    if (!verificationResult.success) {
      // Log failed attempt
      await AccountSecurity.recordLoginAttempt({
        email,
        success: false,
        ipAddress,
        userAgent,
        reason: `MFA verification failed: ${verificationResult.reason}`,
      })

      // Check for suspicious patterns
      const suspiciousActivity = await AccountSecurity.detectSuspiciousActivity(
        user.id,
        ipAddress || "unknown"
      )

      if (suspiciousActivity.suspicious) {
        await AccountSecurity.escalateSecurityEvent(user.id, "SUSPICIOUS_MFA_ACTIVITY", {
          reasons: suspiciousActivity.reasons,
          ipAddress,
          timestamp: new Date().toISOString(),
        })
      }

      return NextResponse.json(
        { error: "Authentication failed" }, // Always generic
        { status: 401 }
      )
    }

    // Success - log it
    await AccountSecurity.recordLoginAttempt({
      email,
      success: true,
      ipAddress,
      userAgent,
      reason: "MFA verification successful",
    })

    // Generate auth token (this would integrate with NextAuth)
    // For now, return success indicator
    const response = NextResponse.json({
      success: true,
      // In production, return a session token here
      message: "Authentication successful",
    })

    // Security headers
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("X-Content-Type-Options", "nosniff")

    return response
  } catch (error) {
    log.error("MFA verification error", error as Error, {
      operation: "mfa_login_verification",
    })

    // Log error internally
    await prisma.auditLog.create({
      data: {
        action: "MFA_VERIFICATION_ERROR",
        resource: "auth",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json(
      { error: "Authentication failed" }, // Always generic
      { status: 500 }
    )
  }
}
