import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { CSRFProtection } from '@/lib/security/csrf'
import { cookies } from 'next/headers'

// GET - Retrieve current CSRF token
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const token = await getToken({ 
      req: request as any, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    if (!session || !token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if we have an existing valid token in cookies
    const existingToken = request.cookies.get('csrf-token')?.value
    
    if (existingToken && CSRFProtection.verifyToken(existingToken, token.id as string)) {
      // Extract the token data to get expiry
      const [payloadBase64] = existingToken.split('.')
      const payload = Buffer.from(payloadBase64, 'base64').toString()
      const tokenData = JSON.parse(payload)
      
      return NextResponse.json({
        token: existingToken,
        expiresAt: tokenData.timestamp + (24 * 60 * 60 * 1000), // 24 hours from creation
      })
    }

    // Generate new token
    const csrfToken = CSRFProtection.generateToken(token.id as string)
    const signedToken = CSRFProtection.signToken(csrfToken)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('csrf-token', signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    return NextResponse.json({
      token: signedToken,
      expiresAt: csrfToken.timestamp + (24 * 60 * 60 * 1000),
    })
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Refresh CSRF token
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const token = await getToken({ 
      req: request as any, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    if (!session || !token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Generate new token
    const csrfToken = CSRFProtection.generateToken(token.id as string)
    const signedToken = CSRFProtection.signToken(csrfToken)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('csrf-token', signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    return NextResponse.json({
      token: signedToken,
      expiresAt: csrfToken.timestamp + (24 * 60 * 60 * 1000),
    })
  } catch (error) {
    console.error('CSRF token refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}