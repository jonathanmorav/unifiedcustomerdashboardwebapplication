"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, FileText, Settings } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { TransferPolicyList } from "@/components/reconciliation/TransferPolicyList"
import { CarrierSummaryPanel } from "@/components/reconciliation/CarrierSummaryPanel"
import { ReconciliationFilters } from "@/components/reconciliation/ReconciliationFilters"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Transfer {
  id: string
  dwollaId: string
  amount: number
  customerName: string
  companyName: string
  status: string
  created: string
  sob?: {
    sobId: string
    companyName: string
    amountToDraft: number
    policies: Policy[]
  }
}

interface Policy {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string
  monthlyCost: number
  coverageLevel: string
  carrier: string
}

interface PolicyDetail {
  transferId: string
  policyId: string
  policyHolderName: string
  amount: number
  coverageLevel: string
  planName?: string
}

interface ProductTotal {
  productName: string
  totalAmount: number
  policyCount: number
  policies: PolicyDetail[]
}

interface CarrierTotal {
  carrier: string
  totalAmount: number
  policyCount: number
  products: ProductTotal[]
}

export default function ReconciliationDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [carrierTotals, setCarrierTotals] = useState<CarrierTotal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTransfers, setSelectedTransfers] = useState<string[]>([])
  const [filters, setFilters] = useState({
    status: "processed" as "processed" | "pending" | "failed" | "all",
    startDate: null as Date | null,
    endDate: null as Date | null,
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
    }
  }, [session, status, router])

  // Fetch transfers with SOB/policy data
  const fetchTransfers = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        status: filters.status,
        includeSOB: "true",
      })

      if (filters.startDate) {
        params.append("startDate", filters.startDate.toISOString())
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate.toISOString())
      }

      const response = await fetch(`/api/reconciliation/transfers?${params}`)
      if (!response.ok) throw new Error("Failed to fetch transfers")

      const data = await response.json()
      setTransfers(data.transfers)
      setCarrierTotals(data.carrierTotals)
    } catch (error) {
      console.error("Error fetching transfers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchTransfers()
    }
  }, [filters, session])

  const handleGenerateReconciliation = async () => {
    try {
      const body: any = {
        status: filters.status === "all" ? "processed" : filters.status,
      }

      if (selectedTransfers.length > 0) {
        body.transferIds = selectedTransfers
      } else {
        if (filters.startDate) body.dateRangeStart = filters.startDate.toISOString()
        if (filters.endDate) body.dateRangeEnd = filters.endDate.toISOString()
      }

      const response = await fetch("/api/reconciliation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to generate reconciliation")

      const result = await response.json()
      alert(`Reconciliation session created: ${result.session.sessionNumber}`)
      
      // Refresh the page
      fetchTransfers()
    } catch (error) {
      console.error("Error generating reconciliation:", error)
      alert("Failed to generate reconciliation")
    }
  }

  const handleExport = async (format: "csv" | "excel" = "csv") => {
    try {
      // Build export data
      const exportData = {
        transfers: selectedTransfers.length > 0 
          ? transfers.filter(t => selectedTransfers.includes(t.dwollaId))
          : transfers,
        carrierTotals,
        format,
      }

      const response = await fetch("/api/reconciliation/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `reconciliation-${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Export error:", error)
      alert("Failed to export reconciliation data")
    }
  }

  if (!session) {
    return null
  }

  // Calculate summary metrics
  const totalPolicies = transfers.reduce((sum, t) => sum + (t.sob?.policies?.length || 0), 0)
  const totalAmount = carrierTotals.reduce((sum, ct) => sum + ct.totalAmount, 0)
  const unmappedCount = carrierTotals.find(ct => ct.carrier === "Unmapped")?.policyCount || 0

  return (
    <div className="min-h-screen bg-cakewalk-alice-100">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-6">
        {/* Page Title and Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-cakewalk-text-primary">
              Transfer Reconciliation
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Reconcile ACH transfers with policies and carrier remittances
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/reconciliation/mappings")}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage Mappings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTransfers}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateReconciliation}
              className="flex items-center gap-2 bg-cakewalk-primary hover:bg-cakewalk-primary-dark"
            >
              <FileText className="h-4 w-4" />
              Generate Reconciliation
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transfers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPolicies}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Unmapped Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${unmappedCount > 0 ? "text-red-600" : "text-green-600"}`}>
                {unmappedCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <ReconciliationFilters
          filters={filters}
          onFiltersChange={setFilters}
          isLoading={isLoading}
        />

        {/* Main Content Tabs */}
        <Tabs defaultValue="transfers" className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="transfers">Transfers & Policies</TabsTrigger>
            <TabsTrigger value="carriers">Carrier Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="transfers">
            <TransferPolicyList
              transfers={transfers}
              isLoading={isLoading}
              selectedTransfers={selectedTransfers}
              onSelectionChange={setSelectedTransfers}
            />
          </TabsContent>

          <TabsContent value="carriers">
            <CarrierSummaryPanel
              carrierTotals={Object.values(carrierTotals)}
              transfers={transfers}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}