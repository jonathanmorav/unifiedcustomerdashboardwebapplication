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
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const selectAll = () => {
    onChange(options.map((opt) => opt.value))
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
            className="text-cakewalk-secondary text-xs hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-50"
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
                  "h-4 w-4 rounded border transition-colors",
                  value.includes(option.value)
                    ? "border-cakewalk-primary bg-cakewalk-primary"
                    : "border-gray-300 bg-white"
                )}
              >
                {value.includes(option.value) && (
                  <CheckCircle2 className="absolute left-0.5 top-0.5 h-3 w-3 text-white" />
                )}
              </div>
            </div>
            <span className="flex-1 text-sm">{option.label}</span>
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
