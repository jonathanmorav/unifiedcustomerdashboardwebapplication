"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Shield,
  Heart,
  Eye,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react"
import { Policy } from "@/lib/types/hubspot"
import { formatCurrency } from "@/utils/format-currency"

interface PoliciesPanelProps {
  policies: Policy[]
  isLoading?: boolean
  companyName?: string
  onPolicySelect?: (policy: Policy) => void
  className?: string
}

const getProductIcon = (productName: string | undefined) => {
  if (!productName) return <FileText className="h-4 w-4" />
  
  const product = productName.toLowerCase()
  if (product.includes("dental")) return <Heart className="h-4 w-4" />
  if (product.includes("health") || product.includes("medical")) return <Shield className="h-4 w-4" />
  if (product.includes("vision")) return <Eye className="h-4 w-4" />
  if (product.includes("disability") || product.includes("life")) return <Briefcase className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

const formatDateString = (dateString: string | undefined) => {
  if (!dateString) return 'Not specified'
  
  // Parse date string as local date to avoid timezone conversion issues
  // HubSpot dates are typically in YYYY-MM-DD format
  const parts = dateString.split('T')[0].split('-') // Handle both YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss formats
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed in JavaScript Date
    const day = parseInt(parts[2], 10)
    
    // Create date in local timezone to preserve the original date
    const localDate = new Date(year, month, day)
    return localDate.toLocaleDateString()
  }
  
  // Fallback to original method if parsing fails
  return new Date(dateString).toLocaleDateString()
}



const PolicyCard = ({ policy, onSelect }: { policy: Policy; onSelect?: (policy: Policy) => void }) => {
  return (
    <div 
      className="rounded-xl bg-cakewalk-alice-200 p-4 transition-all duration-200 hover:bg-cakewalk-alice-300 cursor-pointer"
      onClick={() => onSelect?.(policy)}
    >
      <div className="space-y-3">
        {/* Header with Product Name */}
        <div className="flex items-start">
          <div className="flex items-center gap-2">
            <span className="text-cakewalk-primary">
              {getProductIcon(policy.productName)}
            </span>
            <div>
              <h5 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                {policy.productName || 'Unknown Product'}
                {policy.planName && (
                  <span className="ml-1 text-cakewalk-body-xs text-cakewalk-text-secondary">
                    - {policy.planName}
                  </span>
                )}
              </h5>
              <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                {policy.policyHolderName || 'Unknown Policyholder'}
              </p>
            </div>
          </div>
        </div>

        {/* Policy Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-cakewalk-text-tertiary" />
            <div>
              <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">Monthly Cost</p>
              <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                {formatCurrency(policy.costPerMonth || 0)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-cakewalk-text-tertiary" />
            <div>
              <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">Effective Date</p>
              <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                {formatDateString(policy.effectiveDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Coverage Information */}
        {(policy.coverageAmount || policy.coverageLevel) && (
          <div className="pt-2 border-t border-cakewalk-border">
            <div className="flex justify-between">
              <span className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                Coverage:
              </span>
              <span className="text-cakewalk-body-xxs font-medium text-cakewalk-text-primary">
                {policy.coverageAmount 
                  ? formatCurrency(policy.coverageAmount)
                  : policy.coverageLevel || 'Not specified'
                }
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PoliciesPanel({ 
  policies, 
  isLoading = false, 
  companyName, 
  onPolicySelect,
  className = "" 
}: PoliciesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedHolders, setExpandedHolders] = useState<Set<string>>(new Set())

  const togglePolicyHolder = (holderName: string) => {
    setExpandedHolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(holderName)) {
        newSet.delete(holderName)
      } else {
        newSet.add(holderName)
      }
      return newSet
    })
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!policies || policies.length === 0) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <FileText className="h-8 w-8 text-cakewalk-text-tertiary mx-auto mb-2" />
        <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
          No policies found
        </p>
        {companyName && (
          <p className="text-cakewalk-body-xs text-cakewalk-text-tertiary">
            for {companyName}
          </p>
        )}
      </div>
    )
  }

  // Calculate summary metrics
  const totalPolicies = policies.length
  const totalMonthlyCost = policies.reduce((sum, p) => sum + p.costPerMonth, 0)
  
  // Group policies by policyholder name
  const policiesByHolder = policies.reduce((acc, policy) => {
    const holderName = policy.policyHolderName || 'Unknown Policyholder'
    if (!acc[holderName]) {
      acc[holderName] = []
    }
    acc[holderName].push(policy)
    return acc
  }, {} as Record<string, Policy[]>)
  
  // Sort policy holders alphabetically
  const sortedHolders = Object.keys(policiesByHolder).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
  
  // For collapsed view, show first 2 policy holders
  const displayHolders = isExpanded ? sortedHolders : sortedHolders.slice(0, 2)

  return (
    <div className={className}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
            Policies ({policies.length} total • {sortedHolders.length} {sortedHolders.length === 1 ? 'holder' : 'holders'})
          </h4>
          {totalMonthlyCost > 0 && (
            <div className="text-right">
              <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">Monthly Total</p>
              <p className="text-cakewalk-body-sm font-semibold text-cakewalk-primary">
                {formatCurrency(totalMonthlyCost)}
              </p>
            </div>
          )}
        </div>

        {/* Grouped Policies by Holder */}
        <div className="space-y-4">
          {displayHolders.map((holderName) => {
            const holderPolicies = policiesByHolder[holderName]
            const isHolderExpanded = expandedHolders.has(holderName)
            const policyCount = holderPolicies.length
            
            return (
              <div key={holderName} className="border border-cakewalk-border rounded-lg overflow-hidden">
                {/* Policy Holder Header */}
                <div 
                  className="flex items-center justify-between p-3 bg-cakewalk-alice-100 cursor-pointer hover:bg-cakewalk-alice-200 transition-colors duration-200"
                  onClick={() => togglePolicyHolder(holderName)}
                >
                  <div className="flex items-center gap-2">
                    <h5 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                      {holderName}
                    </h5>
                    <Badge variant="secondary" className="text-cakewalk-body-xxs">
                      {policyCount} {policyCount === 1 ? 'policy' : 'policies'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-primary">
                      {formatCurrency(holderPolicies.reduce((sum, p) => sum + p.costPerMonth, 0))}/mo
                    </span>
                    {isHolderExpanded ? (
                      <ChevronUp className="h-4 w-4 text-cakewalk-text-secondary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-cakewalk-text-secondary" />
                    )}
                  </div>
                </div>
                
                {/* Policy Cards for this holder */}
                {isHolderExpanded && (
                  <div className="p-3 space-y-3">
                    {holderPolicies.map((policy) => (
                      <PolicyCard 
                        key={policy.id} 
                        policy={policy} 
                        onSelect={onPolicySelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Expand/Collapse Button for Policy Holders */}
        {sortedHolders.length > 2 && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-cakewalk-primary hover:text-cakewalk-primary-dark hover:bg-cakewalk-alice-200"
            >
              {isExpanded ? (
                <>
                  Show Less <ChevronUp className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  View All {sortedHolders.length} Policy Holders <ChevronDown className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 