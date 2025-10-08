process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "dummy-secret-32-characters-long-0001"
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "dummy"
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "dummy"
process.env.AUTHORIZED_EMAILS = process.env.AUTHORIZED_EMAILS ?? "codex@example.com"
process.env.APP_URL = process.env.APP_URL ?? "http://localhost:3000"
process.env.DWOLLA_WEBHOOK_SECRET = process.env.DWOLLA_WEBHOOK_SECRET ?? "dummy"
process.env.HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY ?? "dummy"
process.env.DWOLLA_KEY = process.env.DWOLLA_KEY ?? "dummy"
process.env.DWOLLA_SECRET = process.env.DWOLLA_SECRET ?? "dummy"
process.env.DWOLLA_BASE_URL = process.env.DWOLLA_BASE_URL ?? "https://api-sandbox.dwolla.com"

import type { PrismaClient } from "@prisma/client"

type CsvCell = string | number | boolean | null | undefined

type CsvRow = Record<string, CsvCell>

type Policy = {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string | null
  monthlyCost: number
  coverageLevel: string
  carrier?: string | null
}

type TransferForTest = {
  dwollaId: string
  created: string
  amount: number
  status: string
  companyName: string
  customerName?: string | null
  coverageMonth: string
  sob: {
    sobId: string
    doubleBill?: string | null
    policies: Policy[]
  }
}

type CarrierProduct = {
  productName: string
  totalAmount: number
  policyCount: number
  policies: Policy[]
}

type CarrierTotal = {
  carrier: string
  totalAmount: number
  policyCount: number
  products: CarrierProduct[]
  policies?: Policy[]
}

const session = {
  user: {
    id: "codex-test-user",
    email: "codex@example.com",
  },
}

function buildPolicyCoverageRows(transfers: TransferForTest[]): CsvRow[] {
  const rows: CsvRow[] = []

  transfers.forEach(transfer => {
    if (transfer.sob?.policies?.length) {
      transfer.sob.policies.forEach(policy => {
        rows.push({
          "Transfer ID": transfer.dwollaId,
          "Transfer Date": new Date(transfer.created).toLocaleDateString(),
          "Transfer Amount": transfer.amount,
          "Transfer Status": transfer.status,
          "Company Name": transfer.companyName,
          "Coverage Month": transfer.coverageMonth,
          "Double Bill": transfer.sob?.doubleBill === "Yes" ? "Yes" : "No",
          "Policy ID": policy.policyId,
          "Policy Holder": policy.policyHolderName,
          "Product Name": policy.productName,
          "Plan Name": policy.planName || "",
          "Monthly Cost": policy.monthlyCost,
          "Coverage Level": policy.coverageLevel,
          "Carrier": policy.carrier || "Unmapped",
        })
      })
      return
    }

    rows.push({
      "Transfer ID": transfer.dwollaId,
      "Transfer Date": new Date(transfer.created).toLocaleDateString(),
      "Transfer Amount": transfer.amount,
      "Transfer Status": transfer.status,
      "Company Name": transfer.companyName,
      "Coverage Month": transfer.coverageMonth,
      "Double Bill": transfer.sob?.doubleBill === "Yes" ? "Yes" : "No",
      "Policy ID": "",
      "Policy Holder": "",
      "Product Name": "",
      "Plan Name": "",
      "Monthly Cost": 0,
      "Coverage Level": "",
      "Carrier": "",
    })
  })

  return rows
}

function buildSummaryRows(carrierTotals: CarrierTotal[]): CsvRow[] {
  const rows: CsvRow[] = []

  rows.push({})
  rows.push({
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

  carrierTotals.forEach(carrier => {
    rows.push({
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
      "Monthly Cost": carrier.totalAmount,
      "Coverage Level": `${carrier.policyCount} policies`,
      "Carrier": carrier.carrier,
    })

    carrier.products.forEach(product => {
      rows.push({
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
    })
  })

  const grandTotal = carrierTotals.reduce((sum, carrier) => sum + carrier.totalAmount, 0)
  rows.push({
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

  return rows
}

function convertToCSV(data: CsvRow[]): string {
  if (!data.length) {
    return ""
  }

  const headers = Object.keys(data[0])
  const csvHeader = headers.join(",")

  const rows = data.map(row =>
    headers
      .map(header => {
        const value = row[header]
        if (value === undefined || value === null) {
          return ""
        }
        if (typeof value === "string") {
          if (value.includes(",") || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }
        return String(value)
      })
      .join(",")
  )

  return [csvHeader, ...rows].join("\n")
}

function buildCarrierTotals(transfers: TransferForTest[]): CarrierTotal[] {
  const totals: Record<string, CarrierTotal> = {}

  transfers.forEach(transfer => {
    transfer.sob?.policies?.forEach(policy => {
      const carrierName = policy.carrier || "Unmapped"
      if (!totals[carrierName]) {
        totals[carrierName] = {
          carrier: carrierName,
          totalAmount: 0,
          policyCount: 0,
          products: [],
        }
      }
      const carrier = totals[carrierName]

      let product = carrier.products.find(p => p.productName === policy.productName)
      if (!product) {
        product = {
          productName: policy.productName,
          totalAmount: 0,
          policyCount: 0,
          policies: [],
        }
        carrier.products.push(product)
      }

      carrier.totalAmount += policy.monthlyCost
      carrier.policyCount += 1
      product.totalAmount += policy.monthlyCost
      product.policyCount += 1
      product.policies.push(policy)
    })
  })

  return Object.values(totals)
}

let prismaClient: PrismaClient | null = null

async function run() {
  const [{ prisma }, { persistReconciliationExport }] = await Promise.all([
    import("@/lib/db"),
    import("@/app/api/reconciliation/export/route"),
  ])

  prismaClient = prisma

  const transfers: TransferForTest[] = [
    {
      dwollaId: "DW-1001",
      created: "2025-08-01T12:00:00.000Z",
      amount: 1200,
      status: "processed",
      companyName: "Sunrise Bakery",
      coverageMonth: "2025-08",
      sob: {
        sobId: "SOB-1001",
        doubleBill: "No",
        policies: [
          {
            policyId: "POL-001",
            policyHolderName: "Alice Johnson",
            productName: "Dental",
            planName: "Enhanced",
            monthlyCost: 45,
            coverageLevel: "Employee Only",
            carrier: "Guardian",
          },
          {
            policyId: "POL-002",
            policyHolderName: "Bob Lee",
            productName: "Vision",
            planName: "Standard",
            monthlyCost: 18,
            coverageLevel: "Employee + Family",
            carrier: "Guardian",
          },
        ],
      },
    },
    {
      dwollaId: "DW-1002",
      created: "2025-08-01T12:00:00.000Z",
      amount: 980,
      status: "processed",
      companyName: "Sunrise Bakery",
      coverageMonth: "2025-08",
      sob: {
        sobId: "SOB-1002",
        doubleBill: "Yes",
        policies: [
          {
            policyId: "POL-003",
            policyHolderName: "Chris Torres",
            productName: "Short Term Disability",
            planName: "60% Salary",
            monthlyCost: 35,
            coverageLevel: "Employee Only",
            carrier: "SunLife",
          },
          {
            policyId: "POL-004",
            policyHolderName: "Dana Smith",
            productName: "Life - Dependent",
            planName: "Base",
            monthlyCost: 20,
            coverageLevel: "Employee + Family",
            carrier: "SunLife",
          },
        ],
      },
    },
    {
      dwollaId: "DW-1003",
      created: "2025-08-02T12:00:00.000Z",
      amount: 1420,
      status: "processed",
      companyName: "Sunrise Bakery",
      coverageMonth: "2025-08",
      sob: {
        sobId: "SOB-1003",
        doubleBill: "No",
        policies: [
          {
            policyId: "POL-005",
            policyHolderName: "Emilia Chen",
            productName: "Accident",
            planName: "Core",
            monthlyCost: 26,
            coverageLevel: "Employee + Spouse",
            carrier: "SunLife",
          },
          {
            policyId: "POL-006",
            policyHolderName: "Frank Miller",
            productName: "Vision",
            planName: "Premium",
            monthlyCost: 21,
            coverageLevel: "Employee",
            carrier: "Guardian",
          },
        ],
      },
    },
  ]

  const carrierTotals = buildCarrierTotals(transfers)

  const firstChunkTransfers = transfers.slice(0, 2)
  const secondChunkTransfers = transfers.slice(2)

  const firstChunkRows = [
    ...buildPolicyCoverageRows(firstChunkTransfers),
    ...buildSummaryRows([]),
  ]
  const firstChunkCsv = convertToCSV(firstChunkRows)

  const firstChunkPayload = {
    transfers: firstChunkTransfers,
    carrierTotals: [] as CarrierTotal[],
    format: "csv" as const,
    chunkIndex: 0,
    totalChunks: 2,
  }

  const exportId = await persistReconciliationExport({
    session,
    validatedData: firstChunkPayload,
    csv: firstChunkCsv,
    allData: firstChunkRows,
  })

  const secondChunkRows = [
    ...buildPolicyCoverageRows(secondChunkTransfers),
    ...buildSummaryRows(carrierTotals),
  ]
  const secondChunkCsv = convertToCSV(secondChunkRows)

  const secondChunkPayload = {
    transfers: secondChunkTransfers,
    carrierTotals,
    format: "csv" as const,
    chunkIndex: 1,
    totalChunks: 2,
    exportId,
  }

  await persistReconciliationExport({
    session,
    validatedData: secondChunkPayload,
    csv: secondChunkCsv,
    allData: secondChunkRows,
  })

  const record = await prisma.reconciliationExport.findUnique({
    where: { id: exportId },
  })

  if (!record) {
    throw new Error("Failed to persist reconciliation export record")
  }

  console.log("✅ Reconciliation export persisted")
  console.log("   Export ID:", record.id)
  console.log("   Coverage Months:", record.coverageMonths)
  console.log("   SOB IDs:", record.sobIds)
  console.log("   Total Transfers:", record.totalTransfers)
  console.log("   Total Policies:", record.totalPolicies)
  console.log("   Chunk Count:", record.chunkCount)
  console.log("   CSV Size (bytes):", record.fileSize)
  console.log("   Sample CSV preview:\n", record.csvData?.split("\n").slice(0, 3).join("\n"))
}

run()
  .catch(error => {
    console.error("❌ Failed to exercise reconciliation export:", error)
    process.exit(1)
  })
  .finally(async () => {
    if (prismaClient) {
      await prismaClient.$disconnect()
    }
  })
