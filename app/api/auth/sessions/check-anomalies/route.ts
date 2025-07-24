import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SessionManagement } from "@/lib/security/session-management"
import { AccountSecurity } from "@/lib/security/account-security"

// POST - Check for session anomalies (called during login or periodically)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const acceptLanguage = request.headers.get("accept-language")
    const acceptEncoding = request.headers.get("accept-encoding")

    // Create device fingerprint
    const fingerprint = SessionManagement.createDeviceFingerprint(
      userAgent,
      acceptLanguage || undefined,
      acceptEncoding || undefined
    )

    // Check for anomalies
    const anomalies = await SessionManagement.detectSessionAnomalies(session.user.id, {
      fingerprint,
      userAgent,
      ipAddress,
      lastSeen: new Date(),
    })

    // Handle high-severity anomalies
    if (anomalies.some((a) => a.severity === "high")) {
      await SessionManagement.handleSessionAnomalies(session.user.id, anomalies)

      // For high-severity anomalies, require MFA re-verification
      return NextResponse.json(
        {
          anomalies: anomalies.map((a) => ({
            type: a.type,
            severity: a.severity,
            description: a.description,
          })),
          requiresMFA: true,
          action: "verify_identity",
        },
        { status: 403 }
      )
    }

    // Log medium/low severity anomalies but allow continuation
    if (anomalies.length > 0) {
      await SessionManagement.handleSessionAnomalies(session.user.id, anomalies)
    }

    // Check and enforce session limits
    await SessionManagement.enforceSessionLimits(session.user.id)

    const response = NextResponse.json({
      anomalies: anomalies.map((a) => ({
        type: a.type,
        severity: a.severity,
        description: a.description,
      })),
      requiresMFA: false,
      sessionHealth: "healthy",
    })

    response.headers.set("Cache-Control", "no-store")

    return response
  } catch (error) {
    console.error("Session anomaly check error:", error)

    // Log error but don't expose details
    if (session?.user?.id) {
      await AccountSecurity.escalateSecurityEvent(session.user.id, "SESSION_ANOMALY_CHECK_ERROR", {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: "Security check failed" }, { status: 500 })
  }
}
