import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { MFAService } from "@/lib/security/mfa"

// GET - Get MFA status for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const status = await MFAService.getMFAStatus(session.user.id)

    if (!status) {
      return NextResponse.json({ error: "Unable to retrieve status" }, { status: 500 })
    }

    const response = NextResponse.json({
      enabled: status.enabled,
      required: status.required,
      backupCodesRemaining: status.backupCodesRemaining,
      lowBackupCodes: status.backupCodesRemaining < 3,
      // Never expose enforcement date to prevent timing attacks
      configured: status.enabled,
    })

    // Allow some caching for performance, but keep it short
    response.headers.set("Cache-Control", "private, max-age=30")
    response.headers.set("X-Content-Type-Options", "nosniff")

    return response
  } catch (error) {
    console.error("MFA status error:", error)

    return NextResponse.json({ error: "Unable to retrieve status" }, { status: 500 })
  }
}
