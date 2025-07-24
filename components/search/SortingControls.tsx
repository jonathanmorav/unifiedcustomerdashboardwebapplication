"use client"

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SortOptions, SortField, SortOrder } from "@/lib/types/search"

interface SortingControlsProps {
  currentSort?: SortOptions
  onSortChange: (sort: SortOptions) => void
  className?: string
}

const sortFields: { value: SortField; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "date_created", label: "Date Created" },
  { value: "date_modified", label: "Date Modified" },
  { value: "customer_name", label: "Customer Name" },
  { value: "company_name", label: "Company Name" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
]

export function SortingControls({ currentSort, onSortChange, className }: SortingControlsProps) {
  const handleSortFieldChange = (field: SortField) => {
    if (currentSort?.field === field) {
      // Toggle order if same field
      onSortChange({
        field,
        order: currentSort.order === "asc" ? "desc" : "asc",
      })
    } else {
      // Default to descending for new field (except name fields)
      const defaultOrder = field.includes("name") ? "asc" : "desc"
      onSortChange({
        field,
        order: defaultOrder,
      })
    }
  }

  const currentField = sortFields.find((f) => f.value === currentSort?.field)
  const sortIcon = currentSort?.order === "asc" ? ArrowUp : ArrowDown

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {currentField?.label || "Sort by"}
            {currentSort && React.createElement(sortIcon, { className: "ml-2 h-3 w-3" })}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sortFields.map((field) => (
            <DropdownMenuItem
              key={field.value}
              onClick={() => handleSortFieldChange(field.value)}
              className="flex items-center justify-between"
            >
              <span>{field.label}</span>
              {currentSort?.field === field.value && (
                <span className="ml-2">
                  {React.createElement(currentSort.order === "asc" ? ArrowUp : ArrowDown, {
                    className: "h-4 w-4",
                  })}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
