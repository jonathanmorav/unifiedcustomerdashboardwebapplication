"use client"

import React, { useState } from "react"
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
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { Skeleton } from "@/components/ui/skeleton"

interface ACHTransaction {
  id: string
  dwollaId: string
  status: "pending" | "processing" | "processed" | "failed" | "cancelled" | "returned"
  amount: number
  currency: string
  direction: "credit" | "debit"
  created: string
  customerName?: string
  companyName?: string
  bankLastFour?: string
  correlationId?: string
  invoiceNumber?: string
  transactionType?: string
  fees?: number
  netAmount?: number
}

interface TransactionTableProps {
  transactions: ACHTransaction[]
  isLoading?: boolean
  totalAmount?: number
  onTransactionClick?: (transaction: ACHTransaction) => void
  currentPage?: number
  itemsPerPage?: number
}

type SortField = "created" | "amount" | "customerName" | "status"
type SortDirection = "asc" | "desc"

const getStatusBadge = (status: ACHTransaction["status"]) => {
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

  return <Badge className={`${variant.color} border-0`}>{variant.text}</Badge>
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  isLoading = false,
  totalAmount,
  onTransactionClick,
  currentPage: _currentPage = 1,
  itemsPerPage = 25,
}) => {
  const [sortField, setSortField] = useState<SortField>("created")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Sort transactions
  const sortedTransactions = [...transactions].sort((a, b) => {
    const aValue = a[sortField] || ""
    const bValue = b[sortField] || ""

    if (sortField === "amount") {
      return sortDirection === "asc" ? a.amount - b.amount : b.amount - a.amount
    }

    if (sortField === "created") {
      return sortDirection === "asc"
        ? new Date(a.created).getTime() - new Date(b.created).getTime()
        : new Date(b.created).getTime() - new Date(a.created).getTime()
    }

    // String comparison for other fields
    const compare = aValue.toString().localeCompare(bValue.toString())
    return sortDirection === "asc" ? compare : -compare
  })

  // Paginate transactions - only if we don't have server-side pagination
  // When we have server-side pagination, transactions array is already paginated
  const paginatedTransactions =
    transactions.length <= itemsPerPage ? sortedTransactions : sortedTransactions

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
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
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
              <TableHead>
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
              <TableHead className="text-right">
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
              <TableHead>
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
            {paginatedTransactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className="cursor-pointer hover:bg-cakewalk-alice-300 dark:hover:bg-cakewalk-alice-300"
                onClick={() => onTransactionClick?.(transaction)}
              >
                <TableCell className="font-medium">
                  {new Date(transaction.created).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                <code className="rounded bg-cakewalk-neutral px-2 py-1 font-mono text-xs dark:bg-cakewalk-neutral">
                    ...{transaction.dwollaId.slice(-12)}
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
                <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                <TableCell>
                  {transaction.bankLastFour ? `****${transaction.bankLastFour}` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
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
  )
}
