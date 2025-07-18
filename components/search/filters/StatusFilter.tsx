"use client"

import { CheckCircle2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusFilterProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  options: {
    value: string
    label: string
    count?: number
  }[]
  className?: string
}

export function StatusFilter({ label, value, onChange, options, className }: StatusFilterProps) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const selectAll = () => {
    onChange(options.map(opt => opt.value))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-cakewalk-primary hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-cakewalk-secondary hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="sr-only"
              />
              <div
                className={cn(
                  "w-4 h-4 rounded border transition-colors",
                  value.includes(option.value)
                    ? "bg-cakewalk-primary border-cakewalk-primary"
                    : "bg-white border-gray-300"
                )}
              >
                {value.includes(option.value) && (
                  <CheckCircle2 className="h-3 w-3 text-white absolute top-0.5 left-0.5" />
                )}
              </div>
            </div>
            <span className="text-sm flex-1">{option.label}</span>
            {option.count !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {option.count}
              </Badge>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}