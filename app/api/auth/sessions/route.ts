import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import { authOptions } from "@/lib/auth"
import { SessionManagement } from "@/lib/security/session-management"
import { z } from "zod"
import { log } from "@/lib/logger"

// GET - Get all active sessions for the current user
export async function GET(request: NextRequest) {
  let session: any = null
  try {
    session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const sessions = await SessionManagement.getActiveSessions(session.user.id)

    // Get current session token to mark it
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Mark current session
    const currentSessionId = token?.jti || token?.sub // Session ID from JWT

    const sessionsWithCurrent = sessions.map((s) => ({
      ...s,
      current: s.id === currentSessionId,
    }))

    const response = NextResponse.json({
      sessions: sessionsWithCurrent,
      total: sessions.length,
      limit: 3, // Concurrent session limit
    })

    response.headers.set("Cache-Control", "private, max-age=0")

    return response
  } catch (error) {
    log.error("Get sessions error", error as Error, {
      userId: session?.user?.id,
      operation: "get_sessions",
    })

    return NextResponse.json({ error: "Unable to retrieve sessions" }, { status: 500 })
  }
}

// DELETE - Revoke a session or all sessions
const revokeSchema = z.object({
  sessionId: z.string().optional(),
  revokeAll: z.boolean().optional(),
})

export async function DELETE(request: NextRequest) {
  let session: any
  try {
    session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const validation = revokeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const { sessionId, revokeAll } = validation.data
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })
    const currentSessionId = token?.jti || token?.sub

    let revokedCount = 0

    if (revokeAll) {
      // Revoke all sessions except current
      revokedCount = await SessionManagement.revokeAllSessions(session.user.id, currentSessionId as string)
    } else if (sessionId) {
      // Prevent revoking current session
      if (sessionId === currentSessionId) {
        return NextResponse.json({ error: "Cannot revoke current session" }, { status: 400 })
      }

      await SessionManagement.revokeSession(session.user.id, sessionId, session.user.id)
      revokedCount = 1
    } else {
      return NextResponse.json({ error: "No action specified" }, { status: 400 })
    }

    const response = NextResponse.json({
      success: true,
      revokedCount,
      message: revokeAll ? `Revoked ${revokedCount} session(s)` : "Session revoked successfully",
    })

    response.headers.set("Cache-Control", "no-store")

    return response
  } catch (error) {
    log.error("Revoke session error", error as Error, {
      userId: session?.user?.id,
      operation: "revoke_session",
    })

    return NextResponse.json({ error: "Operation failed" }, { status: 500 })
  }
}
