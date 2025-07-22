import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { HubSpotClient } from "@/lib/api/hubspot/client"
import { prisma } from "@/lib/db"
import { log } from "@/lib/logger"
import { CorrelationTracking } from "@/lib/security/correlation"

export async function GET(request: NextRequest) {
  const correlationId = await CorrelationTracking.getCorrelationId()

  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await log.info("Fetching all HubSpot lists", {
      userId: session.user.id,
      correlationId,
      operation: "lists_fetch_all"
    })

    // Initialize HubSpot client
    const hubspotClient = new HubSpotClient()

    // Fetch all lists from HubSpot
    const listsResponse = await hubspotClient.getAllLists(250) // Get up to 250 lists

    // Transform the response to include proper types
    // HubSpot Lists API v1 uses 'metaData.size' for member count
    const lists = listsResponse.lists.map(list => ({
      listId: list.listId,
      name: list.name,
      listType: list.listType,
      membershipCount: (list as any).metaData?.size || (list as any).size || list.membershipCount || 0,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    }))

    // Get latest snapshot data from database for trend calculation
    const latestSnapshots = await prisma.listSnapshot.findMany({
      where: {
        listId: {
          in: lists.map(l => l.listId)
        }
      },
      orderBy: {
        snapshotDate: 'desc'
      },
      distinct: ['listId'],
    })

    // Create a map for quick lookup
    const snapshotMap = new Map(
      latestSnapshots.map(s => [s.listId, s.memberCount])
    )

    // Calculate trends
    const listsWithTrends = lists.map(list => {
      const previousCount = snapshotMap.get(list.listId)
      const trend = previousCount !== undefined && previousCount > 0
        ? ((list.membershipCount - previousCount) / previousCount) * 100
        : null

      return {
        ...list,
        previousCount,
        trend,
      }
    })

    // Update metadata for all lists
    const metadataUpdates = lists.map(list => 
      prisma.listMetadata.upsert({
        where: { listId: list.listId },
        update: {
          listName: list.name,
          listType: list.listType,
          updatedAt: new Date(),
        },
        create: {
          listId: list.listId,
          listName: list.name,
          listType: list.listType,
        }
      })
    )

    await Promise.all(metadataUpdates)

    await log.info("Successfully fetched all lists", {
      userId: session.user.id,
      listCount: lists.length,
      correlationId,
      operation: "lists_fetch_all_success"
    })

    return NextResponse.json({
      success: true,
      data: {
        lists: listsWithTrends,
        total: listsResponse.total || lists.length,
        hasMore: listsResponse.hasMore || false,
      }
    })

  } catch (error) {
    await log.error("Error fetching lists", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
      operation: "lists_fetch_all_error"
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch lists",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}