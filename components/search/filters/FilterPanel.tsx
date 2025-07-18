"use client"

import { useState } from "react"
import { X, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DateRangeFilter } from "./DateRangeFilter"
import { AmountRangeFilter } from "./AmountRangeFilter"
import { StatusFilter } from "./StatusFilter"
import { cn } from "@/lib/utils"
import type { SearchFilters, CustomerStatus, TransferStatus, FundingSourceStatus } from "@/lib/types/search"

interface FilterPanelProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  onClose?: () => void
  className?: string
}

interface FilterSection {
  id: string
  title: string
  icon?: React.ReactNode
}

const sections: FilterSection[] = [
  { id: "status", title: "Status Filters" },
  { id: "date", title: "Date Filters" },
  { id: "amount", title: "Amount Filters" },
  { id: "other", title: "Other Filters" },
]

export function FilterPanel({ filters, onFiltersChange, onClose, className }: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["status"])
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters)

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const updateFilters = (updates: Partial<SearchFilters>) => {
    const newFilters = { ...localFilters, ...updates }
    setLocalFilters(newFilters)
  }

  const applyFilters = () => {
    onFiltersChange(localFilters)
  }

  const clearAllFilters = () => {
    const clearedFilters: SearchFilters = {}
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (localFilters.customerStatus?.length) count += localFilters.customerStatus.length
    if (localFilters.transferStatus?.length) count += localFilters.transferStatus.length
    if (localFilters.fundingSourceStatus?.length) count += localFilters.fundingSourceStatus.length
    if (localFilters.createdDateRange) count++
    if (localFilters.modifiedDateRange) count++
    if (localFilters.transferDateRange) count++
    if (localFilters.transferAmountRange) count++
    if (localFilters.benefitAmountRange) count++
    if (localFilters.hasFailedTransfers !== undefined) count++
    if (localFilters.hasUnverifiedFunding !== undefined) count++
    if (localFilters.hasPendingInvoices !== undefined) count++
    return count
  }

  const activeCount = getActiveFilterCount()

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-cakewalk-secondary" />
          <h3 className="text-cakewalk-h5 font-cakewalk-semibold text-cakewalk-primary-dark">
            Filters
          </h3>
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              Clear all
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Status Filters Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection("status")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium">Status Filters</span>
            {expandedSections.includes("status") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.includes("status") && (
            <div className="p-3 border-t space-y-3">
              <StatusFilter
                label="Customer Status"
                value={localFilters.customerStatus || []}
                onChange={(value) => updateFilters({ customerStatus: value as CustomerStatus[] })}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "verified", label: "Verified" },
                  { value: "unverified", label: "Unverified" },
                  { value: "suspended", label: "Suspended" },
                ]}
              />
              <StatusFilter
                label="Transfer Status"
                value={localFilters.transferStatus || []}
                onChange={(value) => updateFilters({ transferStatus: value as TransferStatus[] })}
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "pending", label: "Pending" },
                  { value: "failed", label: "Failed" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "processed", label: "Processed" },
                ]}
              />
              <StatusFilter
                label="Funding Source Status"
                value={localFilters.fundingSourceStatus || []}
                onChange={(value) => updateFilters({ fundingSourceStatus: value as FundingSourceStatus[] })}
                options={[
                  { value: "verified", label: "Verified" },
                  { value: "unverified", label: "Unverified" },
                ]}
              />
            </div>
          )}
        </div>

        {/* Date Filters Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection("date")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium">Date Filters</span>
            {expandedSections.includes("date") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.includes("date") && (
            <div className="p-3 border-t space-y-3">
              <DateRangeFilter
                label="Created Date"
                value={localFilters.createdDateRange}
                onChange={(value) => updateFilters({ createdDateRange: value })}
              />
              <DateRangeFilter
                label="Modified Date"
                value={localFilters.modifiedDateRange}
                onChange={(value) => updateFilters({ modifiedDateRange: value })}
              />
              <DateRangeFilter
                label="Transfer Date"
                value={localFilters.transferDateRange}
                onChange={(value) => updateFilters({ transferDateRange: value })}
              />
            </div>
          )}
        </div>

        {/* Amount Filters Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection("amount")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium">Amount Filters</span>
            {expandedSections.includes("amount") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.includes("amount") && (
            <div className="p-3 border-t space-y-3">
              <AmountRangeFilter
                label="Transfer Amount"
                value={localFilters.transferAmountRange}
                onChange={(value) => updateFilters({ transferAmountRange: value })}
                currency="USD"
              />
              <AmountRangeFilter
                label="Benefit Amount"
                value={localFilters.benefitAmountRange}
                onChange={(value) => updateFilters({ benefitAmountRange: value })}
                currency="USD"
              />
            </div>
          )}
        </div>

        {/* Other Filters Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection("other")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium">Other Filters</span>
            {expandedSections.includes("other") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.includes("other") && (
            <div className="p-3 border-t space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.hasFailedTransfers || false}
                  onChange={(e) => updateFilters({ hasFailedTransfers: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Has Failed Transfers</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.hasUnverifiedFunding || false}
                  onChange={(e) => updateFilters({ hasUnverifiedFunding: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Has Unverified Funding</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.hasPendingInvoices || false}
                  onChange={(e) => updateFilters({ hasPendingInvoices: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Has Pending Invoices</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={applyFilters}
          className="flex-1"
          disabled={JSON.stringify(localFilters) === JSON.stringify(filters)}
        >
          Apply Filters
        </Button>
      </div>
    </Card>
  )
}