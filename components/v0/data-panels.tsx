"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { PoliciesPanel } from "@/components/policies/PoliciesPanel"
import { TransactionDetailModal } from "@/components/billing/TransactionDetailModal"
import { formatCurrency } from "@/utils/format-currency"
import { useState } from "react"
import {
  FileText,
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  VideoIcon,
  MousePointer,
} from "lucide-react"

interface DataPanelsProps {
  data: {
    hubspot: any
    dwolla: any
  }
}

export function DataPanels({ data }: DataPanelsProps) {
  const { hubspot, dwolla } = data
  
  // State for transaction detail modal
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const mapTransferToTransaction = (transfer: any) => {
    // Map Dwolla transfer data to TransactionDetailModal expected format
    
    // Convert amount to number (Dwolla sends as string)
    const amountValue = parseFloat(transfer.amount?.value || transfer.amount || "0")
    
    // Helper function to find funding source by URL
    const findFundingSourceByUrl = (url: string) => {
      if (!url || !dwolla?.fundingSources) return null
      const sourceId = url.split('/').pop()
      return dwolla.fundingSources.find((fs: any) => fs.id === sourceId)
    }
    
    // Get source and destination funding source details
    const sourceFs = findFundingSourceByUrl(transfer._links?.source?.href)
    const destinationFs = findFundingSourceByUrl(transfer._links?.destination?.href)
    
    const mappedTransaction = {
      // Core transaction fields
      dwollaId: transfer.id,
      amount: amountValue,
      currency: transfer.currency || transfer.amount?.currency || "USD",
      status: transfer.status,
      created: transfer.created,
      
      // Customer information (try multiple sources)
      customerName: transfer.customerName || 
                   dwolla?.customer?.name ||
                   (dwolla?.customer?.firstName || dwolla?.customer?.lastName 
                     ? `${dwolla?.customer?.firstName || ""} ${dwolla?.customer?.lastName || ""}`.trim()
                     : dwolla?.customer?.businessName) ||
                   hubspot?.company?.properties?.name || 
                   null,
      companyName: transfer.companyName || 
                  dwolla?.customer?.businessName ||
                  hubspot?.company?.properties?.name || 
                  null,
      customerEmail: transfer.customerEmail || 
                    dwolla?.customer?.email ||
                    hubspot?.company?.properties?.email___owner || 
                    null,
      customerId: transfer.customerId || dwolla?.customer?.id || null,
      
      // Bank/Source information (what the modal expects)
      sourceName: transfer.sourceName || 
                 sourceFs?.name || 
                 transfer.sourceId || 
                 (transfer._links?.source?.href ? 
                   transfer._links.source.href.split('/').pop() : null),
      destinationName: transfer.destinationName || 
                      destinationFs?.name || 
                      transfer.destinationId || 
                      (transfer._links?.destination?.href ? 
                        transfer._links.destination.href.split('/').pop() : null),
      sourceBankName: transfer.sourceBankName || sourceFs?.bankName || "ACH Transfer",
      destinationBankName: transfer.destinationBankName || destinationFs?.bankName || "Bank Account",
      bankLastFour: transfer.bankLastFour || 
                   sourceFs?.accountNumberMasked?.slice(-4) || 
                   destinationFs?.accountNumberMasked?.slice(-4) || 
                   null,
      
      // Transaction details
      transactionType: transfer.transactionType || transfer.metadata?.transactionType || "Transfer",
      invoiceNumber: transfer.invoiceNumber || transfer.metadata?.invoiceNumber || null,
      correlationId: transfer.correlationId || null,
      individualAchId: transfer.individualAchId || transfer.achId || `ACH_${transfer.id?.slice(-8) || Math.random().toString(36).slice(-8)}`,
      description: transfer.description || transfer.metadata?.description || null,
      
      // Direction (convert to credit/debit for modal)
      direction: transfer.direction === "inbound" ? "credit" : "debit",
      
      // Additional metadata
      fees: transfer.fees ? parseFloat(transfer.fees) : 0,
      netAmount: transfer.netAmount ? parseFloat(transfer.netAmount) : amountValue,
      
      // Failure information (if applicable)
      returnCode: transfer.returnCode || null,
      failureReason: transfer.failureReason || null,
      failureCode: transfer.failureCode || null,
    }
    
    return mappedTransaction
  }

  const handleTransactionClick = (transfer: any) => {
    const mappedTransaction = mapTransferToTransaction(transfer)
    setSelectedTransaction(mappedTransaction)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedTransaction(null)
  }

  // Defensive coding for data structure
  if (!hubspot || !dwolla) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="p-6 text-center text-cakewalk-text-secondary">
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      // Success states - GREEN
      case "active":
      case "verified":
      case "completed":
      case "processed":
        return (
          <Badge className="border-0 bg-cakewalk-success-light text-cakewalk-success-dark">
            <CheckCircle className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        )
      // Pending states - YELLOW  
      case "pending":
        return (
          <Badge 
            className="border-0"
            style={{
              backgroundColor: '#fef3c7', // yellow-100
              color: '#92400e', // yellow-800
            }}
          >
            <Clock className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        )
      // Failure states - RED
      case "failed":
      case "cancelled":
      case "returned":
      case "reclaimed":
      case "unverified":
        return (
          <Badge variant="destructive" className="border-0">
            <AlertCircle className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }



  return (
    <div className="space-y-6">
      {/* HubSpot and Dwolla Panels - Side by Side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* HubSpot Panel */}
        <Card className="border-cakewalk-border shadow-cakewalk-medium transition-colors duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-cakewalk-primary" />
              <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">
                HubSpot Data
              </CardTitle>
            </div>
            <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              Company information and benefits summary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Information */}
            {hubspot.company && (
              <div>
                <h4 className="mb-3 text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                  Company Information
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Company ID:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {hubspot.company.id ? (
                        <a
                          href={`https://cockpit.cakewalkinsurance.com/summary-benefits/?companyId=${hubspot.company.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cakewalk-primary underline transition-colors duration-200 hover:text-cakewalk-primary-dark"
                        >
                          {hubspot.company.id}
                        </a>
                      ) : (
                        "Not available"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Company Name:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {hubspot.company.name || "Not available"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Owner Email:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {hubspot.company.ownerEmail || "Not available"}
                    </span>
                  </div>
                  {hubspot.company.dwollaId && (
                    <div className="flex justify-between">
                      <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                        Dwolla ID:
                      </span>
                      <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                        {hubspot.company.dwollaId}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Onboarding Status:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {hubspot.company.onboardingStatus || "Not available"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Onboarding Step:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {hubspot.company.onboardingStep || "Not available"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary of Benefits - abbreviated for space */}
            {hubspot.summaryOfBenefits && hubspot.summaryOfBenefits.length > 0 && (
              <>
                <Separator className="bg-cakewalk-border" />
                <div>
                  <h4 className="mb-3 text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                    Summary of Benefits ({hubspot.summaryOfBenefits.length})
                  </h4>
                  {hubspot.summaryOfBenefits.slice(0, 1).map((sob: any) => (
                    <div key={sob.id} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                          Amount to Draft:
                        </span>
                        <span className="text-cakewalk-body-xs font-semibold text-cakewalk-text-primary">
                          ${sob.amountToDraft.toLocaleString()}
                        </span>
                      </div>
                      {sob.feeAmount && (
                        <div className="flex justify-between">
                          <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                            Fee Amount:
                          </span>
                          <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                            ${sob.feeAmount.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Policies Section */}
                      {sob.policies && sob.policies.length > 0 && (
                        <>
                          <Separator className="bg-cakewalk-border my-4" />
                          <PoliciesPanel 
                            policies={sob.policies}
                            companyName={hubspot.company?.name}
                            onPolicySelect={(policy) => {
                              console.log('Policy selected:', policy)
                              // TODO: Add policy selection handler
                            }}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dwolla Panel */}
        <Card className="border-cakewalk-border shadow-cakewalk-medium transition-colors duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cakewalk-primary" />
              <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">
                Dwolla Data
              </CardTitle>
            </div>
            <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              Payment information and transfer history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Information */}
            {dwolla.customer && (
              <div>
                <h4 className="mb-3 text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                  Customer Information
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Dwolla ID:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {dwolla.customer.id ? (
                        <a
                          href={`https://dashboard.dwolla.com/customers/${dwolla.customer.id}/funding-sources`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cakewalk-primary underline transition-colors duration-200 hover:text-cakewalk-primary-dark"
                        >
                          {dwolla.customer.id}
                        </a>
                      ) : (
                        "Not available"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Email:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {dwolla.customer.email || "Not available"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Name:
                    </span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {dwolla.customer.name || "Not available"}
                    </span>
                  </div>

                </div>
              </div>
            )}

            {/* Funding Sources */}
            {dwolla.fundingSources && dwolla.fundingSources.length > 0 && (
              <>
                <Separator className="bg-cakewalk-border" />
                <div>
                  <h4 className="mb-3 text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                    Funding Sources ({dwolla.fundingSources.length})
                  </h4>
                  <div className="space-y-3">
                    {dwolla.fundingSources.map((source: any, index: number) => (
                      <div
                        key={source.id || index}
                        className="rounded-xl bg-cakewalk-alice-200 p-3"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                              Account Type:
                            </span>
                            <span className="text-cakewalk-body-xs font-medium capitalize text-cakewalk-text-primary">
                              {source.bankAccountType || source.type || "Unknown"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                              Account Number:
                            </span>
                            <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                              {source.accountNumberMasked || source.name || "Not available"}
                            </span>
                          </div>
                          {source.bankName && (
                            <div className="flex justify-between">
                              <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                                Bank Name:
                              </span>
                              <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                                {source.bankName}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                              Status:
                            </span>
                            {getStatusBadge(source.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Transfer History */}
            {dwolla.transfers && dwolla.transfers.length > 0 && (
              <>
                <Separator className="bg-cakewalk-border" />
                <div>
                  <h4 className="mb-3 text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                    Recent Transfers ({dwolla.transfers.length})
                  </h4>
                  <div className="space-y-2">
                    {dwolla.transfers.map((transfer: any) => (
                      <div
                        key={transfer.id}
                        className="group flex cursor-pointer items-center justify-between rounded-xl bg-cakewalk-alice-200 p-3 transition-all duration-200 hover:bg-cakewalk-alice-300 hover:shadow-sm"
                        onClick={() => handleTransactionClick(transfer)}
                        title="Click to view transaction details"
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <div className="flex-1">
                            <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                              {(() => {
                                // The formatter should now provide transfer.amount as a string
                                const amountValue = transfer.amount || "0"
                                const amount = parseFloat(amountValue)
                                return amount > 0 ? formatCurrency(amount) : "No amount"
                              })()}
                            </p>
                            <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                              {transfer.date || transfer.created || "Unknown date"} •{" "}
                              {transfer.type || "Transfer"}
                            </p>
                          </div>
                          <MousePointer className="h-4 w-4 text-cakewalk-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                        </div>
                        {getStatusBadge(transfer.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notifications */}
            {dwolla.notificationCount !== undefined && (
              <>
                <Separator className="bg-cakewalk-border" />
                <div>
                  <h4 className="mb-3 text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                    Recent Notifications ({dwolla.notificationCount})
                  </h4>
                  {dwolla.notificationCount === 0 ? (
                    <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      No recent notifications
                    </p>
                  ) : dwolla.notifications && dwolla.notifications.length > 0 ? (
                    <div className="space-y-2">
                      {dwolla.notifications.map((notification: any) => (
                        <div
                          key={notification.id}
                          className="rounded-xl bg-cakewalk-alice-200 p-3 transition-colors duration-300"
                        >
                          <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                            {notification.message || "No message"}
                          </p>
                          <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                            {notification.date || notification.created || "Unknown date"} •{" "}
                            {notification.type || "Notification"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Notifications available but not loaded
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </div>
  )
}
