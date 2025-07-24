"use client"

import { useState } from "react"
import { DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { AmountRange } from "@/lib/types/search"

interface AmountRangeFilterProps {
  label: string
  value?: AmountRange
  onChange: (value: AmountRange | undefined) => void
  currency?: string
  min?: number
  max?: number
  step?: number
  className?: string
}

const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const presetRanges = [
  { label: "Under $100", min: 0, max: 100 },
  { label: "$100 - $500", min: 100, max: 500 },
  { label: "$500 - $1,000", min: 500, max: 1000 },
  { label: "$1,000 - $5,000", min: 1000, max: 5000 },
  { label: "$5,000 - $10,000", min: 5000, max: 10000 },
  { label: "Over $10,000", min: 10000, max: 1000000 },
]

export function AmountRangeFilter({
  label,
  value,
  onChange,
  currency = "USD",
  min = 0,
  max = 100000,
  step = 100,
  className,
}: AmountRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localRange, setLocalRange] = useState<[number, number]>([
    value?.min ?? min,
    value?.max ?? max,
  ])
  const [inputMin, setInputMin] = useState(String(value?.min ?? min))
  const [inputMax, setInputMax] = useState(String(value?.max ?? max))

  const formatRange = (range: AmountRange) => {
    return `${formatCurrency(range.min, currency)} - ${formatCurrency(range.max, currency)}`
  }

  const handlePresetClick = (preset: (typeof presetRanges)[0]) => {
    const range = { min: preset.min, max: preset.max, currency }
    setLocalRange([preset.min, preset.max])
    setInputMin(String(preset.min))
    setInputMax(String(preset.max))
    onChange(range)
    setIsOpen(false)
  }

  const handleSliderChange = (values: number[]) => {
    setLocalRange([values[0], values[1]])
    setInputMin(String(values[0]))
    setInputMax(String(values[1]))
  }

  const handleInputChange = (type: "min" | "max", value: string) => {
    const numValue = parseInt(value) || 0
    if (type === "min") {
      setInputMin(value)
      if (!isNaN(numValue)) {
        setLocalRange([numValue, localRange[1]])
      }
    } else {
      setInputMax(value)
      if (!isNaN(numValue)) {
        setLocalRange([localRange[0], numValue])
      }
    }
  }

  const handleApply = () => {
    const minVal = parseInt(inputMin) || 0
    const maxVal = parseInt(inputMax) || 0

    if (minVal <= maxVal) {
      onChange({ min: minVal, max: maxVal, currency })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setLocalRange([min, max])
    setInputMin(String(min))
    setInputMax(String(max))
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
            <DollarSign className="mr-2 h-4 w-4" />
            {value ? formatRange(value) : "Select amount range"}
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
              <div className="space-y-4">
                <div className="px-2">
                  <Slider
                    value={localRange}
                    onValueChange={handleSliderChange}
                    min={min}
                    max={max}
                    step={step}
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="min-amount" className="text-xs">
                      Min amount
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="min-amount"
                        type="number"
                        value={inputMin}
                        onChange={(e) => handleInputChange("min", e.target.value)}
                        className="w-full rounded-md border py-1 pl-8 pr-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="max-amount" className="text-xs">
                      Max amount
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="max-amount"
                        type="number"
                        value={inputMax}
                        onChange={(e) => handleInputChange("max", e.target.value)}
                        className="w-full rounded-md border py-1 pl-8 pr-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClear} className="flex-1">
                Clear
              </Button>
              <Button size="sm" onClick={handleApply} className="flex-1">
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
