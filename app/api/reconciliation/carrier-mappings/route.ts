import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"

// Schema for creating/updating carrier mapping
const carrierMappingSchema = z.object({
  productName: z.string().min(1),
  productCode: z.string().optional(),
  carrierName: z.string().min(1),
  carrierCode: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

// Bulk import schema
const bulkImportSchema = z.object({
  mappings: z.array(carrierMappingSchema),
})

// GET - Fetch all carrier mappings
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const isActive = searchParams.get("active")

    const where: any = {}
    if (isActive !== null) {
      where.isActive = isActive === "true"
    }

    const mappings = await prisma.carrierMapping.findMany({
      where,
      orderBy: [
        { carrierName: "asc" },
        { productName: "asc" }
      ],
    })

    // Group by carrier for easier UI display
    const groupedMappings = mappings.reduce((acc: any, mapping) => {
      if (!acc[mapping.carrierName]) {
        acc[mapping.carrierName] = []
      }
      acc[mapping.carrierName].push(mapping)
      return acc
    }, {})

    return NextResponse.json({
      mappings,
      groupedMappings,
      totalCount: mappings.length,
      carriers: Object.keys(groupedMappings),
    })
  } catch (error) {
    logger.error("Error fetching carrier mappings", error as Error)
    return NextResponse.json({ error: "Failed to fetch carrier mappings" }, { status: 500 })
  }
}

// POST - Create new carrier mapping or bulk import
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Check if it's a bulk import
    if (body.mappings && Array.isArray(body.mappings)) {
      const validatedData = bulkImportSchema.parse(body)
      
      // Use transaction for bulk import
      const result = await prisma.$transaction(async (tx) => {
        const created = []
        const skipped = []
        
        for (const mapping of validatedData.mappings) {
          // Check if mapping already exists
          const existing = await tx.carrierMapping.findUnique({
            where: { productName: mapping.productName }
          })
          
          if (existing) {
            skipped.push(mapping.productName)
          } else {
            const newMapping = await tx.carrierMapping.create({
              data: mapping
            })
            created.push(newMapping)
          }
        }
        
        return { created, skipped }
      })

      logger.info("Bulk carrier mappings import", {
        userId: session.user.id,
        created: result.created.length,
        skipped: result.skipped.length,
      })

      return NextResponse.json({
        message: "Bulk import completed",
        created: result.created.length,
        skipped: result.skipped.length,
        skippedProducts: result.skipped,
      })
    } else {
      // Single mapping creation
      const validatedData = carrierMappingSchema.parse(body)

      // Check if mapping already exists
      const existing = await prisma.carrierMapping.findUnique({
        where: { productName: validatedData.productName }
      })

      if (existing) {
        return NextResponse.json(
          { error: `Mapping for product "${validatedData.productName}" already exists` },
          { status: 409 }
        )
      }

      const mapping = await prisma.carrierMapping.create({
        data: validatedData,
      })

      logger.info("Carrier mapping created", {
        userId: session.user.id,
        mapping: mapping.id,
        productName: mapping.productName,
        carrierName: mapping.carrierName,
      })

      return NextResponse.json(mapping, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error creating carrier mapping", error as Error)
    return NextResponse.json({ error: "Failed to create carrier mapping" }, { status: 500 })
  }
}

// PUT - Update carrier mapping
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Mapping ID is required" }, { status: 400 })
    }

    // Validate update data
    const validatedData = carrierMappingSchema.partial().parse(updateData)

    const mapping = await prisma.carrierMapping.update({
      where: { id },
      data: validatedData,
    })

    logger.info("Carrier mapping updated", {
      userId: session.user.id,
      mapping: mapping.id,
      updates: Object.keys(validatedData),
    })

    return NextResponse.json(mapping)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error updating carrier mapping", error as Error)
    return NextResponse.json({ error: "Failed to update carrier mapping" }, { status: 500 })
  }
}

// DELETE - Delete carrier mapping
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Mapping ID is required" }, { status: 400 })
    }

    await prisma.carrierMapping.delete({
      where: { id },
    })

    logger.info("Carrier mapping deleted", {
      userId: session.user.id,
      mappingId: id,
    })

    return NextResponse.json({ message: "Carrier mapping deleted successfully" })
  } catch (error) {
    logger.error("Error deleting carrier mapping", error as Error)
    return NextResponse.json({ error: "Failed to delete carrier mapping" }, { status: 500 })
  }
}