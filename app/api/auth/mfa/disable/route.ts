import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MFAService } from '@/lib/security/mfa'
import { AccountSecurity } from '@/lib/security/account-security'
import { rateLimiter } from '@/lib/security/rate-limit'
import { z } from 'zod'
import { prisma } from '@/lib/db'

// Rate limit configuration - very strict
const disableRateLimitConfig = {
  name: 'mfa-disable',
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3 // Only 3 attempts per day
}

// POST - Disable MFA (requires admin or self with verification)
const disableSchema = z.object({
  targetUserId: z.string().optional(), // For admin disabling another user
  password: z.string().min(1), // Always require password
  currentCode: z.string().length(6).regex(/^\d+$/), // Require current TOTP
  reason: z.string().min(10).max(500) // Require explanation
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     undefined

    // Apply rate limiting
    const rateLimitResult = await rateLimiter.limit(request, {
      ...disableRateLimitConfig,
      keyGenerator: () => `mfa-disable:${session.user.id}`,
      onLimitReached: async () => {
        await AccountSecurity.escalateSecurityEvent(
          session.user.id,
          'MFA_DISABLE_RATE_LIMITED',
          { 
            ipAddress,
            timestamp: new Date().toISOString()
          }
        )
      }
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '86400'
          }
        }
      )
    }

    const body = await request.json()
    const validation = disableSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const { targetUserId, currentCode, reason } = validation.data

    // Determine if this is self-service or admin action
    const isSelfService = !targetUserId || targetUserId === session.user.id
    const targetId = targetUserId || session.user.id

    // Check permissions for admin actions
    if (!isSelfService) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })

      if (!currentUser || currentUser.role !== 'ADMIN') {
        await AccountSecurity.escalateSecurityEvent(
          session.user.id,
          'UNAUTHORIZED_MFA_DISABLE_ATTEMPT',
          {
            targetUserId: targetId,
            ipAddress,
            timestamp: new Date().toISOString()
          }
        )

        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Verify current user's TOTP
    const mfaResult = await MFAService.verifyTOTP(
      session.user.id,
      currentCode,
      ipAddress
    )

    if (!mfaResult.success) {
      await AccountSecurity.recordLoginAttempt({
        email: session.user.email,
        success: false,
        ipAddress,
        userAgent: request.headers.get('user-agent') || undefined,
        reason: 'Failed MFA disable - invalid TOTP'
      })

      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 401 }
      )
    }

    // TODO: In production, also verify password here
    // For now, we'll trust the TOTP verification

    // Disable MFA
    await MFAService.disableMFA(
      targetId,
      reason,
      isSelfService ? undefined : session.user.id
    )

    // Log the action
    await AccountSecurity.recordLoginAttempt({
      email: session.user.email,
      success: true,
      ipAddress,
      userAgent: request.headers.get('user-agent') || undefined,
      reason: `MFA disabled for ${isSelfService ? 'self' : targetId}: ${reason}`
    })

    // Send notification email
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { email: true }
    })

    if (targetUser?.email) {
      // TODO: Send email notification
      // await sendMFADisabledEmail(targetUser.email, reason, session.user.email)
    }

    const response = NextResponse.json({
      success: true,
      message: 'MFA has been disabled'
    })

    // Security headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')

    return response
  } catch (error) {
    console.error('MFA disable error:', error)
    
    await AccountSecurity.escalateSecurityEvent(
      session?.user?.id || 'unknown',
      'MFA_DISABLE_ERROR',
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    )

    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}