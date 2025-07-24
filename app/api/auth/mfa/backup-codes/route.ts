import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { MFAService } from "@/lib/security/mfa"
import { AccountSecurity } from "@/lib/security/account-security"
import { PasswordService } from "@/lib/security/password"
import { rateLimiter } from "@/lib/security/rate-limit"
import { z } from "zod"

// Rate limit configuration
const backupCodesRateLimitConfig = {
  name: "mfa-backup-codes",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 regenerations per hour
}

// POST - Regenerate backup codes
const regenerateSchema = z.object({
  password: z.string().min(1), // Require password for sensitive operation
  currentCode: z.string().length(6).regex(/^\d+$/), // Require current TOTP
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined

    // Apply rate limiting
    const rateLimitResult = await rateLimiter.limit(request, {
      ...backupCodesRateLimitConfig,
      keyGenerator: () => `backup-codes:${session.user.id}`,
      onLimitReached: async () => {
        await AccountSecurity.escalateSecurityEvent(session.user.id, "BACKUP_CODES_RATE_LIMITED", {
          ipAddress,
          timestamp: new Date().toISOString(),
        })
      },
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter?.toString() || "3600",
          },
        }
      )
    }

    const body = await request.json()
    const validation = regenerateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // Verify current TOTP code
    const mfaResult = await MFAService.verifyTOTP(
      session.user.id,
      validation.data.currentCode,
      ipAddress
    )

    if (!mfaResult.success) {
      await AccountSecurity.recordLoginAttempt({
        email: session.user.email,
        success: false,
        ipAddress,
        userAgent: request.headers.get("user-agent") || undefined,
        reason: "Failed backup code regeneration - invalid TOTP",
      })

      return NextResponse.json({ error: "Verification failed" }, { status: 401 })
    }

    // Verify password for sensitive operation
    const passwordResult = await PasswordService.verifyUserPassword(
      session.user.id,
      validation.data.password,
      ipAddress,
      request.headers.get("user-agent") || undefined
    )

    if (!passwordResult.success) {
      await AccountSecurity.recordLoginAttempt({
        email: session.user.email,
        success: false,
        ipAddress,
        userAgent: request.headers.get("user-agent") || undefined,
        reason: "Failed backup code regeneration - invalid password",
      })

      return NextResponse.json({ error: "Verification failed" }, { status: 401 })
    }

    // Generate new backup codes
    const newCodes = await MFAService.regenerateBackupCodes(session.user.id)

    // Log successful regeneration
    await AccountSecurity.recordLoginAttempt({
      email: session.user.email,
      success: true,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
      reason: "Backup codes regenerated successfully",
    })

    const response = NextResponse.json({
      backupCodes: newCodes,
      warning: "Save these backup codes in a secure location. They will not be shown again.",
      remainingCodes: newCodes.length,
    })

    // Security headers
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    response.headers.set("Pragma", "no-cache")

    return response
  } catch (error) {
    console.error("Backup codes regeneration error:", error)

    await AccountSecurity.escalateSecurityEvent(
      session?.user?.id || "unknown",
      "BACKUP_CODES_ERROR",
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }
    )

    return NextResponse.json({ error: "Operation failed" }, { status: 500 })
  }
}

// GET - Get backup codes status (not the codes themselves)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const status = await MFAService.getMFAStatus(session.user.id)

    if (!status || !status.enabled) {
      return NextResponse.json({ error: "MFA not configured" }, { status: 400 })
    }

    const response = NextResponse.json({
      remainingCodes: status.backupCodesRemaining,
      lowBackupCodes: status.backupCodesRemaining < 3,
      lastRegenerated: null, // We don't track this yet, but could add it
    })

    response.headers.set("Cache-Control", "private, max-age=0")

    return response
  } catch (error) {
    console.error("Backup codes status error:", error)

    return NextResponse.json({ error: "Operation failed" }, { status: 500 })
  }
}
