'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Copy,
  Download,
  ExternalLink,
  Calendar,
  CreditCard,
  Building,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { formatCurrency } from '@/utils/format-currency';

interface TransactionDetailModalProps {
  transaction: any | null;
  isOpen: boolean;
  onClose: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case 'processing':
      return <Clock className="h-5 w-5 text-blue-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'cancelled':
      return <XCircle className="h-5 w-5 text-gray-500" />;
    case 'returned':
      return <AlertCircle className="h-5 w-5 text-orange-500" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  return colors[status] || colors.pending;
};

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  if (!transaction) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
    console.log(`Copied ${label}: ${text}`);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              Transaction Details
            </DialogTitle>
            <Badge className={`${getStatusColor(transaction.status)} border-0`}>
              {getStatusIcon(transaction.status)}
              <span className="ml-1 capitalize">{transaction.status}</span>
            </Badge>
          </div>
          <DialogDescription>
            Transaction ID: {transaction.dwollaId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Amount and Direction */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
                <p className="text-3xl font-bold">
                  {transaction.direction === 'debit' ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Direction</p>
                <div className="flex items-center gap-2">
                  {transaction.direction === 'credit' ? (
                    <ArrowDownRight className="h-5 w-5 text-green-500" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-lg font-medium capitalize">
                    {transaction.direction}
                  </span>
                </div>
              </div>
            </div>
            
            {transaction.fees > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fees</span>
                  <span>{formatCurrency(transaction.fees)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600 dark:text-gray-400">Net Amount</span>
                  <span className="font-medium">{formatCurrency(transaction.netAmount)}</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Customer Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Customer Name</p>
                <p className="font-medium">{transaction.customerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Company</p>
                <p className="font-medium">{transaction.companyName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="font-medium">{transaction.customerEmail || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Customer ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium font-mono text-sm">
                    {transaction.customerId || 'N/A'}
                  </p>
                  {transaction.customerId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transaction.customerId, 'Customer ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Bank Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Source</p>
                <p className="font-medium">{transaction.sourceName || 'N/A'}</p>
                {transaction.sourceBankName && (
                  <p className="text-sm text-gray-500">{transaction.sourceBankName}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Destination</p>
                <p className="font-medium">{transaction.destinationName || 'N/A'}</p>
                {transaction.destinationBankName && (
                  <p className="text-sm text-gray-500">{transaction.destinationBankName}</p>
                )}
              </div>
              {transaction.bankLastFour && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Account</p>
                  <p className="font-medium">****{transaction.bankLastFour}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Transaction Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Transaction Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
                <p className="font-medium capitalize">
                  {transaction.transactionType || 'Standard'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Invoice Number</p>
                <p className="font-medium">{transaction.invoiceNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Correlation ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium font-mono text-sm">
                    {transaction.correlationId || 'N/A'}
                  </p>
                  {transaction.correlationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transaction.correlationId, 'Correlation ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ACH ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium font-mono text-sm">
                    {transaction.individualAchId || 'N/A'}
                  </p>
                  {transaction.individualAchId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transaction.individualAchId, 'ACH ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {transaction.description && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Description</p>
                <p className="font-medium">{transaction.description}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(transaction.created)}
                  </p>
                </div>
              </div>
              
              {transaction.processedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Processed</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(transaction.processedAt)}
                    </p>
                  </div>
                </div>
              )}
              
              {transaction.clearingDate && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Expected Clearing</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(transaction.clearingDate)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Failure Information */}
          {(transaction.failureReason || transaction.failureCode || transaction.returnCode) && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  Failure Information
                </h3>
                <div className="space-y-3">
                  {transaction.failureReason && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Reason</p>
                      <p className="font-medium">{transaction.failureReason}</p>
                    </div>
                  )}
                  {transaction.failureCode && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Failure Code</p>
                      <p className="font-medium font-mono">{transaction.failureCode}</p>
                    </div>
                  )}
                  {transaction.returnCode && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Return Code</p>
                      <p className="font-medium font-mono">{transaction.returnCode}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Details
          </Button>
          <Button className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            View in Dwolla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};