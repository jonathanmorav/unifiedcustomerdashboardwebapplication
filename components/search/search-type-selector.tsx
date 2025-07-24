"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { SearchType } from "@/lib/search/unified-search"

interface SearchTypeSelectorProps {
  value: SearchType
  onChange: (value: SearchType) => void
  className?: string
}

const searchTypeInfo: Record<SearchType, { label: string; description: string }> = {
  auto: {
    label: "Auto-detect",
    description: "Automatically detects search type based on your input",
  },
  email: {
    label: "Email",
    description: "Search by customer email address",
  },
  name: {
    label: "Name",
    description: "Search by personal or business name",
  },
  business_name: {
    label: "Business Name",
    description: "Search specifically by company/business name",
  },
  dwolla_id: {
    label: "Dwolla ID",
    description: "Search by Dwolla customer ID (UUID format)",
  },
}

export function SearchTypeSelector({ value, onChange, className }: SearchTypeSelectorProps) {
  return (
    <TooltipProvider>
      <div className={`gap-cakewalk-8 flex items-center ${className}`}>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select search type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(searchTypeInfo).map(([key, info]) => (
              <SelectItem key={key} value={key}>
                {info.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tooltip>
          <TooltipTrigger asChild>
            <InfoIcon className="h-4 w-4 cursor-help text-cakewalk-text-secondary" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="mb-2 font-medium">Search Types:</p>
            <ul className="space-y-1 text-sm">
              {Object.entries(searchTypeInfo).map(([key, info]) => (
                <li key={key}>
                  <span className="font-medium">{info.label}:</span> {info.description}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
