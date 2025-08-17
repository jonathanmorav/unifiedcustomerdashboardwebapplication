import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"

// Schema for updating mappings
const updateMappingSchema = z.object({
  productName: z.string().min(1).optional(),
  productCode: z.string().nullable().optional(),
  carrierName: z.string().min(1).optional(),
  carrierCode: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// PUT - Update carrier mapping
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const validatedData = updateMappingSchema.parse(body)

    // Check if mapping exists
    const existing = await prisma.carrierMapping.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
    }

    // If productName is being changed, check for duplicates
    if (validatedData.productName && validatedData.productName !== existing.productName) {
      const duplicate = await prisma.carrierMapping.findUnique({
        where: { productName: validatedData.productName },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A mapping already exists for this product" },
          { status: 400 }
        )
      }
    }

    // Update mapping
    const mapping = await prisma.carrierMapping.update({
      where: { id },
      data: validatedData,
    })

    logger.info("Carrier mapping updated", {
      userId: session.user.id,
      mappingId: mapping.id,
      productName: mapping.productName,
      carrierName: mapping.carrierName,
    })

    return NextResponse.json({ mapping })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error updating carrier mapping", error as Error)
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 })
  }
}

// DELETE - Delete carrier mapping
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params

    // Check if mapping exists
    const existing = await prisma.carrierMapping.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
    }

    // Delete mapping
    await prisma.carrierMapping.delete({
      where: { id },
    })

    logger.info("Carrier mapping deleted", {
      userId: session.user.id,
      mappingId: id,
      productName: existing.productName,
      carrierName: existing.carrierName,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error deleting carrier mapping", error as Error)
    return NextResponse.json({ error: "Failed to delete mapping" }, { status: 500 })
  }
}