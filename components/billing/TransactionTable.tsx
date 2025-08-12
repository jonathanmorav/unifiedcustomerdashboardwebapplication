"use client"

import React, { useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getReturnCodeInfo } from "@/lib/api/dwolla/return-codes"

interface ACHTransaction {
  id: string
  dwollaId: string
  status: "pending" | "processing" | "processed" | "failed" | "cancelled" | "returned" | "reclaimed"
  amount: number
  currency: string
  direction: "credit" | "debit"
  created: string
  customerName?: string
  companyName?: string
  bankLastFour?: string
  correlationId?: string
  invoiceNumber?: string
  returnCode?: string
  failureCode?: string
  failureReason?: string
  transactionType?: string
  fees?: number
  netAmount?: number
}

interface TransactionTableProps {
  transactions: ACHTransaction[]
  isLoading?: boolean
  totalAmount?: number
  onTransactionClick?: (transaction: ACHTransaction) => void
  // Keep props for backward compatibility with callers, but ignore internally
  currentPage?: number
  itemsPerPage?: number
}

type SortField = "created" | "amount" | "customerName" | "status"
type SortDirection = "asc" | "desc"

const getStatusBadge = (transaction: ACHTransaction) => {
  const { status, returnCode } = transaction
  
  const variants: Record<string, { color: string; text: string }> = {
    pending: {
      color: "bg-cakewalk-warning-light text-cakewalk-warning",
      text: "Pending",
    },
    processing: {
      color: "bg-cakewalk-info-light text-cakewalk-info",
      text: "Processing",
    },
    processed: {
      color: "bg-cakewalk-success-light text-black",
      text: "Processed",
    },
    failed: { color: "bg-cakewalk-error-light text-cakewalk-error", text: "Failed" },
    cancelled: {
      color: "bg-cakewalk-neutral text-cakewalk-neutral-dark",
      text: "Cancelled",
    },
    returned: {
      color: "bg-cakewalk-warning-light text-cakewalk-warning",
      text: "Returned",
    },
    // Handle other Dwolla statuses
    reclaimed: {
      color: "bg-cakewalk-info-light text-cakewalk-info",
      text: "Reclaimed",
    },
  }

  // Get variant or use default
  const variant = variants[status?.toLowerCase()] ||
    variants[status] || {
      color: "bg-cakewalk-neutral text-cakewalk-neutral-dark",
      text: status || "Unknown",
    }

  // If there's a return code, show it with tooltip
  if (returnCode && (status === 'failed' || status === 'returned')) {
    const returnCodeInfo = getReturnCodeInfo(returnCode)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Badge className={`${variant.color} border-0`}>
              {variant.text}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {returnCode}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-semibold">{returnCodeInfo.title}</p>
          <p className="text-sm">{returnCodeInfo.description}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return <Badge className={`${variant.color} border-0`}>{variant.text}</Badge>
}

// Client table no longer renders its own pager; pagination is handled at the page level

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  isLoading = false,
  totalAmount,
  onTransactionClick,
  currentPage: _currentPage = 1, // ignored
  itemsPerPage: _itemsPerPage = 25, // ignored
}) => {
  // Pagination is controlled at the page level; no local pager state

  const [sortField, setSortField] = useState<SortField>("created")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // No local page management

  // Date formatter uses the user's locale
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }), [])

  const getComparable = (val: unknown) => (val ?? "").toString().toLowerCase()

  // Memoized sorted transactions
  const sortedTransactions = useMemo(() => {
    const copy = [...transactions]
    copy.sort((a, b) => {
      if (sortField === "amount") {
        return sortDirection === "asc" ? a.amount - b.amount : b.amount - a.amount
      }
      if (sortField === "created") {
        const aTime = new Date(a.created).getTime()
        const bTime = new Date(b.created).getTime()
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime
      }
      const aVal = getComparable((a as any)[sortField])
      const bVal = getComparable((b as any)[sortField])
      const cmp = aVal.localeCompare(bVal)
      return sortDirection === "asc" ? cmp : -cmp
    })
    return copy
  }, [transactions, sortField, sortDirection])

  // Render the received transactions (server-paginated)
  const visibleTransactions = sortedTransactions

  // a11y: compute aria-sort value for headers
  const ariaSortFor = (field: SortField): "ascending" | "descending" | "none" =>
    sortField === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-cakewalk-text-tertiary" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-cakewalk-text-secondary">
        No transactions found. Adjust your filters to see more results.
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Pagination is handled at the page level; removed local pager */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]" aria-sort={ariaSortFor("created")}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("created")}
                  >
                    Date/Time
                    <SortIcon field="created" />
                  </Button>
                </TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead aria-sort={ariaSortFor("customerName")}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("customerName")}
                  >
                    Customer
                    <SortIcon field="customerName" />
                  </Button>
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right" aria-sort={ariaSortFor("amount")}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("amount")}
                  >
                    Amount
                    <SortIcon field="amount" />
                  </Button>
                </TableHead>
                <TableHead>Direction</TableHead>
                <TableHead aria-sort={ariaSortFor("status")}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <SortIcon field="status" />
                  </Button>
                </TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTransactions.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className="cursor-pointer hover:bg-cakewalk-alice-300 dark:hover:bg-cakewalk-alice-300"
                  onClick={() => onTransactionClick?.(transaction)}
                >
                  <TableCell className="font-medium">
                    {dateFormatter.format(new Date(transaction.created))}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-cakewalk-neutral px-2 py-1 font-mono text-xs dark:bg-cakewalk-neutral">
                      {transaction.dwollaId ? `...${transaction.dwollaId.slice(-12)}` : "-"}
                    </code>
                  </TableCell>
                  <TableCell>{transaction.customerName || "-"}</TableCell>
                  <TableCell>{transaction.companyName || "-"}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span
                      className={
                        transaction.direction === "debit" ? "text-cakewalk-error" : "text-cakewalk-success"
                      }
                    >
                      {transaction.direction === "debit" ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {transaction.direction === "credit" ? "Credit" : "Debit"}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(transaction)}</TableCell>
                  <TableCell>
                    {transaction.bankLastFour ? `****${transaction.bankLastFour}` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="View transaction details"
                      onClick={(e) => {
                        e.stopPropagation()
                        onTransactionClick?.(transaction)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Pagination is handled at the page level; removed local pager */}
        </div>

        {/* Running Total */}
        {totalAmount !== undefined && (
          <div className="flex justify-end border-t pt-4">
            <div className="text-right">
              <p className="text-sm text-cakewalk-text-secondary">Running Total</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
