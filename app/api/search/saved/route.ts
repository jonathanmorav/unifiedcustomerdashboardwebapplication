import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { defaultSearchTemplates } from "@/lib/search/search-templates"
import { log } from "@/lib/logger"

// Request validation schema for creating saved search
const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  searchParams: z.object({
    searchTerm: z.string(),
    searchType: z.enum(["email", "name", "business_name", "dwolla_id", "auto"]).optional(),
    filters: z.any().optional(),
    sort: z.any().optional(),
    pagination: z.any().optional(),
  }),
  isPublic: z.boolean().default(false),
})

// GET: Fetch saved searches for the user
export async function GET(request: NextRequest) {
  let session: any
  try {
    // Check authentication
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeTemplates = searchParams.get("includeTemplates") === "true"
    const includePublic = searchParams.get("includePublic") === "true"

    // Build query conditions
    const conditions = []
    conditions.push({ userId: session.user.id })

    if (includePublic) {
      conditions.push({ isPublic: true })
    }

    // Fetch saved searches
    const savedSearches = await prisma.savedSearch.findMany({
      where: {
        OR: conditions,
      },
      orderBy: [{ isTemplate: "desc" }, { lastUsed: "desc" }, { createdAt: "desc" }],
    })

    // Include templates if requested
    let results = savedSearches
    if (includeTemplates) {
      // Convert templates to saved search format
      const templates = defaultSearchTemplates.map((template) => ({
        id: template.id,
        userId: "system",
        name: template.name,
        description: template.description || null,
        searchParams: template.searchParams as any,
        useCount: 0,
        lastUsed: null,
        isTemplate: true,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
      results = [...templates, ...savedSearches]
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    log.error("Fetch saved searches error", error as Error, {
      userId: session?.user?.id,
      operation: "fetch_saved_searches",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a new saved search
export async function POST(request: NextRequest) {
  let session: any
  try {
    // Check authentication
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = createSavedSearchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, searchParams, isPublic } = validation.data

    // Check if user already has a saved search with this name
    const existing = await prisma.savedSearch.findUnique({
      where: {
        userId_name: {
          userId: session.user.id,
          name,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A saved search with this name already exists" },
        { status: 409 }
      )
    }

    // Create the saved search
    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: session.user.id,
        name,
        description,
        searchParams: searchParams as any,
        isPublic,
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SAVED_SEARCH_CREATED",
        resource: "saved_search",
        resourceId: savedSearch.id,
        metadata: { name, isPublic },
      },
    })

    return NextResponse.json({
      success: true,
      data: savedSearch,
    })
  } catch (error) {
    log.error("Create saved search error", error as Error, {
      userId: session?.user?.id,
      operation: "create_saved_search",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: Update a saved search
export async function PATCH(request: NextRequest) {
  let session: any
  let id: string | null = null
  try {
    // Check authentication
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Search ID required" }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const { name, description, isPublic } = body

    // Fetch the saved search
    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id },
    })

    if (!savedSearch) {
      return NextResponse.json({ error: "Saved search not found" }, { status: 404 })
    }

    // Check ownership
    if (savedSearch.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Don't allow editing templates
    if (savedSearch.isTemplate) {
      return NextResponse.json({ error: "Cannot edit templates" }, { status: 403 })
    }

    // Update the saved search
    const updated = await prisma.savedSearch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SAVED_SEARCH_UPDATED",
        resource: "saved_search",
        resourceId: id,
        metadata: { name, description, isPublic },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    log.error("Update saved search error", error as Error, {
      userId: session?.user?.id,
      searchId: id,
      operation: "update_saved_search",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a saved search
export async function DELETE(request: NextRequest) {
  let session: any
  let id: string | null = null
  try {
    // Check authentication
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Search ID required" }, { status: 400 })
    }

    // Fetch the saved search
    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id },
    })

    if (!savedSearch) {
      return NextResponse.json({ error: "Saved search not found" }, { status: 404 })
    }

    // Check ownership
    if (savedSearch.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Don't allow deleting templates
    if (savedSearch.isTemplate) {
      return NextResponse.json({ error: "Cannot delete templates" }, { status: 403 })
    }

    // Delete the saved search
    await prisma.savedSearch.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SAVED_SEARCH_DELETED",
        resource: "saved_search",
        resourceId: id,
        metadata: { name: savedSearch.name },
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    log.error("Delete saved search error", error as Error, {
      userId: session?.user?.id,
      searchId: id,
      operation: "delete_saved_search",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
