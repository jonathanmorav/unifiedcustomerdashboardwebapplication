import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { csrfMiddleware } from "@/lib/security/middleware/csrf-middleware"
import { rateLimitMiddleware } from "@/lib/security/middleware/rate-limit-middleware"
import crypto from "crypto"

export default withAuth(
  async function middleware(req) {
    // Apply rate limiting
    const rateLimitResponse = await rateLimitMiddleware(req)
    if (rateLimitResponse.status === 429) {
      return rateLimitResponse
    }

    // Apply CSRF protection for state-changing requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      const csrfResponse = await csrfMiddleware(req)
      if (csrfResponse.status !== 200) {
        return csrfResponse
      }
    }

    // Check session health for protected routes
    if (req.nextUrl.pathname.startsWith('/dashboard') || 
        req.nextUrl.pathname.startsWith('/api/')) {
      // Session health checks would be performed here
      // For now, we rely on NextAuth's session validation
    }

    // Generate request ID and correlation ID
    const requestId = crypto.randomUUID()
    const correlationId = req.headers.get("X-Correlation-ID") || crypto.randomUUID()

    // Add security headers
    const headers = new Headers(req.headers)
    headers.set("X-Frame-Options", "DENY")
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("X-XSS-Protection", "1; mode=block")
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    headers.set("X-Request-ID", requestId)
    headers.set("X-Correlation-ID", correlationId)
    
    // HSTS - Enforce HTTPS for 1 year with preload and subdomains
    if (process.env.NODE_ENV === "production") {
      headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
      )
    }
    
    // Additional security headers
    headers.set("X-Permitted-Cross-Domain-Policies", "none")
    headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    headers.set("X-DNS-Prefetch-Control", "off")

    if (process.env.ENABLE_SECURITY_HEADERS === "true") {
      // Enhanced CSP with report URI
      const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.hubapi.com https://api-sandbox.dwolla.com https://api.dwolla.com",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        process.env.CSP_REPORT_URI ? `report-uri ${process.env.CSP_REPORT_URI}` : ""
      ].filter(Boolean).join("; ")
      
      headers.set("Content-Security-Policy", cspDirectives)
    }

    const response = NextResponse.next({
      request: {
        headers,
      },
    })

    // Add request ID to response headers for correlation
    response.headers.set("X-Request-ID", requestId)
    response.headers.set("X-Correlation-ID", correlationId)

    return response
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    // Protected routes
    "/dashboard/:path*",
    "/api/hubspot/:path*",
    "/api/dwolla/:path*",
    "/api/search/:path*",
    "/api/export/:path*",
    // Skip auth routes and static files
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
