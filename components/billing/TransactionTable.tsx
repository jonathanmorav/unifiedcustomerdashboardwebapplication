'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/utils/format-currency';
import { Skeleton } from '@/components/ui/skeleton';

interface ACHTransaction {
  id: string;
  dwollaId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'returned';
  amount: number;
  currency: string;
  direction: 'credit' | 'debit';
  created: string;
  customerName?: string;
  companyName?: string;
  bankLastFour?: string;
  correlationId?: string;
  invoiceNumber?: string;
  transactionType?: string;
  fees?: number;
  netAmount?: number;
}

interface TransactionTableProps {
  transactions: ACHTransaction[];
  isLoading?: boolean;
  totalAmount?: number;
  onTransactionClick?: (transaction: ACHTransaction) => void;
}

type SortField = 'created' | 'amount' | 'customerName' | 'status';
type SortDirection = 'asc' | 'desc';

const getStatusBadge = (status: ACHTransaction['status']) => {
  const variants: Record<string, { color: string; text: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', text: 'Pending' },
    processing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', text: 'Processing' },
    completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', text: 'Completed' },
    failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', text: 'Failed' },
    cancelled: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', text: 'Cancelled' },
    returned: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', text: 'Returned' },
    // Handle other Dwolla statuses
    processed: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', text: 'Processed' },
    reclaimed: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', text: 'Reclaimed' },
  };

  // Get variant or use default
  const variant = variants[status?.toLowerCase()] || variants[status] || {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    text: status || 'Unknown'
  };
  
  return (
    <Badge className={`${variant.color} border-0`}>
      {variant.text}
    </Badge>
  );
};

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  isLoading = false,
  totalAmount,
  onTransactionClick,
}) => {
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Sort transactions
  const sortedTransactions = [...transactions].sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';
    
    if (sortField === 'amount') {
      return sortDirection === 'asc' 
        ? (a.amount - b.amount)
        : (b.amount - a.amount);
    }
    
    if (sortField === 'created') {
      return sortDirection === 'asc'
        ? new Date(a.created).getTime() - new Date(b.created).getTime()
        : new Date(b.created).getTime() - new Date(a.created).getTime();
    }
    
    // String comparison for other fields
    const compare = aValue.toString().localeCompare(bValue.toString());
    return sortDirection === 'asc' ? compare : -compare;
  });

  // Paginate transactions
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No transactions found. Adjust your filters to see more results.
      </div>
    );
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
                  onClick={() => handleSort('created')}
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
                  onClick={() => handleSort('customerName')}
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
                  onClick={() => handleSort('amount')}
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
                  onClick={() => handleSort('status')}
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
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => onTransactionClick?.(transaction)}
              >
                <TableCell className="font-medium">
                  {new Date(transaction.created).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                    ...{transaction.dwollaId.slice(-12)}
                  </code>
                </TableCell>
                <TableCell>{transaction.customerName || '-'}</TableCell>
                <TableCell>{transaction.companyName || '-'}</TableCell>
                <TableCell className="text-right font-medium">
                  <span className={transaction.direction === 'debit' ? 'text-red-600' : 'text-green-600'}>
                    {transaction.direction === 'debit' ? '-' : '+'}
                    {formatCurrency(transaction.amount)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {transaction.direction === 'credit' ? 'Credit' : 'Debit'}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                <TableCell>
                  {transaction.bankLastFour ? `****${transaction.bankLastFour}` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick?.(transaction);
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Running Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, transactions.length)} of{' '}
            {transactions.length} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};