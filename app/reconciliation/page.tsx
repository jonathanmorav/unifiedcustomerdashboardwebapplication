"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, FileText, Settings, Info, Loader2, Database, Activity } from "lucide-react"
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastSessionNumber, setLastSessionNumber] = useState<string | null>(null)
  const [selectedTransfers, setSelectedTransfers] = useState<string[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(false)
  const [policiesProgress, setPoliciesProgress] = useState({ loaded: 0, total: 0 })
  const [cacheStats, setCacheStats] = useState<any>(null)
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

  // Fetch transfers quickly without HubSpot data
  const fetchTransfers = async (quickLoad = true) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        status: filters.status,
        includeSOB: quickLoad ? "false" : "true",
        limit: "1000",
        quickLoad: quickLoad.toString(),
      })

      if (filters.startDate) {
        const startDateStr = filters.startDate.toISOString().split('T')[0]
        params.append("startDate", startDateStr)
      }
      if (filters.endDate) {
        const endDateStr = filters.endDate.toISOString().split('T')[0]
        params.append("endDate", endDateStr)
      }

      console.log("Fetching transfers with params:", params.toString())
      const response = await fetch(`/api/reconciliation/transfers?${params}`)
      if (!response.ok) throw new Error("Failed to fetch transfers")

      const data = await response.json()
      console.log(`Fetched ${data.transfers.length} transfers, Total in DB: ${data.pagination?.total || 'unknown'}`)
      setTransfers(data.transfers)
      setCarrierTotals(Array.isArray(data.carrierTotals) ? data.carrierTotals : [])
      
      // If quick load, fetch policies progressively
      if (quickLoad && data.transfers.length > 0) {
        fetchPoliciesProgressive(data.transfers)
      }
    } catch (error) {
      console.error("Error fetching transfers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch policies progressively in batches
  const fetchPoliciesProgressive = async (transferList: Transfer[]) => {
    try {
      setPoliciesLoading(true)
      setPoliciesProgress({ loaded: 0, total: transferList.length })
      
      const batchSize = 20 // Fetch 20 at a time
      const transferIds = transferList.map(t => t.dwollaId)
      const updatedTransfers = [...transferList]
      const newCarrierTotals: any = {}
      
      for (let i = 0; i < transferIds.length; i += batchSize) {
        const batch = transferIds.slice(i, i + batchSize)
        
        try {
          const response = await fetch('/api/reconciliation/policies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transferIds: batch,
              batchSize: 5 // Process 5 at a time within the batch
            })
          }).catch(err => {
            console.error("Failed to fetch policies batch:", err)
            return null
          })
          
          if (response && response.ok) {
          const data = await response.json()
          
          // Update transfers with policy data
          data.policies?.forEach((policyData: any) => {
            const transferIndex = updatedTransfers.findIndex(t => t.dwollaId === policyData.transferId)
            if (transferIndex !== -1) {
              const transfer = updatedTransfers[transferIndex]
              updatedTransfers[transferIndex].sob = policyData.sobData
              
              // Update carrier totals with proper hierarchy
              policyData.sobData?.policies?.forEach((policy: any) => {
                const carrier = policy.carrier || "Unmapped"
                const productName = policy.productName || "Unknown Product"
                
                // Initialize carrier if needed
                if (!newCarrierTotals[carrier]) {
                  newCarrierTotals[carrier] = {
                    carrier,
                    totalAmount: 0,
                    policyCount: 0,
                    products: {}
                  }
                }
                
                // Initialize product under carrier if needed
                if (!newCarrierTotals[carrier].products[productName]) {
                  newCarrierTotals[carrier].products[productName] = {
                    productName,
                    totalAmount: 0,
                    policyCount: 0,
                    policies: []
                  }
                }
                
                // Update carrier totals
                newCarrierTotals[carrier].totalAmount += policy.monthlyCost
                newCarrierTotals[carrier].policyCount += 1
                
                // Update product totals
                newCarrierTotals[carrier].products[productName].totalAmount += policy.monthlyCost
                newCarrierTotals[carrier].products[productName].policyCount += 1
                
                // Add individual policy detail
                newCarrierTotals[carrier].products[productName].policies.push({
                  transferId: transfer.dwollaId,
                  policyId: policy.policyId,
                  policyHolderName: policy.policyHolderName,
                  amount: policy.monthlyCost,
                  coverageLevel: policy.coverageLevel,
                  planName: policy.planName
                })
              })
            }
          })
          
          // Update state with new data
          setTransfers([...updatedTransfers])
          
          // Convert carrier totals to array
          const carrierArray = Object.values(newCarrierTotals).map((ct: any) => ({
            ...ct,
            products: Object.values(ct.products || {})
          }))
          setCarrierTotals(carrierArray)
          
          // Update progress
          setPoliciesProgress({ 
            loaded: Math.min(i + batchSize, transferIds.length), 
            total: transferIds.length 
            })
          }
        } catch (error) {
          console.error("Error fetching policies batch:", error)
        }
        
        // Small delay between batches
        if (i + batchSize < transferIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    
      setPoliciesLoading(false)
    } catch (error) {
      console.error("Error in fetchPoliciesProgressive:", error)
      setPoliciesLoading(false)
      setPoliciesProgress({ loaded: 0, total: 0 })
    }
  }

  // Fetch cache statistics
  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/reconciliation/cache/stats')
      if (response.ok) {
        const data = await response.json()
        setCacheStats(data)
      }
    } catch (error) {
      console.error("Error fetching cache stats:", error)
    }
  }

  // Only fetch on initial load, not on filter changes
  useEffect(() => {
    if (session) {
      fetchTransfers(true) // Use quick load by default
      fetchCacheStats() // Get cache stats
    }
  }, [session]) // Removed filters dependency to prevent auto-refresh

  const handleGenerateReconciliation = async () => {
    setIsGenerating(true)
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
      setLastSessionNumber(result.session.sessionNumber)
      
      // Clear selection after successful generation
      setSelectedTransfers([])
      
      // Refresh the page
      fetchTransfers()
    } catch (error) {
      console.error("Error generating reconciliation:", error)
      alert("Failed to generate reconciliation. Please try again.")
    } finally {
      setIsGenerating(false)
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
  
  // Transfer total: Sum of actual ACH transfer amounts (what was paid)
  const totalTransferAmount = transfers.reduce((sum, t) => sum + t.amount, 0)
  
  // Policy total: Sum of policy costs from HubSpot (what should be paid)
  const totalPolicyAmount = Array.isArray(carrierTotals) ? carrierTotals.reduce((sum, ct) => sum + ct.totalAmount, 0) : 0
  
  // Variance between what was paid vs what should be paid
  const variance = totalTransferAmount - totalPolicyAmount
  
  const unmappedCount = Array.isArray(carrierTotals) ? carrierTotals.find(ct => ct.carrier === "Unmapped")?.policyCount || 0 : 0

  return (
    <div className="min-h-screen bg-cakewalk-alice-100">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-6">
        {/* Success Message */}
        {lastSessionNumber && (
          <div className="mb-4 rounded-lg bg-green-100 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              <span className="font-medium">Reconciliation Session Created Successfully!</span>
            </div>
            <p className="mt-1 text-sm">
              Session Number: <span className="font-mono font-semibold">{lastSessionNumber}</span>
            </p>
            <p className="mt-1 text-sm">
              The reconciliation session has been saved to the database for review and finalization.
            </p>
          </div>
        )}

        {/* Policy Loading Progress */}
        {policiesLoading && (
          <div className="mb-4 rounded-lg bg-blue-100 p-4 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Loading Policy Data...</span>
              </div>
              <span className="text-sm font-mono">
                {policiesProgress.loaded} / {policiesProgress.total} transfers
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-200 dark:bg-blue-800">
              <div 
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(policiesProgress.loaded / policiesProgress.total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm">
              Fetching policy details from HubSpot. Transfers are displayed immediately while policies load in the background.
            </p>
          </div>
        )}

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
              onClick={() => {
                fetchTransfers(true)
                fetchCacheStats()
              }}
              disabled={isLoading || policiesLoading}
              className="flex items-center gap-2"
              title="Quick load transfers, then fetch policies in background"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || policiesLoading ? "animate-spin" : ""}`} />
              {policiesLoading ? "Loading Policies..." : "Quick Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchTransfers(false)
                fetchCacheStats()
              }}
              disabled={isLoading || policiesLoading}
              className="flex items-center gap-2"
              title="Full refresh - fetch all data at once (slower)"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Full Refresh
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
              disabled={isGenerating}
              className="flex items-center gap-2 bg-cakewalk-primary hover:bg-cakewalk-primary-dark"
              title="Creates a formal reconciliation session record in the database with all current transfers, policies, and carrier totals for review and finalization"
            >
              <FileText className={`h-4 w-4 ${isGenerating ? "animate-pulse" : ""}`} />
              {isGenerating ? "Generating..." : "Generate Reconciliation"}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
              <CardTitle className="text-sm font-medium text-gray-600">Transfer Amount</CardTitle>
              <p className="text-xs text-gray-500">Actual paid</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalTransferAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Policy Amount</CardTitle>
              <p className="text-xs text-gray-500">Expected</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalPolicyAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Variance</CardTitle>
              <p className="text-xs text-gray-500">Difference</p>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${Math.abs(variance) > 1000 ? "text-orange-600" : "text-green-600"}`}>
                {variance >= 0 ? "+" : ""}${variance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              {Math.abs(variance) > 1000 && (
                <p className="text-xs text-orange-600 mt-1">Needs review</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Unmapped</CardTitle>
              <p className="text-xs text-gray-500">Products</p>
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
          onApplyFilters={() => fetchTransfers(true)}
          isLoading={isLoading || policiesLoading}
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
              carrierTotals={Array.isArray(carrierTotals) ? carrierTotals : []}
              transfers={transfers}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}