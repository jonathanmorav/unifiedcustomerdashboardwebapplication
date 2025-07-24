"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertCircle,
  RefreshCw,
  Download,
  Search,
  Filter,
  X,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  User,
  Building,
  Clock,
  CheckCircle,
} from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { getReturnCodeInfo, getCategoryDisplayName } from "@/lib/api/dwolla/return-codes"
import { TransactionDetailModal } from "./TransactionDetailModal"
import { toast } from "sonner"

interface FailedTransaction {
  id: string
  dwollaId: string
  status: string
  amount: number
  created: string
  customerName?: string
  customerEmail?: string
  companyName?: string
  returnCode?: string
  failureReason?: string
  failureCode?: string
  lastUpdated?: string
  // Additional fields for demo
  daysSinceFailed?: number
  previousRetries?: number
  customerPhone?: string
}

interface FailedTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  filter?: {
    type: 'returnCode' | 'category' | 'retryable' | 'nonRetryable'
    value: string
  }
  transactions?: FailedTransaction[]
}

// Generate sample failed transactions
const generateSampleTransactions = (filter?: { type: string; value: string }): FailedTransaction[] => {
  const baseTransactions: FailedTransaction[] = [
    // R01 - Insufficient Funds
    ...Array(15).fill(null).map((_, i) => ({
      id: `trans_r01_${i}`,
      dwollaId: `dwolla_r01_${i}`,
      status: 'failed',
      amount: Math.floor(Math.random() * 5000) + 100,
      created: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      customerName: ['John Smith', 'Jane Doe', 'Robert Johnson', 'Maria Garcia', 'David Lee'][i % 5],
      customerEmail: ['john@example.com', 'jane@example.com', 'robert@example.com', 'maria@example.com', 'david@example.com'][i % 5],
      companyName: ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Prime Services', 'Digital Dynamics'][i % 5],
      returnCode: 'R01',
      failureReason: 'Insufficient Funds',
      daysSinceFailed: Math.floor(Math.random() * 10) + 1,
      previousRetries: Math.floor(Math.random() * 3),
      customerPhone: '(555) 123-4567',
    })),
    // R02 - Account Closed
    ...Array(8).fill(null).map((_, i) => ({
      id: `trans_r02_${i}`,
      dwollaId: `dwolla_r02_${i}`,
      status: 'returned',
      amount: Math.floor(Math.random() * 5000) + 100,
      created: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      customerName: ['Sarah Wilson', 'Michael Brown', 'Lisa Anderson'][i % 3],
      customerEmail: ['sarah@example.com', 'michael@example.com', 'lisa@example.com'][i % 3],
      companyName: ['Innovate LLC', 'Future Tech', 'Smart Systems'][i % 3],
      returnCode: 'R02',
      failureReason: 'Account Closed',
      daysSinceFailed: Math.floor(Math.random() * 20) + 1,
      previousRetries: 0,
      customerPhone: '(555) 234-5678',
    })),
    // R07 - Authorization Revoked
    ...Array(5).fill(null).map((_, i) => ({
      id: `trans_r07_${i}`,
      dwollaId: `dwolla_r07_${i}`,
      status: 'returned',
      amount: Math.floor(Math.random() * 5000) + 100,
      created: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      customerName: ['Tom Davis', 'Emma White'][i % 2],
      customerEmail: ['tom@example.com', 'emma@example.com'][i % 2],
      companyName: ['Enterprise Co', 'Business Plus'][i % 2],
      returnCode: 'R07',
      failureReason: 'Authorization Revoked by Customer',
      daysSinceFailed: Math.floor(Math.random() * 15) + 1,
      previousRetries: 0,
      customerPhone: '(555) 345-6789',
    })),
  ]

  // Filter based on the provided filter
  if (filter) {
    if (filter.type === 'returnCode') {
      return baseTransactions.filter(t => t.returnCode === filter.value)
    }
    if (filter.type === 'category') {
      const codesByCategory: Record<string, string[]> = {
        'funding': ['R01', 'R09'],
        'account': ['R02', 'R03', 'R04'],
        'authorization': ['R05', 'R07', 'R08', 'R10'],
      }
      const codes = codesByCategory[filter.value] || []
      return baseTransactions.filter(t => t.returnCode && codes.includes(t.returnCode))
    }
    if (filter.type === 'retryable') {
      return baseTransactions.filter(t => t.returnCode === 'R01' || t.returnCode === 'R09')
    }
    if (filter.type === 'nonRetryable') {
      return baseTransactions.filter(t => t.returnCode !== 'R01' && t.returnCode !== 'R09')
    }
  }

  return baseTransactions
}

export const FailedTransactionsModal: React.FC<FailedTransactionsModalProps> = ({
  isOpen,
  onClose,
  filter,
  transactions: providedTransactions,
}) => {
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date')
  const [selectedTransaction, setSelectedTransaction] = useState<FailedTransaction | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Use provided transactions or generate sample data
  const allTransactions = providedTransactions || generateSampleTransactions(filter)

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = allTransactions

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.returnCode?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter === 'retryable') {
      filtered = filtered.filter(t => {
        const info = t.returnCode ? getReturnCodeInfo(t.returnCode) : null
        return info?.retryable === true
      })
    } else if (statusFilter === 'nonRetryable') {
      filtered = filtered.filter(t => {
        const info = t.returnCode ? getReturnCodeInfo(t.returnCode) : null
        return info?.retryable === false
      })
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created).getTime() - new Date(a.created).getTime()
      } else if (sortBy === 'amount') {
        return b.amount - a.amount
      } else if (sortBy === 'customer') {
        return (a.customerName || '').localeCompare(b.customerName || '')
      }
      return 0
    })

    return filtered
  }, [allTransactions, searchQuery, statusFilter, sortBy])

  const handleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)))
    }
  }

  const handleSelectTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTransactions(newSelected)
  }

  const handleViewDetails = (transaction: FailedTransaction) => {
    setSelectedTransaction(transaction)
    setShowDetailModal(true)
  }

  const handleBulkRetry = () => {
    const retryableSelected = filteredTransactions.filter(t => 
      selectedTransactions.has(t.id) && 
      t.returnCode && 
      getReturnCodeInfo(t.returnCode).retryable
    )
    console.log(`Retrying ${retryableSelected.length} transactions...`)
    // Implement retry logic here
  }

  const handleExport = () => {
    // Determine which transactions to export
    const transactionsToExport = selectedTransactions.size > 0
      ? filteredTransactions.filter(t => selectedTransactions.has(t.id))
      : filteredTransactions

    // Create CSV content
    const headers = [
      'Transaction ID',
      'Dwolla ID',
      'Date',
      'Customer Name',
      'Customer Email',
      'Company',
      'Amount',
      'Status',
      'Return Code',
      'Return Code Title',
      'Failure Reason',
      'Category',
      'Retryable',
      'Days Since Failed',
      'Previous Retries',
      'Recommended Action'
    ]

    const rows = transactionsToExport.map(transaction => {
      const returnCodeInfo = transaction.returnCode ? getReturnCodeInfo(transaction.returnCode) : null
      
      return [
        transaction.id,
        transaction.dwollaId,
        new Date(transaction.created).toLocaleDateString(),
        transaction.customerName || '',
        transaction.customerEmail || '',
        transaction.companyName || '',
        transaction.amount.toFixed(2),
        transaction.status,
        transaction.returnCode || '',
        returnCodeInfo?.title || '',
        transaction.failureReason || '',
        returnCodeInfo?.category ? getCategoryDisplayName(returnCodeInfo.category) : '',
        returnCodeInfo?.retryable ? 'Yes' : 'No',
        transaction.daysSinceFailed || '0',
        transaction.previousRetries || '0',
        returnCodeInfo?.userAction || ''
      ]
    })

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma or newline
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(',')
      )
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filterDesc = getFilterDescription().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    const filename = `failed_transactions_${filterDesc}_${timestamp}.csv`
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up
    URL.revokeObjectURL(url)
    
    // Show success toast
    toast.success(`Exported ${transactionsToExport.length} transactions`, {
      description: `File saved as ${filename}`
    })
  }

  // Get filter description
  const getFilterDescription = () => {
    if (!filter) return "All Failed Transactions"
    
    if (filter.type === 'returnCode') {
      const info = getReturnCodeInfo(filter.value)
      return `Return Code ${filter.value}: ${info.title}`
    }
    if (filter.type === 'category') {
      return `Category: ${filter.value.charAt(0).toUpperCase() + filter.value.slice(1)} Issues`
    }
    if (filter.type === 'retryable') {
      return "Retryable Failures"
    }
    if (filter.type === 'nonRetryable') {
      return "Non-Retryable Failures (Action Required)"
    }
    
    return "Failed Transactions"
  }

  const selectedCount = selectedTransactions.size
  const retryableCount = filteredTransactions.filter(t => 
    selectedTransactions.has(t.id) && 
    t.returnCode && 
    getReturnCodeInfo(t.returnCode).retryable
  ).length

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="max-h-[90vh] overflow-hidden flex flex-col"
          style={{ maxWidth: '95vw', width: '95vw' }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {getFilterDescription()}
            </DialogTitle>
            <DialogDescription>
              {filteredTransactions.length} transactions • 
              Total: {formatCurrency(filteredTransactions.reduce((sum, t) => sum + t.amount, 0))}
            </DialogDescription>
          </DialogHeader>

          {/* Filters and Actions */}
          <div className="flex items-center justify-between gap-4 py-4 border-y">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer, email, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Failures</SelectItem>
                  <SelectItem value="retryable">Retryable Only</SelectItem>
                  <SelectItem value="nonRetryable">Non-Retryable Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date (Newest)</SelectItem>
                  <SelectItem value="amount">Amount (Highest)</SelectItem>
                  <SelectItem value="customer">Customer Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <>
                  <Badge variant="secondary">
                    {selectedCount} selected
                  </Badge>
                  {retryableCount > 0 && (
                    <Button 
                      size="sm" 
                      onClick={handleBulkRetry}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry {retryableCount}
                    </Button>
                  )}
                </>
              )}
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="flex-1 overflow-auto min-w-0">
            <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead className="min-w-[250px]">Customer</TableHead>
                  <TableHead className="min-w-[120px]">Amount</TableHead>
                  <TableHead className="min-w-[200px]">Return Code</TableHead>
                  <TableHead className="min-w-[100px]">Days Failed</TableHead>
                  <TableHead className="min-w-[100px]">Retries</TableHead>
                  <TableHead className="min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const returnCodeInfo = transaction.returnCode ? getReturnCodeInfo(transaction.returnCode) : null
                  
                  return (
                    <TableRow key={transaction.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedTransactions.has(transaction.id)}
                          onCheckedChange={() => handleSelectTransaction(transaction.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {new Date(transaction.created).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{transaction.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Building className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{transaction.companyName}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{formatCurrency(transaction.amount)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={returnCodeInfo?.retryable ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {transaction.returnCode}
                            </Badge>
                            {returnCodeInfo?.retryable && (
                              <RefreshCw className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{returnCodeInfo?.title}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{transaction.daysSinceFailed} days</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {transaction.previousRetries || 0} attempts
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(transaction)}
                          >
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-500"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Summary Footer */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span>
                    {filteredTransactions.filter(t => t.returnCode && getReturnCodeInfo(t.returnCode).retryable).length} retryable
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>
                    {filteredTransactions.filter(t => t.returnCode && !getReturnCodeInfo(t.returnCode).retryable).length} require action
                  </span>
                </div>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedTransaction(null)
          }}
        />
      )}
    </>
  )
}