"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  InfoIcon,
  RefreshCw,
  Loader2,
  HelpCircle,
  X,
} from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { getReturnCodeInfo, getCategoryDisplayName } from "@/lib/api/dwolla/return-codes"

interface TransactionDetailModalProps {
  transaction: any | null
  isOpen: boolean
  onClose: () => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-cakewalk-warning-light text-cakewalk-warning"
    case "processing":
      return "bg-cakewalk-info-light text-cakewalk-info"
    case "processed":
      return "bg-cakewalk-success-light text-black"
    case "failed":
      return "bg-cakewalk-error-light text-cakewalk-error"
    case "returned":
      return "bg-cakewalk-error-light text-cakewalk-error"
    case "cancelled":
      return "bg-cakewalk-neutral text-cakewalk-neutral-dark"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-5 w-5 text-cakewalk-warning" />
    case "processing":
      return <Loader2 className="h-5 w-5 text-cakewalk-info animate-spin" />
    case "completed":
    case "processed":
      return <CheckCircle className="h-5 w-5 text-cakewalk-success" />
    case "failed":
    case "returned":
      return <XCircle className="h-5 w-5 text-cakewalk-error" />
    case "cancelled":
      return <X className="h-5 w-5 text-cakewalk-neutral" />
    default:
      return <HelpCircle className="h-5 w-5 text-gray-500" />
  }
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  // Updated styling for Failure Information section
  if (!transaction) return null

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
    console.log(`Copied ${label}: ${text}`)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Transaction Details</DialogTitle>
            <Badge className={`${getStatusColor(transaction.status)} border-0`}>
              {getStatusIcon(transaction.status)}
              <span className="ml-1 capitalize">{transaction.status}</span>
            </Badge>
          </div>
          <DialogDescription>Transaction ID: {transaction.dwollaId}</DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Amount and Direction */}
          <div className="rounded-lg bg-cakewalk-alice-200 p-4 dark:bg-cakewalk-alice-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Amount</p>
                <p className="text-3xl font-bold">
                  {transaction.direction === "debit" ? "-" : "+"}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-cakewalk-text-secondary">Direction</p>
                <div className="flex items-center gap-2">
                  {transaction.direction === "credit" ? (
                    <ArrowDownRight className="h-5 w-5 text-cakewalk-success" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 text-cakewalk-error" />
                  )}
                  <span className="text-lg font-medium capitalize">{transaction.direction}</span>
                </div>
              </div>
            </div>

            {transaction.fees > 0 && (
              <div className="mt-3 border-t border-cakewalk-border pt-3 dark:border-cakewalk-border">
                <div className="flex justify-between text-sm">
                  <span className="text-cakewalk-text-secondary">Fees</span>
                  <span>{formatCurrency(transaction.fees)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-cakewalk-text-secondary">Net Amount</span>
                  <span className="font-medium">{formatCurrency(transaction.netAmount)}</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Customer Information */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <User className="h-5 w-5" />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Customer Name</p>
                <p className="font-medium">{transaction.customerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Company</p>
                <p className="font-medium">{transaction.companyName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Email</p>
                <p className="font-medium">{transaction.customerEmail || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Customer ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium">{transaction.customerId || "N/A"}</p>
                  {transaction.customerId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transaction.customerId, "Customer ID")}
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
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <CreditCard className="h-5 w-5" />
              Bank Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Source</p>
                <p className="font-medium">{transaction.sourceName || "N/A"}</p>
                {transaction.sourceBankName && (
                  <p className="text-sm text-cakewalk-text-tertiary">{transaction.sourceBankName}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Destination</p>
                <p className="font-medium">{transaction.destinationName || "N/A"}</p>
                {transaction.destinationBankName && (
                  <p className="text-sm text-cakewalk-text-tertiary">{transaction.destinationBankName}</p>
                )}
              </div>
              {transaction.bankLastFour && (
                <div>
                  <p className="text-sm text-cakewalk-text-secondary">Account</p>
                  <p className="font-medium">****{transaction.bankLastFour}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Transaction Details */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Building className="h-5 w-5" />
              Transaction Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Type</p>
                <p className="font-medium capitalize">
                  {transaction.transactionType || "Standard"}
                </p>
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Invoice Number</p>
                <p className="font-medium">{transaction.invoiceNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">Correlation ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium">
                    {transaction.correlationId || "N/A"}
                  </p>
                  {transaction.correlationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transaction.correlationId, "Correlation ID")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-cakewalk-text-secondary">ACH ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium">
                    {transaction.individualAchId || "N/A"}
                  </p>
                  {transaction.individualAchId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transaction.individualAchId, "ACH ID")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {transaction.description && (
              <div className="mt-4">
                <p className="text-sm text-cakewalk-text-secondary">Description</p>
                <p className="font-medium">{transaction.description}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5" />
              Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-cakewalk-text-tertiary"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-cakewalk-text-secondary">
                    {formatDate(transaction.created)}
                  </p>
                </div>
              </div>

              {transaction.processedAt && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-cakewalk-success"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Processed</p>
                    <p className="text-sm text-cakewalk-text-secondary">
                      {formatDate(transaction.processedAt)}
                    </p>
                  </div>
                </div>
              )}

              {transaction.clearingDate && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-cakewalk-info"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Expected Clearing</p>
                    <p className="text-sm text-cakewalk-text-secondary">
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
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <AlertCircle className="h-5 w-5 text-cakewalk-error" />
                  Failure Information
                </h3>
                <div className="space-y-4">
                  {transaction.returnCode && (() => {
                    const returnCodeInfo = getReturnCodeInfo(transaction.returnCode)
                    return (
                      <div className="rounded-lg border border-cakewalk-border bg-cakewalk-bg-alice-100 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="destructive" className="text-sm">
                              {transaction.returnCode}
                            </Badge>
                            <span className="font-semibold text-cakewalk-text-primary">
                              {returnCodeInfo.title}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {getCategoryDisplayName(returnCodeInfo.category)}
                          </Badge>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="text-sm text-cakewalk-text-secondary">
                            {returnCodeInfo.description}
                          </div>
                          
                          <div className="rounded-md bg-white p-3 border border-cakewalk-border">
                            <p className="text-sm text-cakewalk-text-secondary leading-relaxed">
                              {returnCodeInfo.detailedExplanation}
                            </p>
                          </div>
                          
                          {returnCodeInfo.commonScenarios && returnCodeInfo.commonScenarios.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-cakewalk-text-primary">Common Scenarios:</p>
                              <ul className="space-y-1">
                                {returnCodeInfo.commonScenarios.slice(0, 3).map((scenario, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm text-cakewalk-text-secondary">
                                    <span className="text-cakewalk-primary mt-1">•</span>
                                    <span>{scenario}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {returnCodeInfo.retryable && (
                            <div className="flex items-start gap-3 rounded-md bg-cakewalk-info-light border border-cakewalk-info p-3">
                              <RefreshCw className="h-4 w-4 text-cakewalk-info mt-0.5" />
                              <div className="text-sm">
                                <p className="font-medium text-cakewalk-text-primary">This transaction can be retried.</p>
                                <p className="text-cakewalk-text-secondary mt-1">
                                  {returnCodeInfo.retryGuidance || "Can retry after 2-3 business days. Consider smaller amount or contact customer first. Maximum 2 retries recommended to avoid R10 return."}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="rounded-md bg-cakewalk-bg-alice-200 border border-cakewalk-border p-3">
                            <div className="flex items-start gap-2">
                              <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-cakewalk-info" />
                              <div className="text-sm">
                                <p className="font-medium text-cakewalk-text-primary">Recommended Action:</p>
                                <p className="text-cakewalk-text-secondary mt-1">
                                  {returnCodeInfo.userAction}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {returnCodeInfo.preventionTips && returnCodeInfo.preventionTips.length > 0 && (
                            <details className="cursor-pointer group">
                              <summary className="font-medium text-sm text-cakewalk-text-primary hover:text-cakewalk-primary transition-colors">Prevention Tips</summary>
                              <ul className="mt-2 space-y-1">
                                {returnCodeInfo.preventionTips.map((tip, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm text-cakewalk-text-secondary ml-2">
                                    <span className="text-cakewalk-primary mt-1">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                          
                        </div>
                        
                        {returnCodeInfo.nachaReference && (
                          <div className="mt-4 pt-3 border-t border-cakewalk-border">
                            <p className="text-xs text-cakewalk-text-tertiary">
                              NACHA Reference: {returnCodeInfo.nachaReference}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  
                  {/* Show basic failure info if no return code */}
                  {!transaction.returnCode && (
                    <>
                      {transaction.failureReason && (
                        <div>
                          <p className="text-sm text-cakewalk-text-secondary">Reason</p>
                          <p className="font-medium">{transaction.failureReason}</p>
                        </div>
                      )}
                      {transaction.failureCode && (
                        <div>
                          <p className="text-sm text-cakewalk-text-secondary">Failure Code</p>
                          <p className="font-mono font-medium">{transaction.failureCode}</p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Webhook Event History */}
                  {transaction.lastWebhookAt && (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-sm text-cakewalk-text-secondary">Last Updated via Webhook</p>
                      <p className="text-sm">{formatDate(transaction.lastWebhookAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3 border-t pt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Details
          </Button>
          <Button 
            className="flex items-center gap-2"
            onClick={() => {
              if (transaction.dwollaId) {
                window.open(`https://dashboard.dwolla.com/transfers/${transaction.dwollaId}`, '_blank')
              }
            }}
            disabled={!transaction.dwollaId}
          >
            <ExternalLink className="h-4 w-4" />
            View in Dwolla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
