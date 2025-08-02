"use client"

import { useState } from "react"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { DateRange } from "@/lib/types/search"

interface DateRangeFilterProps {
  label: string
  value?: DateRange
  onChange: (value: DateRange | undefined) => void
  className?: string
}

const presetRanges = [
  {
    label: "Today",
    getValue: () => ({
      start: new Date().toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    }),
  },
  {
    label: "Last 7 days",
    getValue: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 7)
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] }
    },
  },
  {
    label: "Last 30 days",
    getValue: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] }
    },
  },
  {
    label: "Last 90 days",
    getValue: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 90)
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] }
    },
  },
  {
    label: "This month",
    getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] }
    },
  },
  {
    label: "Last month",
    getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] }
    },
  },
]

export function DateRangeFilter({ label, value, onChange, className }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [startDate, setStartDate] = useState(
    value?.start 
      ? (typeof value.start === "string" ? value.start : value.start.toISOString().split("T")[0])
      : ""
  )
  const [endDate, setEndDate] = useState(
    value?.end
      ? (typeof value.end === "string" ? value.end : value.end.toISOString().split("T")[0])
      : ""
  )

  const formatDateRange = (range: DateRange) => {
    const start = new Date(range.start).toLocaleDateString()
    const end = new Date(range.end).toLocaleDateString()
    return `${start} - ${end}`
  }

  const handlePresetClick = (preset: (typeof presetRanges)[0]) => {
    const range = preset.getValue()
    setStartDate(range.start)
    setEndDate(range.end)
    onChange(range)
    setIsOpen(false)
  }

  const handleCustomRange = () => {
    if (startDate && endDate) {
      onChange({ start: startDate, end: endDate })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setStartDate("")
    setEndDate("")
    onChange(undefined)
    setIsOpen(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {value ? formatDateRange(value) : "Select date range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick select</h4>
              <div className="grid grid-cols-2 gap-2">
                {presetRanges.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Custom range</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-xs">
                    Start date
                  </Label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border px-2 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-xs">
                    End date
                  </Label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-md border px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClear} className="flex-1">
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleCustomRange}
                disabled={!startDate || !endDate}
                className="flex-1"
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
