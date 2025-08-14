"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building, Package, DollarSign, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface CarrierTotal {
  carrier: string
  totalAmount: number
  policyCount: number
  policies: Array<{
    transferId: string
    policyId: string
    amount: number
  }>
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
  // Sort carriers by total amount (descending)
  const sortedCarriers = [...carrierTotals].sort((a, b) => b.totalAmount - a.totalAmount)
  
  // Calculate grand total
  const grandTotal = sortedCarriers.reduce((sum, ct) => sum + ct.totalAmount, 0)
  
  // Find unmapped carrier if exists
  const unmappedCarrier = sortedCarriers.find(ct => ct.carrier === "Unmapped")
  const mappedCarriers = sortedCarriers.filter(ct => ct.carrier !== "Unmapped")

  const getCarrierIcon = (carrierName: string) => {
    // You can customize icons based on carrier names
    return <Building className="h-5 w-5" />
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    })
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
            <div className="mt-3 space-y-1">
              {unmappedCarrier.policies.slice(0, 5).map((policy, index) => (
                <div key={index} className="text-xs text-red-600">
                  • {policy.policyId} - {formatCurrency(policy.amount)}
                </div>
              ))}
              {unmappedCarrier.policies.length > 5 && (
                <div className="text-xs text-red-600">
                  ... and {unmappedCarrier.policies.length - 5} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Carrier Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mappedCarriers.map(carrier => {
          const percentage = grandTotal > 0 ? (carrier.totalAmount / grandTotal) * 100 : 0

          return (
            <Card key={carrier.carrier} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCarrierIcon(carrier.carrier)}
                    <CardTitle className="text-lg">{carrier.carrier}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {carrier.policyCount} {carrier.policyCount === 1 ? "policy" : "policies"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xl font-bold text-cakewalk-primary">
                        {formatCurrency(carrier.totalAmount)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Policies:
                        </span>
                        <span className="font-medium">{carrier.policyCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Avg/Policy:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(carrier.totalAmount / carrier.policyCount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Grand Total Summary */}
      <Card className="bg-gradient-to-r from-cakewalk-primary/10 to-cakewalk-primary/5 border-cakewalk-primary/20">
        <CardHeader>
          <CardTitle className="text-xl">Remittance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-600">Total Carriers</p>
              <p className="text-2xl font-bold text-cakewalk-primary">
                {mappedCarriers.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Policies</p>
              <p className="text-2xl font-bold text-cakewalk-primary">
                {sortedCarriers.reduce((sum, ct) => sum + ct.policyCount, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total to Remit</p>
              <p className="text-2xl font-bold text-cakewalk-primary">
                {formatCurrency(grandTotal)}
              </p>
            </div>
          </div>

          {/* Breakdown by Carrier */}
          <div className="mt-6 pt-4 border-t border-cakewalk-primary/20">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Carrier Breakdown</h4>
            <div className="space-y-2">
              {sortedCarriers.map(carrier => (
                <div key={carrier.carrier} className="flex items-center justify-between text-sm">
                  <span className={carrier.carrier === "Unmapped" ? "text-red-600 font-medium" : ""}>
                    {carrier.carrier}
                  </span>
                  <span className="font-medium">{formatCurrency(carrier.totalAmount)}</span>
                </div>
              ))}
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