import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"

// Schema for creating/updating mappings
const mappingSchema = z.object({
  productName: z.string().min(1),
  productCode: z.string().optional(),
  carrierName: z.string().min(1),
  carrierCode: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

// GET - Fetch all carrier mappings
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const mappings = await prisma.carrierMapping.findMany({
      orderBy: [
        { carrierName: "asc" },
        { productName: "asc" }
      ],
    })

    logger.info("Carrier mappings fetched", {
      userId: session.user.id,
      count: mappings.length,
    })

    return NextResponse.json({ mappings })
  } catch (error) {
    logger.error("Error fetching carrier mappings", error as Error)
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 })
  }
}

// POST - Create new carrier mapping
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = mappingSchema.parse(body)

    // Check if mapping already exists for this product
    const existing = await prisma.carrierMapping.findUnique({
      where: { productName: validatedData.productName },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A mapping already exists for this product" },
        { status: 400 }
      )
    }

    // Create new mapping
    const mapping = await prisma.carrierMapping.create({
      data: validatedData,
    })

    logger.info("Carrier mapping created", {
      userId: session.user.id,
      mappingId: mapping.id,
      productName: mapping.productName,
      carrierName: mapping.carrierName,
    })

    return NextResponse.json({ mapping }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error creating carrier mapping", error as Error)
    return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 })
  }
}