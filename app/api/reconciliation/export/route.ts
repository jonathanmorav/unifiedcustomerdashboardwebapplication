import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/db"
import { createHash } from "crypto"
import { z } from "zod"

type CsvCell = string | number | boolean | null | undefined
type CsvRow = Record<string, CsvCell>

type ExportPolicy = {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string | null
  monthlyCost: number
  coverageLevel: string
  carrier?: string | null
}

type ExportSob = {
  sobId?: string | null
  doubleBill?: string | null
  policies?: ExportPolicy[]
} | null

type ExportTransfer = {
  dwollaId: string
  created: string | Date
  amount: number
  status: string
  companyName?: string | null
  customerName?: string | null
  coverageMonth?: string | null
  sob?: ExportSob
} & Record<string, unknown>

type ExportCarrierProduct = {
  productName: string
  totalAmount: number
  policyCount: number
  policies?: ExportPolicy[]
}

type ExportCarrierTotal = {
  carrier?: string | null
  name?: string | null
  totalAmount: number
  policyCount: number
  products?: ExportCarrierProduct[]
  policies?: ExportPolicy[]
} & Record<string, unknown>

type ExportSnapshot = {
  transfers: ExportTransfer[]
}

// Increase body size limit to 10MB for large exports
export const maxDuration = 60 // Maximum allowed duration for Vercel Hobby is 10s, Pro is 60s
export const dynamic = 'force-dynamic'

// Schema for export request
const policySchema = z.object({
  policyId: z.string(),
  policyHolderName: z.string(),
  productName: z.string(),
  planName: z.string().optional().nullable(),
  monthlyCost: z.number(),
  coverageLevel: z.string(),
  carrier: z.string().optional().nullable(),
})

const sobSchema = z
  .object({
    sobId: z.string().optional().nullable(),
    doubleBill: z.string().optional().nullable(),
    policies: z.array(policySchema).optional(),
  })
  .nullable()
  .optional()

const transferSchema = z
  .object({
    dwollaId: z.string(),
    created: z.union([z.string(), z.date()]),
    amount: z.number(),
    status: z.string(),
    companyName: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    coverageMonth: z.string().optional().nullable(),
    sob: sobSchema,
  })
  .passthrough()

const carrierProductSchema = z.object({
  productName: z.string(),
  totalAmount: z.number(),
  policyCount: z.number(),
  policies: z.array(policySchema).optional(),
})

const carrierTotalSchema = z
  .object({
    carrier: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    totalAmount: z.number(),
    policyCount: z.number(),
    products: z.array(carrierProductSchema).optional(),
    policies: z.array(policySchema).optional(),
  })
  .passthrough()

const exportSchema = z.object({
  transfers: z.array(transferSchema),
  carrierTotals: z.union([z.array(carrierTotalSchema), z.record(carrierTotalSchema)]),
  format: z.enum(["csv", "excel"]).optional().default("csv"),
  exportId: z.string().optional(),
  chunkIndex: z.number().int().min(0).optional(),
  totalChunks: z.number().int().min(1).optional(),
})

// Helper to convert to CSV
function convertToCSV(data: CsvRow[]): string {
  if (data.length === 0) return ""

  // Get headers from first object
  const headers = Object.keys(data[0])
  const csvHeaders = headers.join(",")

  // Convert each row
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // Handle values that might contain commas or quotes
      if (typeof value === "string") {
        if (value.includes(",") || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }
      if (value === undefined || value === null) {
        return ""
      }
      return String(value)
    }).join(",")
  })

  return [csvHeaders, ...csvRows].join("\n")
}

type ExportPayload = z.infer<typeof exportSchema>

function splitCsv(csv: string) {
  const lines = csv.split("\n")
  const header = lines.shift() ?? ""
  const body = lines.join("\n")
  return { header, body }
}

function appendCsv(existingCsv: string | null, incomingCsv: string) {
  if (!existingCsv || existingCsv.length === 0) {
    return incomingCsv
  }

  const existing = splitCsv(existingCsv)
  const incoming = splitCsv(incomingCsv)

  if (existing.header && incoming.header && existing.header !== incoming.header) {
    throw new Error("CSV header mismatch during export persistence")
  }

  if (!incoming.body || incoming.body.length === 0) {
    return existingCsv
  }

  const needsNewline = !existingCsv.endsWith("\n")
  return `${existingCsv}${needsNewline ? "\n" : ""}${incoming.body}`
}

function mergeSnapshots(
  existingSnapshot: unknown,
  newTransfers: ExportTransfer[]
): ExportSnapshot {
  const currentSnapshot =
    typeof existingSnapshot === "object" && existingSnapshot !== null
      ? (existingSnapshot as Partial<ExportSnapshot>)
      : undefined

  const existingTransfers: ExportTransfer[] = Array.isArray(currentSnapshot?.transfers)
    ? (currentSnapshot?.transfers as ExportTransfer[])
    : []

  const transferMap = new Map<string, ExportTransfer>()

  for (const transfer of existingTransfers) {
    const key =
      transfer?.dwollaId || (transfer as Record<string, unknown>)?.id?.toString()
    if (key) {
      transferMap.set(key, transfer)
    }
  }

  for (const transfer of newTransfers) {
    const key = transfer.dwollaId
    if (key) {
      transferMap.set(key, transfer)
    }
  }

  return {
    transfers: Array.from(transferMap.values()) as ExportTransfer[],
  }
}

export { persistReconciliationExport }

function normalizeCarrierTotals(
  carrierTotals: ExportPayload["carrierTotals"]
): ExportCarrierTotal[] {
  if (Array.isArray(carrierTotals)) {
    return carrierTotals as ExportCarrierTotal[]
  }
  return Object.values(carrierTotals) as ExportCarrierTotal[]
}

function extractExportMetadata(
  transfers: ExportTransfer[],
  carrierTotals: ExportPayload["carrierTotals"]
) {
  const transferIds = new Set<string>()
  const sobIds = new Set<string>()
  const coverageMonths = new Set<string>()
  let totalPolicies = 0

  for (const transfer of transfers) {
    transferIds.add(transfer.dwollaId)
    if (transfer.sob?.sobId) {
      sobIds.add(transfer.sob.sobId)
    }
    if (transfer.coverageMonth) {
      coverageMonths.add(transfer.coverageMonth)
    }
    totalPolicies += transfer.sob?.policies?.length ?? 0
  }

  const carrierTotalsArray = normalizeCarrierTotals(carrierTotals)

  return {
    transferIds: Array.from(transferIds),
    sobIds: Array.from(sobIds),
    coverageMonths: Array.from(coverageMonths),
    totalPolicies,
    totalTransfers: transfers.length,
    carrierTotals: carrierTotalsArray,
    transfersSnapshot: transfers,
  }
}

async function persistReconciliationExport({
  session,
  validatedData,
  csv,
  allData,
}: {
  session: unknown
  validatedData: ExportPayload
  csv: string
  allData: CsvRow[]
}): Promise<string> {
  const {
    format,
    exportId,
    chunkIndex = 0,
    totalChunks = 1,
  } = validatedData

  const metadata = extractExportMetadata(
    validatedData.transfers,
    validatedData.carrierTotals
  )

  const snapshot = mergeSnapshots(undefined, metadata.transfersSnapshot)
  const exportedBy =
    typeof session === "object" && session !== null && "user" in session
      ? ((session as { user?: { id?: string | null; email?: string | null } }).user
          ?.id ||
          (session as { user?: { id?: string | null; email?: string | null } }).user
            ?.email ||
          "unknown")
      : "unknown"
  const isFinalChunk = chunkIndex >= totalChunks - 1
  const status = isFinalChunk ? "completed" : totalChunks > 1 ? "in_progress" : "completed"

  const dataForHash = csv || convertToCSV(allData)
  const fileHash = createHash("sha256").update(dataForHash).digest("hex")
  const fileSize = Buffer.byteLength(dataForHash, "utf8")

  if (!exportId) {
    const record = await prisma.reconciliationExport.create({
      data: {
        format,
        status,
        transferIds: metadata.transferIds,
        sobIds: metadata.sobIds,
        coverageMonths: metadata.coverageMonths,
        totalTransfers: metadata.totalTransfers,
        totalPolicies: metadata.totalPolicies,
        carrierTotals: metadata.carrierTotals,
        csvData: csv,
        snapshot,
        fileSize,
        fileHash,
        chunkCount: chunkIndex + 1,
        exportedBy,
      },
    })
    return record.id
  }

  const updatedId = await prisma.$transaction(async tx => {
    const existing = await tx.reconciliationExport.findUnique({
      where: { id: exportId },
    })

    if (!existing) {
      throw new Error(`Reconciliation export ${exportId} not found for chunk append`)
    }

    const mergedSnapshot = mergeSnapshots(existing.snapshot, metadata.transfersSnapshot)
    const mergedTransfers = mergedSnapshot.transfers
    const carrierTotals =
      metadata.carrierTotals.length > 0
        ? metadata.carrierTotals
        : normalizeCarrierTotals(
            (existing.carrierTotals as ExportCarrierTotal[] | Record<string, ExportCarrierTotal>) ?? []
          )

    const mergedTransferIds = Array.from(
      new Set([...existing.transferIds, ...metadata.transferIds])
    )
    const mergedSobIds = Array.from(new Set([...existing.sobIds, ...metadata.sobIds]))
    const mergedCoverageMonths = Array.from(
      new Set([...existing.coverageMonths, ...metadata.coverageMonths])
    )

    const csvData = csv ? appendCsv(existing.csvData, csv) : existing.csvData
    const recalculatedPolicies = mergedTransfers.reduce((sum, transfer) => {
      const policiesInTransfer = transfer.sob?.policies?.length ?? 0
      return sum + policiesInTransfer
    }, 0)

    const payloadForHash = csvData || convertToCSV(allData)
    const payloadHash = createHash("sha256").update(payloadForHash).digest("hex")
    const payloadSize = Buffer.byteLength(payloadForHash, "utf8")

    await tx.reconciliationExport.update({
      where: { id: exportId },
      data: {
        status,
        transferIds: mergedTransferIds,
        sobIds: mergedSobIds,
        coverageMonths: mergedCoverageMonths,
        totalTransfers: mergedTransfers.length,
        totalPolicies: recalculatedPolicies,
        carrierTotals,
        csvData,
        snapshot: mergedSnapshot,
        fileHash: payloadHash,
        fileSize: payloadSize,
        chunkCount: Math.max(existing.chunkCount, chunkIndex + 1),
      },
    })

    return exportId
  })

  return updatedId
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Log request size
    const contentLength = request.headers.get('content-length')
    logger.info("Export request size", {
      contentLength,
      contentLengthMB: contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
    })

    const body = await request.json()
    const validatedData = exportSchema.parse(body)

    const normalizedCarrierTotals = normalizeCarrierTotals(validatedData.carrierTotals)
    const transfersWithPolicies = validatedData.transfers.filter(
      transfer => (transfer.sob?.policies?.length ?? 0) > 0
    ).length
    const totalPolicies = validatedData.transfers.reduce((sum, transfer) => {
      const policyCount = transfer.sob?.policies?.length ?? 0
      return sum + policyCount
    }, 0)

    // Debug logging
    logger.info("Export request received", {
      transferCount: validatedData.transfers.length,
      transfersWithPolicies,
      totalPolicies,
      carrierCount: normalizedCarrierTotals.length,
    })

    // Prepare export data
    const exportData: CsvRow[] = []

    // Process each transfer and its policies
    for (const transfer of validatedData.transfers) {
      const doubleBill = transfer.sob?.doubleBill === "Yes" ? "Yes" : "No"
      
      if (transfer.sob?.policies) {
        for (const policy of transfer.sob.policies) {
          exportData.push({
            "Transfer ID": transfer.dwollaId,
            "Transfer Date": new Date(transfer.created).toLocaleDateString(),
            "Transfer Amount": transfer.amount,
            "Transfer Status": transfer.status,
            "Company Name": transfer.companyName || transfer.customerName,
            "Coverage Month": transfer.coverageMonth || "",
            "Double Bill": doubleBill,
            "Policy ID": policy.policyId,
            "Policy Holder": policy.policyHolderName,
            "Product Name": policy.productName,
            "Plan Name": policy.planName || "",
            "Monthly Cost": policy.monthlyCost,
            "Coverage Level": policy.coverageLevel,
            "Carrier": policy.carrier || "Unmapped",
          })
        }
      } else {
        // Transfer without policies
        exportData.push({
          "Transfer ID": transfer.dwollaId,
          "Transfer Date": new Date(transfer.created).toLocaleDateString(),
          "Transfer Amount": transfer.amount,
          "Transfer Status": transfer.status,
          "Company Name": transfer.companyName || transfer.customerName,
          "Coverage Month": transfer.coverageMonth || "",
          "Double Bill": doubleBill,
          "Policy ID": "",
          "Policy Holder": "",
          "Product Name": "",
          "Plan Name": "",
          "Monthly Cost": 0,
          "Coverage Level": "",
          "Carrier": "",
        })
      }
    }

    // Add summary section
    const summaryData: CsvRow[] = []
    summaryData.push({}) // Empty row
    summaryData.push({
      "Transfer ID": "CARRIER SUMMARY",
      "Transfer Date": "",
      "Transfer Amount": "",
      "Transfer Status": "",
      "Company Name": "",
      "Coverage Month": "",
      "Double Bill": "",
      "Policy ID": "",
      "Policy Holder": "",
      "Product Name": "",
      "Plan Name": "",
      "Monthly Cost": "",
      "Coverage Level": "",
      "Carrier": "",
    })

    // Add hierarchical carrier totals
    const carrierArray = normalizedCarrierTotals

    for (const carrierData of carrierArray) {
      // Carrier level
      summaryData.push({
        "Transfer ID": "",
        "Transfer Date": "",
        "Transfer Amount": "",
        "Transfer Status": "",
        "Company Name": "",
        "Coverage Month": "",
        "Double Bill": "",
        "Policy ID": "",
        "Policy Holder": "",
        "Product Name": "",
        "Plan Name": "",
        "Monthly Cost": carrierData.totalAmount,
        "Coverage Level": `${carrierData.policyCount} policies`,
        "Carrier": carrierData.carrier || carrierData.name,
      })
      
      // Product level (if available)
      if (carrierData.products) {
        for (const product of carrierData.products) {
          summaryData.push({
            "Transfer ID": "",
            "Transfer Date": "",
            "Transfer Amount": "",
            "Transfer Status": "",
            "Company Name": "",
            "Coverage Month": "",
            "Double Bill": "",
            "Policy ID": "",
            "Policy Holder": "",
            "Product Name": `  → ${product.productName}`,
            "Plan Name": "",
            "Monthly Cost": product.totalAmount,
            "Coverage Level": `${product.policyCount} policies`,
            "Carrier": "",
          })
        }
      }
    }

    // Calculate grand total
    const grandTotal = carrierArray.reduce((sum, ct) => sum + ct.totalAmount, 0)
    
    summaryData.push({
      "Transfer ID": "",
      "Transfer Date": "",
      "Transfer Amount": "",
      "Transfer Status": "",
      "Company Name": "",
      "Coverage Month": "",
      "Double Bill": "",
      "Policy ID": "",
      "Policy Holder": "",
      "Product Name": "",
      "Plan Name": "GRAND TOTAL",
      "Monthly Cost": grandTotal,
      "Coverage Level": "",
      "Carrier": "",
    })

    // Combine all data for archive + response
    const allData = [...exportData, ...summaryData]
    const csvContent = convertToCSV(allData)

    const exportId = await persistReconciliationExport({
      session,
      validatedData,
      csv: csvContent,
      allData,
    })

    logger.info("Reconciliation export generated", {
      userId: session.user.id,
      format: validatedData.format,
      rowCount: allData.length,
      exportId,
      chunkIndex: validatedData.chunkIndex ?? 0,
      totalChunks: validatedData.totalChunks ?? 1,
    })

    if (validatedData.format === "csv") {
      const headers = new Headers({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="reconciliation-${new Date().toISOString().split("T")[0]}.csv"`,
      })
      headers.set("X-Reconciliation-Export-Id", exportId)

      return new NextResponse(csvContent, {
        status: 200,
        headers,
      })
    }

    const carrierSheets = carrierArray.map(carrier => ({
      name: carrier.carrier || carrier.name || "Unknown Carrier",
      data: carrier.policies || [],
    }))

    const responseHeaders = new Headers({
      "X-Reconciliation-Export-Id": exportId,
    })

    return NextResponse.json(
      {
        data: allData,
        carrierSheets,
        exportId,
      },
      { headers: responseHeaders }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid export data", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error generating export", error as Error)
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 })
  }
}
