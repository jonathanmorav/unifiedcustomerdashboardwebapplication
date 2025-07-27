import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { CSRFProtection } from "@/lib/security/csrf"
import { log } from "@/lib/logger-edge"
import { prisma } from "@/lib/db"

export async function csrfMiddleware(request: NextRequest) {
  // Skip CSRF for GET requests and exempt paths
  if (request.method === "GET" || CSRFProtection.isExempt(request)) {
    return NextResponse.next()
  }

  // Check if this is a trusted API client
  if (CSRFProtection.isTrustedAPIClient(request)) {
    // Log API access
    const apiKey = request.headers.get("X-API-Key")
    await logAPIAccess(request, apiKey || "unknown")
    return NextResponse.next()
  }

  // For web requests, verify CSRF token
  const session = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const csrfToken = CSRFProtection.extractToken(request)
  if (!csrfToken) {
    return NextResponse.json({ error: "CSRF token missing" }, { status: 403 })
  }

  const isValid = CSRFProtection.verifyToken(csrfToken, session.id as string)
  if (!isValid) {
    // Log potential CSRF attempt
    await logCSRFViolation(request, session.id as string)

    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  return NextResponse.next()
}

/**
 * Log API access for audit trail
 */
async function logAPIAccess(request: NextRequest, apiKey: string) {
  try {
    await prisma.auditLog.create({
      data: {
        action: "API_ACCESS",
        resource: request.nextUrl.pathname,
        metadata: {
          method: request.method,
          apiKey: apiKey.substring(0, 8) + "...", // Log partial key only
          userAgent: request.headers.get("user-agent"),
          timestamp: new Date().toISOString(),
        },
        ipAddress:
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })
  } catch (error) {
    log.error("Failed to log API access", {
      error: error instanceof Error ? error.message : String(error),
      apiKey: apiKey.substring(0, 8) + "...",
      pathname: request.nextUrl.pathname,
      operation: "api_access_logging",
    })
  }
}

/**
 * Log CSRF violation for security monitoring
 */
async function logCSRFViolation(request: NextRequest, userId: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CSRF_VIOLATION",
        resource: request.nextUrl.pathname,
        metadata: {
          method: request.method,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          userAgent: request.headers.get("user-agent"),
          timestamp: new Date().toISOString(),
        },
        ipAddress:
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })
  } catch (error) {
    log.error("Failed to log CSRF violation", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      pathname: request.nextUrl.pathname,
      operation: "csrf_violation_logging",
    })
  }
}
