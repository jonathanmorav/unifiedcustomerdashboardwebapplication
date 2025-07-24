"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PaginationOptions } from "@/lib/types/search"

interface PaginationControlsProps {
  pagination: PaginationOptions & { total: number }
  onPaginationChange: (options: PaginationOptions) => void
  className?: string
}

const pageSizeOptions = [10, 20, 50, 100]

export function PaginationControls({
  pagination,
  onPaginationChange,
  className,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize)
  const currentPage = pagination.page

  // Calculate page range to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 7

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show partial pages with ellipsis
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push("...")
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push("...")
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push("...")
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push("...")
        pages.push(totalPages)
      }
    }

    return pages
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPaginationChange({ ...pagination, page })
    }
  }

  const handlePageSizeChange = (size: string) => {
    const newPageSize = parseInt(size)
    // Adjust current page if necessary
    const newTotalPages = Math.ceil(pagination.total / newPageSize)
    const newPage = Math.min(currentPage, newTotalPages)

    onPaginationChange({
      page: newPage,
      pageSize: newPageSize,
    })
  }

  if (pagination.total === 0) {
    return null
  }

  const startItem = (currentPage - 1) * pagination.pageSize + 1
  const endItem = Math.min(currentPage * pagination.pageSize, pagination.total)

  return (
    <div className={`flex flex-col items-center justify-between gap-4 sm:flex-row ${className}`}>
      <div className="text-sm text-cakewalk-text-secondary">
        Showing {startItem} to {endItem} of {pagination.total} results
      </div>

      <div className="flex items-center gap-2">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-cakewalk-text-secondary">Show</span>
          <Select value={pagination.pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-cakewalk-text-secondary">per page</span>
        </div>

        <div className="mx-2 h-4 w-px bg-gray-300" />

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              <div key={index}>
                {page === "..." ? (
                  <span className="px-2 text-sm text-cakewalk-text-secondary">...</span>
                ) : (
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 min-w-[32px] px-2"
                    onClick={() => handlePageChange(page as number)}
                  >
                    {page}
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
