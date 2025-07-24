import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const listId = searchParams.get("listId")
    const days = parseInt(searchParams.get("days") || "30")

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    await log.info("Fetching list history", {
      userId: session.user.id,
      listId,
      days,
      correlationId,
      operation: "lists_history_fetch",
    })

    // Build query
    const whereClause: any = {
      snapshotDate: {
        gte: startDate,
      },
    }

    if (listId) {
      whereClause.listId = parseInt(listId)
    }

    // Fetch historical snapshots
    const snapshots = await prisma.listSnapshot.findMany({
      where: whereClause,
      orderBy: {
        snapshotDate: "asc",
      },
      select: {
        listId: true,
        listName: true,
        listType: true,
        memberCount: true,
        snapshotDate: true,
      },
    })

    // Group by listId for easier consumption
    const historyByList = snapshots.reduce((acc: any, snapshot) => {
      if (!acc[snapshot.listId]) {
        acc[snapshot.listId] = {
          listId: snapshot.listId,
          listName: snapshot.listName,
          listType: snapshot.listType,
          history: [],
        }
      }

      acc[snapshot.listId].history.push({
        date: snapshot.snapshotDate.toISOString(),
        memberCount: snapshot.memberCount,
      })

      return acc
    }, {})

    // Convert to array and calculate trends
    const listsWithHistory = Object.values(historyByList).map((list: any) => {
      const history = list.history
      const firstValue = history[0]?.memberCount || 0
      const lastValue = history[history.length - 1]?.memberCount || 0
      const trend = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0

      return {
        ...list,
        trend,
        currentCount: lastValue,
        startCount: firstValue,
      }
    })

    await log.info("Successfully fetched list history", {
      userId: session.user.id,
      listCount: listsWithHistory.length,
      totalSnapshots: snapshots.length,
      correlationId,
      operation: "lists_history_fetch_success",
    })

    return NextResponse.json({
      success: true,
      data: {
        lists: listsWithHistory,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          days,
        },
      },
    })
  } catch (error) {
    await log.error("Error fetching list history", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
      operation: "lists_history_fetch_error",
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch list history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
