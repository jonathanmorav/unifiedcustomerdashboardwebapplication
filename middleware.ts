import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Add security headers
    const headers = new Headers(req.headers)
    headers.set("X-Frame-Options", "DENY")
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("X-XSS-Protection", "1; mode=block")
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

    if (process.env.ENABLE_SECURITY_HEADERS === "true") {
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.hubapi.com https://api-sandbox.dwolla.com https://api.dwolla.com"
      )
    }

    return NextResponse.next({
      request: {
        headers,
      },
    })
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
