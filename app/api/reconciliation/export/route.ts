import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { z } from "zod"

// Schema for export request
const exportSchema = z.object({
  transfers: z.array(z.any()),
  carrierTotals: z.record(z.any()),
  format: z.enum(["csv", "excel"]).optional().default("csv"),
})

// Helper to convert to CSV
function convertToCSV(data: any[]): string {
  if (data.length === 0) return ""

  // Get headers from first object
  const headers = Object.keys(data[0])
  const csvHeaders = headers.join(",")

  // Convert each row
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // Handle values that might contain commas or quotes
      if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value ?? ""
    }).join(",")
  })

  return [csvHeaders, ...csvRows].join("\n")
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = exportSchema.parse(body)

    // Prepare export data
    const exportData: any[] = []

    // Process each transfer and its policies
    for (const transfer of validatedData.transfers) {
      if (transfer.sob?.policies) {
        for (const policy of transfer.sob.policies) {
          exportData.push({
            "Transfer ID": transfer.dwollaId,
            "Transfer Date": new Date(transfer.created).toLocaleDateString(),
            "Transfer Amount": transfer.amount,
            "Transfer Status": transfer.status,
            "Company Name": transfer.companyName || transfer.customerName,
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
    const summaryData: any[] = []
    summaryData.push({}) // Empty row
    summaryData.push({
      "Transfer ID": "CARRIER SUMMARY",
      "Transfer Date": "",
      "Transfer Amount": "",
      "Transfer Status": "",
      "Company Name": "",
      "Policy ID": "",
      "Policy Holder": "",
      "Product Name": "",
      "Plan Name": "",
      "Monthly Cost": "",
      "Coverage Level": "",
      "Carrier": "",
    })

    // Add hierarchical carrier totals
    const carrierArray = Array.isArray(validatedData.carrierTotals) 
      ? validatedData.carrierTotals 
      : Object.values(validatedData.carrierTotals)
      
    for (const carrier of carrierArray) {
      const carrierData = carrier as any
      // Carrier level
      summaryData.push({
        "Transfer ID": "",
        "Transfer Date": "",
        "Transfer Amount": "",
        "Transfer Status": "",
        "Company Name": "",
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
    const grandTotal = carrierArray.reduce(
      (sum, ct: any) => sum + ct.totalAmount, 
      0
    )
    
    summaryData.push({
      "Transfer ID": "",
      "Transfer Date": "",
      "Transfer Amount": "",
      "Transfer Status": "",
      "Company Name": "",
      "Policy ID": "",
      "Policy Holder": "",
      "Product Name": "",
      "Plan Name": "GRAND TOTAL",
      "Monthly Cost": grandTotal,
      "Coverage Level": "",
      "Carrier": "",
    })

    // Combine all data
    const allData = [...exportData, ...summaryData]

    if (validatedData.format === "csv") {
      // Generate CSV
      const csv = convertToCSV(allData)
      
      logger.info("Reconciliation export generated", {
        userId: session.user.id,
        format: "csv",
        rowCount: allData.length,
      })

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="reconciliation-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    } else {
      // For Excel format, we'll return JSON that can be processed client-side
      // In a production environment, you might use a library like exceljs
      logger.info("Reconciliation export generated", {
        userId: session.user.id,
        format: "excel",
        rowCount: allData.length,
      })

      return NextResponse.json({
        data: allData,
        carrierSheets: Object.entries(validatedData.carrierTotals).map(([carrier, data]) => ({
          name: carrier,
          data: (data as any).policies || [],
        })),
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid export data", details: error.format() },
        { status: 400 }
      )
    }

    logger.error("Error generating export", error as Error)
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 })
  }
}