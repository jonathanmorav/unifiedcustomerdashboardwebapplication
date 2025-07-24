import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { HubSpotClient } from "@/lib/api/hubspot/client"
import { prisma } from "@/lib/db"
import { log } from "@/lib/logger"
import { CorrelationTracking } from "@/lib/security/correlation"

export async function POST(request: NextRequest) {
  const correlationId = await CorrelationTracking.getCorrelationId()

  try {
    // Check authentication - in production, you might want to restrict this to admin users
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await log.info("Starting list snapshot collection", {
      userId: session.user.id,
      correlationId,
      operation: "lists_snapshot_start",
    })

    // Initialize HubSpot client
    const hubspotClient = new HubSpotClient()

    // Fetch all lists from HubSpot
    const listsResponse = await hubspotClient.getAllLists(250)

    // Prepare snapshot data
    const now = new Date()
    const snapshots = listsResponse.lists.map((list) => ({
      listId: list.listId,
      listName: list.name,
      listType: list.listType,
      memberCount: (list as any).metaData?.size || (list as any).size || list.membershipCount || 0,
      snapshotDate: now,
    }))

    // Delete today's existing snapshots to avoid duplicates
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    await prisma.listSnapshot.deleteMany({
      where: {
        snapshotDate: {
          gte: startOfToday,
        },
      },
    })

    // Create new snapshots
    const createdSnapshots = await prisma.listSnapshot.createMany({
      data: snapshots,
      skipDuplicates: true,
    })

    // Update metadata with last snapshot date
    const metadataUpdates = listsResponse.lists.map((list) =>
      prisma.listMetadata.upsert({
        where: { listId: list.listId },
        update: {
          listName: list.name,
          listType: list.listType,
          lastSnapshotDate: now,
          updatedAt: new Date(),
        },
        create: {
          listId: list.listId,
          listName: list.name,
          listType: list.listType,
          lastSnapshotDate: now,
        },
      })
    )

    await Promise.all(metadataUpdates)

    // Clean up old snapshots (keep 90 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)

    const deletedCount = await prisma.listSnapshot.deleteMany({
      where: {
        snapshotDate: {
          lt: cutoffDate,
        },
      },
    })

    await log.info("List snapshot collection completed", {
      userId: session.user.id,
      snapshotsCreated: createdSnapshots.count,
      oldSnapshotsDeleted: deletedCount.count,
      correlationId,
      operation: "lists_snapshot_success",
    })

    return NextResponse.json({
      success: true,
      data: {
        snapshotsCreated: createdSnapshots.count,
        listsProcessed: snapshots.length,
        oldSnapshotsDeleted: deletedCount.count,
        snapshotDate: now.toISOString(),
      },
    })
  } catch (error) {
    await log.error("Error collecting list snapshots", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
      operation: "lists_snapshot_error",
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to collect list snapshots",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check last snapshot time
export async function GET(request: NextRequest) {
  const correlationId = await CorrelationTracking.getCorrelationId()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the most recent snapshot
    const lastSnapshot = await prisma.listSnapshot.findFirst({
      orderBy: {
        snapshotDate: "desc",
      },
      select: {
        snapshotDate: true,
      },
    })

    // Get count of lists with snapshots today
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const todayCount = await prisma.listSnapshot.count({
      where: {
        snapshotDate: {
          gte: startOfToday,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        lastSnapshotDate: lastSnapshot?.snapshotDate || null,
        snapshotsToday: todayCount,
        nextSnapshotDue: lastSnapshot
          ? new Date(lastSnapshot.snapshotDate.getTime() + 24 * 60 * 60 * 1000)
          : new Date(),
      },
    })
  } catch (error) {
    await log.error("Error checking snapshot status", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
      operation: "lists_snapshot_status_error",
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check snapshot status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
