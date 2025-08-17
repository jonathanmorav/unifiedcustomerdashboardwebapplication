"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building, Package, DollarSign, AlertCircle, ChevronDown, ChevronRight, CheckCircle, User, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    policies: Array<{
      policyId: string
      policyHolderName: string
      productName: string
      planName?: string
      monthlyCost: number
      coverageLevel: string
      carrier: string
    }>
  }
}

interface CarrierSummaryPanelProps {
  carrierTotals: CarrierTotal[]
  transfers: Transfer[]
}

export function CarrierSummaryPanel({ carrierTotals, transfers }: CarrierSummaryPanelProps) {
  const [expandedCarriers, setExpandedCarriers] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  
  // Calculate grand total
  const grandTotal = carrierTotals.reduce((sum, ct) => sum + ct.totalAmount, 0)
  
  // Find unmapped carrier if exists
  const unmappedCarrier = carrierTotals.find(ct => ct.carrier === "Unmapped")
  const mappedCarriers = carrierTotals.filter(ct => ct.carrier !== "Unmapped")

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    })
  }

  const toggleCarrier = (carrierName: string) => {
    const newExpanded = new Set(expandedCarriers)
    if (newExpanded.has(carrierName)) {
      newExpanded.delete(carrierName)
      // Also collapse all products under this carrier
      const newExpandedProducts = new Set(expandedProducts)
      carrierTotals.find(c => c.carrier === carrierName)?.products.forEach(p => {
        newExpandedProducts.delete(`${carrierName}-${p.productName}`)
      })
      setExpandedProducts(newExpandedProducts)
    } else {
      newExpanded.add(carrierName)
    }
    setExpandedCarriers(newExpanded)
  }

  const toggleProduct = (carrierName: string, productName: string) => {
    const key = `${carrierName}-${productName}`
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedProducts(newExpanded)
  }

  const handleExpandAll = () => {
    if (expandAll) {
      // Collapse all
      setExpandedCarriers(new Set())
      setExpandedProducts(new Set())
      setExpandAll(false)
    } else {
      // Expand all
      const allCarriers = new Set(carrierTotals.map(c => c.carrier))
      const allProducts = new Set<string>()
      carrierTotals.forEach(carrier => {
        carrier.products.forEach(product => {
          allProducts.add(`${carrier.carrier}-${product.productName}`)
        })
      })
      setExpandedCarriers(allCarriers)
      setExpandedProducts(allProducts)
      setExpandAll(true)
    }
  }

  // Check if totals reconcile (for visual indicators)
  const checkReconciliation = (carrier: CarrierTotal) => {
    const calculatedTotal = carrier.products.reduce((sum, p) => sum + p.totalAmount, 0)
    return Math.abs(calculatedTotal - carrier.totalAmount) < 0.01 // Allow for rounding
  }

  const checkProductReconciliation = (product: ProductTotal) => {
    const calculatedTotal = product.policies.reduce((sum, p) => sum + p.amount, 0)
    return Math.abs(calculatedTotal - product.totalAmount) < 0.01
  }

  return (
    <div className="space-y-6">
      {/* Warning for unmapped products */}
      {unmappedCarrier && unmappedCarrier.policyCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Unmapped Products Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">
              There are {unmappedCarrier.policyCount} policies totaling {formatCurrency(unmappedCarrier.totalAmount)} 
              that are not mapped to any carrier. Please review and update the carrier mappings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Carrier Hierarchy</h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleExpandAll}
          className="flex items-center gap-2"
        >
          {expandAll ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {expandAll ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {/* Hierarchical Carrier View */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {carrierTotals.map(carrier => {
              const isExpanded = expandedCarriers.has(carrier.carrier)
              const isReconciled = checkReconciliation(carrier)
              const isUnmapped = carrier.carrier === "Unmapped"

              return (
                <div key={carrier.carrier} className={isUnmapped ? "bg-red-50" : ""}>
                  {/* Level 1: Carrier */}
                  <div 
                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleCarrier(carrier.carrier)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <button className="p-1">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                      <Building className={`h-5 w-5 ${isUnmapped ? "text-red-600" : "text-cakewalk-primary"}`} />
                      <span className={`font-semibold ${isUnmapped ? "text-red-800" : ""}`}>
                        {carrier.carrier}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {carrier.policyCount} {carrier.policyCount === 1 ? "policy" : "policies"}
                      </Badge>
                      {isReconciled && !isUnmapped && (
                        <CheckCircle className="h-4 w-4 text-green-500" title="Reconciled" />
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-cakewalk-primary">
                        {formatCurrency(carrier.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Level 2: Products */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      {carrier.products.map(product => {
                        const productKey = `${carrier.carrier}-${product.productName}`
                        const isProductExpanded = expandedProducts.has(productKey)
                        const isProductReconciled = checkProductReconciliation(product)

                        return (
                          <div key={productKey}>
                            {/* Product Row */}
                            <div 
                              className="flex items-center justify-between px-8 py-3 hover:bg-gray-100 cursor-pointer border-l-4 border-transparent hover:border-cakewalk-primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleProduct(carrier.carrier, product.productName)
                              }}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <button className="p-1">
                                  {isProductExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                                <Package className="h-4 w-4 text-gray-600" />
                                <span className="font-medium text-gray-800">
                                  {product.productName}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {product.policyCount} {product.policyCount === 1 ? "policy" : "policies"}
                                </Badge>
                                {isProductReconciled && (
                                  <CheckCircle className="h-3 w-3 text-green-500" title="Reconciled" />
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-semibold text-gray-700">
                                  {formatCurrency(product.totalAmount)}
                                </span>
                              </div>
                            </div>

                            {/* Level 3: Individual Policies */}
                            {isProductExpanded && (
                              <div className="bg-white border-t border-gray-100">
                                {product.policies.map((policy, index) => (
                                  <div 
                                    key={`${policy.transferId}-${index}`}
                                    className="flex items-center justify-between px-12 py-2 hover:bg-gray-50 text-sm"
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <User className="h-3 w-3 text-gray-400" />
                                      <span className="text-gray-700">
                                        {policy.policyId}
                                      </span>
                                      {policy.planName && (
                                        <span className="text-xs text-gray-500">
                                          ({policy.planName})
                                        </span>
                                      )}
                                      <Badge variant="outline" className="text-xs">
                                        {policy.coverageLevel}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="font-mono text-xs text-gray-500">
                                        {policy.transferId}
                                      </span>
                                      <span className="font-medium text-gray-600">
                                        {formatCurrency(policy.amount)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grand Total Summary */}
      <Card className="bg-gradient-to-r from-cakewalk-primary/10 to-cakewalk-primary/5 border-cakewalk-primary/20">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reconciliation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-600">Total Carriers</p>
              <p className="text-2xl font-bold text-cakewalk-primary">
                {mappedCarriers.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Policies</p>
              <p className="text-2xl font-bold text-cakewalk-primary">
                {carrierTotals.reduce((sum, ct) => sum + ct.policyCount, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Transfer Total</p>
              <p className="text-lg font-bold text-cakewalk-primary">
                {formatCurrency(transfers.reduce((sum, t) => sum + t.amount, 0))}
              </p>
              <p className="text-xs text-gray-500">Actual paid</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Policy Total</p>
              <p className="text-lg font-bold text-cakewalk-primary">
                {formatCurrency(grandTotal)}
              </p>
              <p className="text-xs text-gray-500">Expected</p>
            </div>
          </div>

          {/* Quick Summary by Carrier */}
          <div className="mt-6 pt-4 border-t border-cakewalk-primary/20">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Summary</h4>
            <div className="space-y-2">
              {carrierTotals.map(carrier => {
                const percentage = grandTotal > 0 ? (carrier.totalAmount / grandTotal) * 100 : 0
                return (
                  <div key={carrier.carrier} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1">
                      <span className={carrier.carrier === "Unmapped" ? "text-red-600 font-medium" : ""}>
                        {carrier.carrier}
                      </span>
                      <div className="flex-1 max-w-xs">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${carrier.carrier === "Unmapped" ? "bg-red-500" : "bg-cakewalk-primary"}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{percentage.toFixed(1)}%</span>
                    </div>
                    <span className="font-medium ml-4">{formatCurrency(carrier.totalAmount)}</span>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}