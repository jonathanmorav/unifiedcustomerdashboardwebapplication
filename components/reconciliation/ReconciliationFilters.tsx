"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ReconciliationFiltersProps {
  filters: {
    status: "processed" | "pending" | "failed" | "all"
    startDate: Date | null
    endDate: Date | null
  }
  onFiltersChange: (filters: any) => void
  isLoading: boolean
}

export function ReconciliationFilters({
  filters,
  onFiltersChange,
  isLoading,
}: ReconciliationFiltersProps) {
  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value as "processed" | "pending" | "failed" | "all",
    })
  }

  const handleStartDateChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: date || null,
    })
  }

  const handleEndDateChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      endDate: date || null,
    })
  }

  const handleClearFilters = () => {
    onFiltersChange({
      status: "processed",
      startDate: null,
      endDate: null,
    })
  }

  const hasActiveFilters = 
    filters.status !== "processed" || 
    filters.startDate !== null || 
    filters.endDate !== null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-end gap-4">
          {/* Status Filter */}
          <div className="flex-1 max-w-xs">
            <Label htmlFor="status" className="text-sm font-medium mb-1 block">
              Transfer Status
            </Label>
            <Select
              value={filters.status}
              onValueChange={handleStatusChange}
              disabled={isLoading}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Date Filter */}
          <div className="flex-1 max-w-xs">
            <Label htmlFor="startDate" className="text-sm font-medium mb-1 block">
              Start Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="startDate"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.startDate && "text-muted-foreground"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.startDate ? format(filters.startDate, "PPP") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.startDate || undefined}
                  onSelect={handleStartDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date Filter */}
          <div className="flex-1 max-w-xs">
            <Label htmlFor="endDate" className="text-sm font-medium mb-1 block">
              End Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="endDate"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.endDate && "text-muted-foreground"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.endDate ? format(filters.endDate, "PPP") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.endDate || undefined}
                  onSelect={handleEndDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span>Active filters:</span>
            {filters.status !== "processed" && (
              <span className="px-2 py-1 bg-gray-100 rounded-md">
                Status: {filters.status}
              </span>
            )}
            {filters.startDate && (
              <span className="px-2 py-1 bg-gray-100 rounded-md">
                From: {format(filters.startDate, "PP")}
              </span>
            )}
            {filters.endDate && (
              <span className="px-2 py-1 bg-gray-100 rounded-md">
                To: {format(filters.endDate, "PP")}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}