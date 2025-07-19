import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { CSRFProtection } from '@/lib/security/csrf-edge'
import { log } from '@/lib/logger-edge'

export async function csrfMiddleware(request: NextRequest) {
  // Skip CSRF for GET requests and exempt paths
  if (request.method === 'GET' || CSRFProtection.isExempt(request)) {
    return NextResponse.next()
  }

  // Check if this is a trusted API client
  if (CSRFProtection.isTrustedAPIClient(request)) {
    // Log API access (without database)
    const apiKey = request.headers.get('X-API-Key')
    log.info('API access', {
      apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
      pathname: request.nextUrl.pathname,
      method: request.method,
    })
    return NextResponse.next()
  }

  // Get the session token
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  })

  if (!token?.sub) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Validate CSRF token
  const csrfToken = request.headers.get('X-CSRF-Token') || 
                   request.headers.get('x-csrf-token')

  if (!csrfToken) {
    log.warn('CSRF token missing', {
      userId: token.sub,
      pathname: request.nextUrl.pathname,
      method: request.method
    })
    return NextResponse.json(
      { error: 'CSRF token required' },
      { status: 403 }
    )
  }

  // Verify the token
  const isValid = await CSRFProtection.verifyToken(csrfToken, token.sub)

  if (!isValid) {
    log.warn('CSRF token invalid', {
      userId: token.sub,
      pathname: request.nextUrl.pathname,
      method: request.method
    })
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  return NextResponse.next()
}