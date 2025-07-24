import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST: Track usage of a saved search
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Search ID required" }, { status: 400 })
    }

    // Update the saved search usage stats
    const savedSearch = await prisma.savedSearch.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
        lastUsed: new Date(),
      },
    })

    // Log the usage
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SAVED_SEARCH_USED",
        resource: "saved_search",
        resourceId: id,
        metadata: {
          name: savedSearch.name,
          isTemplate: savedSearch.isTemplate,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: savedSearch,
    })
  } catch (error) {
    console.error("Track saved search usage error:", error)

    // Don't fail if we can't track usage
    return NextResponse.json({
      success: true,
      error: "Failed to track usage",
    })
  }
}
