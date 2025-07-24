"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
  showFirstLast?: boolean
  maxVisiblePages?: number
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onChange,
  className = "",
  showFirstLast = true,
  maxVisiblePages = 50, // Performance cap
}) => {
  if (totalPages <= 1) {
    return null
  }

  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = []

    // If total pages is within max visible, show all
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // Always show first page
    pages.push(1)

    // Calculate range around current page
    const maxSurrounding = Math.floor((maxVisiblePages - 4) / 2) // Reserve space for first, last, and ellipses
    let startPage = Math.max(2, currentPage - maxSurrounding)
    let endPage = Math.min(totalPages - 1, currentPage + maxSurrounding)

    // Adjust range to use full maxVisiblePages
    const rangeSize = endPage - startPage + 1
    if (rangeSize < maxVisiblePages - 4) {
      if (startPage === 2) {
        endPage = Math.min(totalPages - 1, startPage + (maxVisiblePages - 4) - 1)
      } else if (endPage === totalPages - 1) {
        startPage = Math.max(2, endPage - (maxVisiblePages - 4) + 1)
      }
    }

    // Add ellipsis and pages
    if (startPage > 2) {
      pages.push("ellipsis")
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    if (endPage < totalPages - 1) {
      pages.push("ellipsis")
    }

    // Always show last page (if not already included)
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onChange(page)
    }
  }

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      {showFirstLast && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => (
          <div key={`${page}-${index}`}>
            {page === "ellipsis" ? (
              <span className="px-2 text-sm text-gray-500 dark:text-gray-400" aria-hidden="true">
                ...
              </span>
            ) : (
              <Button
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-[32px] px-2"
                onClick={() => handlePageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
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
        aria-label="Go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {showFirstLast && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Go to last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export { Pagination }
