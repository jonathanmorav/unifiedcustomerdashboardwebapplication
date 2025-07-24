"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Filter, Calendar as CalendarIcon, Search, X, ChevronDown, DollarSign } from "lucide-react"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { getDateRangeFromPreset, DatePreset } from "@/utils/datePresets"

export interface BillingFilterValues {
  dateRange: {
    start: Date | null
    end: Date | null
    preset?: "today" | "week" | "month" | "quarter" | "year" | "custom"
  }
  status: string[]
  amountRange: {
    min: number | null
    max: number | null
  }
  direction: "all" | "credit" | "debit"
  searchQuery: string
}

interface BillingFiltersProps {
  filters: BillingFilterValues
  onFiltersChange: (filters: BillingFilterValues) => void
  onClearFilters: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const datePresets = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year", value: "year" },
  { label: "Custom Range", value: "custom" },
]

const statusOptions = [
  { label: "Pending", value: "pending", color: "bg-cakewalk-warning-light" },
  { label: "Processing", value: "processing", color: "bg-cakewalk-info-light" },
  { label: "Processed", value: "processed", color: "bg-cakewalk-success-light" },
  { label: "Failed", value: "failed", color: "bg-cakewalk-error-light" },
  { label: "Cancelled", value: "cancelled", color: "bg-cakewalk-neutral" },
  { label: "Returned", value: "returned", color: "bg-cakewalk-warning-light" },
]

export const BillingFilters: React.FC<BillingFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  // Local state for custom date range picker
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined)

  // Initialize temp date range when switching to custom mode
  useEffect(() => {
    if (filters.dateRange.preset === "custom" && filters.dateRange.start && filters.dateRange.end) {
      setTempDateRange({
        from: filters.dateRange.start,
        to: filters.dateRange.end,
      })
    }
  }, [filters.dateRange.preset, filters.dateRange.start, filters.dateRange.end])

  const handleDatePresetChange = (preset: string) => {
    if (preset === "custom") {
      // When switching to custom, preserve existing dates but don't overwrite them
      if (filters.dateRange.preset !== "custom") {
        // Only set to custom if we weren't already in custom mode
        onFiltersChange({
          ...filters,
          dateRange: {
            start: filters.dateRange.start,
            end: filters.dateRange.end,
            preset: "custom",
          },
        })
      }
      return
    }

    // Use the immutable date preset helper with Sunday as week start (weekStartsOn: 0)
    const { start, end } = getDateRangeFromPreset(preset as DatePreset, new Date(), 0)

    onFiltersChange({
      ...filters,
      dateRange: { start, end, preset: preset as any },
    })
  }

  const handleCustomDateSelect = (dateRange: DateRange | undefined) => {
    setTempDateRange(dateRange)
  }

  const handleApplyCustomRange = () => {
    if (tempDateRange?.from && tempDateRange?.to) {
      onFiltersChange({
        ...filters,
        dateRange: {
          start: tempDateRange.from,
          end: tempDateRange.to,
          preset: "custom",
        },
        // Reset to first page when applying new date range
      })
      setIsCustomDateOpen(false)

      // Reset currentPage to 1 by triggering a page state update in parent
      // This is handled by the parent component that manages currentPage state
    }
  }

  const handleClearCustomRange = () => {
    setTempDateRange(undefined)
    onFiltersChange({
      ...filters,
      dateRange: { start: null, end: null, preset: "custom" },
    })
    setIsCustomDateOpen(false)
  }

  const handleStatusChange = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]

    onFiltersChange({
      ...filters,
      status: newStatuses,
    })
  }

  const handleAmountChange = (type: "min" | "max", value: string) => {
    const amount = value ? parseFloat(value) : null
    onFiltersChange({
      ...filters,
      amountRange: {
        ...filters.amountRange,
        [type]: amount,
      },
    })
  }

  const activeFilterCount = [
    filters.dateRange.start ? 1 : 0,
    filters.status.length > 0 ? 1 : 0,
    filters.amountRange.min || filters.amountRange.max ? 1 : 0,
    filters.searchQuery ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <Card className="shadow-cakewalk-medium" data-testid="billing-filters">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-cakewalk-primary px-2 py-1 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                Clear All
              </Button>
            )}
            {onToggleCollapse && (
              <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
                />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select
                value={filters.dateRange.preset || "custom"}
                onValueChange={handleDatePresetChange}
              >
                <SelectTrigger data-testid="date-range-select">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  {datePresets.map((preset) => (
                    <SelectItem
                      key={preset.value}
                      value={preset.value}
                      data-testid={`date-range-option-${preset.value}`}
                    >
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.dateRange.start && filters.dateRange.end && (
                <p
                  className="text-xs text-cakewalk-text-secondary"
                  data-testid="selected-date-range"
                >
                  {format(filters.dateRange.start, "MMM d, yyyy")} -{" "}
                  {format(filters.dateRange.end, "MMM d, yyyy")}
                </p>
              )}

              {/* Custom Date Range Picker */}
              {filters.dateRange.preset === "custom" && (
                <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      onClick={() => setIsCustomDateOpen(true)}
                      data-testid="custom-date-picker-trigger"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempDateRange?.from && tempDateRange?.to
                        ? `${format(tempDateRange.from, "MMM d, yyyy")} - ${format(tempDateRange.to, "MMM d, yyyy")}`
                        : "Select custom date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-4">
                      <Calendar
                        mode="range"
                        defaultMonth={tempDateRange?.from}
                        selected={tempDateRange}
                        onSelect={handleCustomDateSelect}
                        numberOfMonths={2}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        data-testid="calendar"
                      />
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearCustomRange}
                          className="flex-1"
                          data-testid="clear-custom-range"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApplyCustomRange}
                          disabled={!tempDateRange?.from || !tempDateRange?.to}
                          className="flex-1"
                          data-testid="apply-custom-range"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {filters.status.length === 0
                      ? "All statuses"
                      : `${filters.status.length} selected`}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    {statusOptions.map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={status.value}
                          checked={filters.status.includes(status.value)}
                          onCheckedChange={() => handleStatusChange(status.value)}
                        />
                        <label
                          htmlFor={status.value}
                          className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <span className={`h-3 w-3 rounded-full ${status.color}`} />
                          {status.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Amount Range Filter */}
            <div className="space-y-2">
              <Label>Amount Range</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-cakewalk-text-tertiary" />
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min || ""}
                    onChange={(e) => handleAmountChange("min", e.target.value)}
                    className="pl-8"
                  />
                </div>
                <span className="text-cakewalk-text-secondary">-</span>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-cakewalk-text-tertiary" />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max || ""}
                    onChange={(e) => handleAmountChange("max", e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            {/* Direction Filter */}
            {/* Direction filter removed - only showing customer payments (credits) */}

            {/* Search */}
            <div className="space-y-2 lg:col-span-4">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-cakewalk-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search by ID, customer name, company, or reference..."
                  value={filters.searchQuery}
                  onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
                  className="pl-10"
                />
                {filters.searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1"
                    onClick={() => onFiltersChange({ ...filters, searchQuery: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.dateRange.start && (
                <div className="flex items-center gap-2 rounded-full bg-cakewalk-neutral px-3 py-1 text-sm dark:bg-cakewalk-neutral">
                  <CalendarIcon className="h-3 w-3" />
                  {format(filters.dateRange.start, "MMM d")} -{" "}
                  {format(filters.dateRange.end!, "MMM d, yyyy")}
                  <button
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        dateRange: { start: null, end: null },
                      })
                    }
                    className="ml-1 hover:text-cakewalk-error"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {filters.status.map((status) => (
                <div
                  key={status}
                  className="flex items-center gap-2 rounded-full bg-cakewalk-neutral px-3 py-1 text-sm dark:bg-cakewalk-neutral"
                >
                  {status}
                  <button
                    onClick={() => handleStatusChange(status)}
                    className="ml-1 hover:text-cakewalk-error"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
