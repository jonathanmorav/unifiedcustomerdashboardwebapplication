"use client"

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, FileText, Settings, Info, Loader2, Database, Activity, StopCircle, PlayCircle, Clock } from "lucide-react"
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
    coverageMonth: null as string | null,
  })
  
  // Refresh control states
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [isPoliciesPaused, setIsPoliciesPaused] = useState(false)
  
  // Refs to track initial load and abort controllers
  const hasInitiallyLoaded = useRef(false)
  const transfersAbortController = useRef<AbortController | null>(null)
  const policiesAbortController = useRef<AbortController | null>(null)
  const isPoliciesPausedRef = useRef(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
    }
  }, [session, status, router])

  // Fetch transfers quickly without HubSpot data
  const fetchTransfers = async (quickLoad = true) => {
    // Cancel any existing transfer fetch
    if (transfersAbortController.current) {
      transfersAbortController.current.abort()
    }
    
    // Create new abort controller
    transfersAbortController.current = new AbortController()
    const signal = transfersAbortController.current.signal
    
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
      if (filters.coverageMonth) {
        params.append("coverageMonth", filters.coverageMonth)
      }

      console.log("Fetching transfers with params:", params.toString())
      const response = await fetch(`/api/reconciliation/transfers?${params}`, { signal })
      if (!response.ok) throw new Error("Failed to fetch transfers")

      const data = await response.json()
      console.log(`Fetched ${data.transfers.length} transfers, Total in DB: ${data.pagination?.total || 'unknown'}`)
      setTransfers(data.transfers)
      setCarrierTotals(Array.isArray(data.carrierTotals) ? data.carrierTotals : [])
      setLastRefreshTime(new Date())
      
      // If quick load, fetch policies progressively
      if (quickLoad && data.transfers.length > 0) {
        fetchPoliciesProgressive(data.transfers)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Error fetching transfers:", error)
      }
    } finally {
      setIsLoading(false)
      transfersAbortController.current = null
    }
  }

  // Fetch policies progressively in batches
  const fetchPoliciesProgressive = async (transferList: Transfer[]) => {
    // Cancel any existing policies fetch
    if (policiesAbortController.current) {
      policiesAbortController.current.abort()
    }
    
    // Create new abort controller
    policiesAbortController.current = new AbortController()
    const signal = policiesAbortController.current.signal
    
    try {
      setPoliciesLoading(true)
      setIsPoliciesPaused(false)
      isPoliciesPausedRef.current = false
      setPoliciesProgress({ loaded: 0, total: transferList.length })
      
      const batchSize = 20 // Fetch 20 at a time
      const transferIds = transferList.map(t => t.dwollaId)
      const updatedTransfers = [...transferList]
      const newCarrierTotals: any = {}
      
      for (let i = 0; i < transferIds.length; i += batchSize) {
        // Check if we should abort or pause
        if (signal.aborted) {
          console.log("Policy fetching aborted")
          break
        }
        
        // Wait while paused
        while (isPoliciesPausedRef.current && !signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        const batch = transferIds.slice(i, i + batchSize)
        
        try {
          const response = await fetch('/api/reconciliation/policies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transferIds: batch,
              batchSize: 5 // Process 5 at a time within the batch
            }),
            signal
          }).catch(err => {
            if (err.name === 'AbortError') {
              console.log("Policy fetch aborted")
              return null
            }
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
      policiesAbortController.current = null
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Error in fetchPoliciesProgressive:", error)
      }
      setPoliciesLoading(false)
      setPoliciesProgress({ loaded: 0, total: 0 })
      policiesAbortController.current = null
    }
  }
  
  // Function to stop all refresh operations
  const stopAllRefreshes = () => {
    if (transfersAbortController.current) {
      transfersAbortController.current.abort()
    }
    if (policiesAbortController.current) {
      policiesAbortController.current.abort()
    }
    setIsLoading(false)
    setPoliciesLoading(false)
    setIsPoliciesPaused(false)
    isPoliciesPausedRef.current = false
  }
  
  // Function to toggle policy loading pause
  const togglePoliciesPause = () => {
    setIsPoliciesPaused(!isPoliciesPaused)
    isPoliciesPausedRef.current = !isPoliciesPausedRef.current
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

  // Only fetch on true initial load, not when returning to the page
  useEffect(() => {
    if (session && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true
      fetchTransfers(true) // Use quick load by default
      fetchCacheStats() // Get cache stats
    }
  }, [session]) // Only depend on session for auth check

  const handleGenerateReconciliation = async () => {
    setIsGenerating(true)
    try {
      // If no transfers are loaded, alert the user
      if (transfers.length === 0) {
        alert("No transfers available to generate reconciliation. Please load transfers first.")
        setIsGenerating(false)
        return
      }

      const body: any = {
        status: filters.status === "all" ? "processed" : filters.status,
      }

      // If specific transfers are selected, use those
      if (selectedTransfers.length > 0) {
        body.transferIds = selectedTransfers
      } else {
        // If no specific selection, use all currently loaded transfers
        body.transferIds = transfers.map(t => t.dwollaId)
        
        // Also include date range if filters are set
        if (filters.startDate) body.dateRangeStart = filters.startDate.toISOString()
        if (filters.endDate) body.dateRangeEnd = filters.endDate.toISOString()
      }

      console.log("Generating reconciliation with body:", body)

      const response = await fetch("/api/reconciliation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Generate reconciliation failed:", errorData)
        throw new Error(errorData.error || "Failed to generate reconciliation")
      }

      const result = await response.json()
      console.log("Reconciliation generated successfully:", result)
      setLastSessionNumber(result.session.sessionNumber)
      
      // Clear selection after successful generation
      setSelectedTransfers([])
      
      // Refresh the transfers to show updated state
      await fetchTransfers(true)
    } catch (error) {
      console.error("Error generating reconciliation:", error)
      alert(`Failed to generate reconciliation: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
                {isPoliciesPaused ? (
                  <PlayCircle className="h-5 w-5" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
                <span className="font-medium">
                  {isPoliciesPaused ? "Policy Loading Paused" : "Loading Policy Data..."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">
                  {policiesProgress.loaded} / {policiesProgress.total} transfers
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={togglePoliciesPause}
                  className="h-7 px-2 text-xs"
                  title={isPoliciesPaused ? "Resume loading" : "Pause loading"}
                >
                  {isPoliciesPaused ? (
                    <>
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Resume
                    </>
                  ) : (
                    <>
                      <StopCircle className="h-3 w-3 mr-1" />
                      Pause
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={stopAllRefreshes}
                  className="h-7 px-2 text-xs"
                  title="Stop all loading operations"
                >
                  <StopCircle className="h-3 w-3 mr-1" />
                  Stop All
                </Button>
              </div>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-200 dark:bg-blue-800">
              <div 
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(policiesProgress.loaded / policiesProgress.total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm">
              Fetching policy details from HubSpot. {isPoliciesPaused ? "Click Resume to continue loading." : "Transfers are displayed immediately while policies load in the background."}
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
            {lastRefreshTime && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last refreshed: {lastRefreshTime.toLocaleTimeString()} ({Math.floor((new Date().getTime() - lastRefreshTime.getTime()) / 60000)} minutes ago)
              </p>
            )}
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
            {(isLoading || policiesLoading) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopAllRefreshes}
                className="flex items-center gap-2"
                title="Stop all loading operations"
              >
                <StopCircle className="h-4 w-4" />
                Stop Loading
              </Button>
            )}
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