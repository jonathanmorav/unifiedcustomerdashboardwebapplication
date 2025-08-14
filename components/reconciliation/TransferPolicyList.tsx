"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, Building2, User, DollarSign } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface Policy {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string
  monthlyCost: number
  coverageLevel: string
  carrier: string
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
    policies: Policy[]
  }
}

interface TransferPolicyListProps {
  transfers: Transfer[]
  isLoading: boolean
  selectedTransfers: string[]
  onSelectionChange: (selected: string[]) => void
}

export function TransferPolicyList({
  transfers,
  isLoading,
  selectedTransfers,
  onSelectionChange,
}: TransferPolicyListProps) {
  const [expandedTransfers, setExpandedTransfers] = useState<Set<string>>(new Set())

  const toggleExpanded = (transferId: string) => {
    const newExpanded = new Set(expandedTransfers)
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId)
    } else {
      newExpanded.add(transferId)
    }
    setExpandedTransfers(newExpanded)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(transfers.map(t => t.dwollaId))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectTransfer = (transferId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedTransfers, transferId])
    } else {
      onSelectionChange(selectedTransfers.filter(id => id !== transferId))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "processed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCarrierColor = (carrier: string) => {
    if (carrier === "Unmapped") {
      return "bg-red-100 text-red-800 border-red-200"
    }
    // Create consistent colors for carriers
    const colors = [
      "bg-blue-100 text-blue-800 border-blue-200",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-indigo-100 text-indigo-800 border-indigo-200",
      "bg-teal-100 text-teal-800 border-teal-200",
      "bg-cyan-100 text-cyan-800 border-cyan-200",
    ]
    const index = carrier.charCodeAt(0) % colors.length
    return colors[index]
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfers & Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transfers & Policies</CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedTransfers.length === transfers.length && transfers.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">Select All</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transfers.map(transfer => {
            const isExpanded = expandedTransfers.has(transfer.dwollaId)
            const isSelected = selectedTransfers.includes(transfer.dwollaId)
            const policyCount = transfer.sob?.policies?.length || 0
            const totalPolicyCost = transfer.sob?.policies?.reduce((sum, p) => sum + p.monthlyCost, 0) || 0

            return (
              <div
                key={transfer.dwollaId}
                className={`rounded-lg border ${isSelected ? "border-cakewalk-primary bg-cakewalk-primary/5" : "border-gray-200"} transition-all`}
              >
                {/* Transfer Header */}
                <div className="flex items-center gap-4 p-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectTransfer(transfer.dwollaId, checked as boolean)}
                  />
                  
                  <button
                    onClick={() => toggleExpanded(transfer.dwollaId)}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-gray-600">
                          {transfer.dwollaId}
                        </span>
                        <Badge className={getStatusColor(transfer.status)}>
                          {transfer.status}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-6 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {transfer.companyName || transfer.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${transfer.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span>
                          {new Date(transfer.created).toLocaleDateString()}
                        </span>
                        {policyCount > 0 && (
                          <span className="font-medium text-cakewalk-primary">
                            {policyCount} {policyCount === 1 ? "policy" : "policies"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Expanded Policy Details */}
                {isExpanded && transfer.sob?.policies && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">Policy Details</h4>
                      <span className="text-sm text-gray-600">
                        Total: ${totalPolicyCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {transfer.sob.policies.map((policy, index) => (
                        <div
                          key={`${transfer.dwollaId}-${index}`}
                          className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-sm">
                                {policy.policyId}
                              </div>
                              <div className="text-xs text-gray-600">
                                {policy.productName}
                                {policy.planName && ` - ${policy.planName}`}
                                {" • "}
                                {policy.coverageLevel}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className={getCarrierColor(policy.carrier)}
                            >
                              {policy.carrier}
                            </Badge>
                            <span className="font-medium text-sm">
                              ${policy.monthlyCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          
          {transfers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No transfers found matching the selected criteria
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}