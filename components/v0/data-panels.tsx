"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { FileText, CreditCard, Building, CheckCircle, Clock, AlertCircle } from "lucide-react"

interface DataPanelsProps {
  data: {
    hubspot: any
    dwolla: any
  }
}

export function DataPanels({ data }: DataPanelsProps) {
  const { hubspot, dwolla } = data
  
  // Defensive coding for data structure
  if (!hubspot || !dwolla) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="text-cakewalk-text-secondary p-6 text-center">
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "verified":
      case "completed":
        return (
          <Badge className="bg-cakewalk-success-light text-cakewalk-success-dark border-0">
            <CheckCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 border-0 dark:bg-yellow-900 dark:text-yellow-200"
          >
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
      case "failed":
      case "unverified":
        return (
          <Badge variant="destructive" className="border-0">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* HubSpot Panel */}
      <Card className="shadow-cakewalk-medium border-cakewalk-border transition-colors duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-cakewalk-primary" />
            <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">HubSpot Data</CardTitle>
          </div>
          <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
            Company information and benefits summary
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Information */}
          {hubspot.company && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">Company Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Company ID:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {hubspot.company.id ? (
                      <a
                        href={`https://cockpit.cakewalkinsurance.com/summary-benefits/?companyId=${hubspot.company.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cakewalk-primary hover:text-cakewalk-primary-dark underline transition-colors duration-200"
                      >
                        {hubspot.company.id}
                      </a>
                    ) : (
                      'Not available'
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Company Name:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {hubspot.company.name || 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Owner Email:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {hubspot.company.ownerEmail || 'Not available'}
                  </span>
                </div>
                {hubspot.company.dwollaId && (
                  <div className="flex justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Dwolla ID:</span>
                    <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                      {hubspot.company.dwollaId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Onboarding Status:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {hubspot.company.onboardingStatus || 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Onboarding Step:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {hubspot.company.onboardingStep || 'Not available'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {!hubspot.company && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">Company Information</h4>
              <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">No company data available</p>
            </div>
          )}

          <Separator className="bg-cakewalk-border" />

          {/* Summary of Benefits */}
          {hubspot.summaryOfBenefits && hubspot.summaryOfBenefits.length > 0 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">
                    Summary of Benefits ({hubspot.summaryOfBenefits.length})
                  </h4>
                  {hubspot.summaryOfBenefits[0]?.pdfDocumentUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-cakewalk-border text-cakewalk-primary hover:bg-cakewalk-alice-200 bg-transparent transition-colors duration-300"
                      onClick={() => window.open(hubspot.summaryOfBenefits[0].pdfDocumentUrl, '_blank')}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      View PDF
                    </Button>
                  )}
                </div>

                {hubspot.summaryOfBenefits.map((sob: any, index: number) => (
                  <div key={sob.id} className="space-y-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Amount to Draft:</span>
                      <span className="text-cakewalk-body-xs font-semibold text-cakewalk-text-primary">
                        ${sob.amountToDraft.toLocaleString()}
                      </span>
                    </div>
                    {sob.feeAmount && (
                      <div className="flex justify-between">
                        <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Fee Amount:</span>
                        <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                          ${sob.feeAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Separator className="bg-cakewalk-border" />

              {/* Policies */}
              <div>
                {hubspot.summaryOfBenefits.some((sob: any) => sob.policies && sob.policies.length > 0) && (
                  <>
                    <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                      Associated Policies ({hubspot.summaryOfBenefits.reduce((total: number, sob: any) => total + (sob.policies?.length || 0), 0)})
                    </h4>
                    <div className="space-y-2">
                      {hubspot.summaryOfBenefits.map((sob: any) => 
                        sob.policies?.map((policy: any) => (
                          <div
                            key={policy.id}
                            className="flex items-center justify-between p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
                          >
                            <div>
                              <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                                {policy.coverageType}
                              </p>
                              <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                                {policy.policyNumber}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-cakewalk-body-xs font-semibold text-cakewalk-text-primary">
                                ${policy.premiumAmount.toLocaleString()}
                              </p>
                              {getStatusBadge(policy.status)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dwolla Panel */}
      <Card className="shadow-cakewalk-medium border-cakewalk-border transition-colors duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-cakewalk-primary" />
            <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">Dwolla Data</CardTitle>
          </div>
          <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
            Payment information and transfer history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Information */}
          {dwolla.customer && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                Customer Information
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Dwolla ID:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {dwolla.customer.id ? (
                      <a
                        href={`https://dashboard.dwolla.com/customers/${dwolla.customer.id}/funding-sources`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cakewalk-primary hover:text-cakewalk-primary-dark underline transition-colors duration-200"
                      >
                        {dwolla.customer.id}
                      </a>
                    ) : (
                      'Not available'
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Email:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {dwolla.customer.email || 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Name:</span>
                  <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                    {dwolla.customer.name || 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Status:</span>
                  {getStatusBadge(dwolla.customer.status || 'unknown')}
                </div>
              </div>
            </div>
          )}
          
          {!dwolla.customer && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                Customer Information
              </h4>
              <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">No customer data available</p>
            </div>
          )}

          <Separator className="bg-cakewalk-border" />

          {/* Funding Sources */}
          {dwolla.fundingSources && dwolla.fundingSources.length > 0 && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                Funding Sources ({dwolla.fundingSources.length})
              </h4>
              <div className="space-y-3">
                {dwolla.fundingSources.map((source: any, index: number) => (
                  <div key={source.id || index} className="p-3 bg-cakewalk-alice-200 rounded-xl">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Account Type:</span>
                        <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary capitalize">
                          {source.bankAccountType || source.type || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Account:</span>
                        <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                          {source.accountNumberMasked || source.name || 'Not available'}
                        </span>
                      </div>
                      {source.routingNumber && (
                        <div className="flex justify-between">
                          <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Routing Number:</span>
                          <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                            {source.routingNumber}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Status:</span>
                        {getStatusBadge(source.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="bg-cakewalk-border" />

          {/* Transfer History */}
          {dwolla.transfers && dwolla.transfers.length > 0 && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                Recent Transfers ({dwolla.transfers.length})
              </h4>
              <div className="space-y-2">
                {dwolla.transfers.map((transfer: any) => (
                  <div
                    key={transfer.id}
                    className="flex items-center justify-between p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
                  >
                    <div>
                      <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                        {transfer.amount || 'No amount'}
                      </p>
                      <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                        {transfer.date || transfer.created || 'Unknown date'} • {transfer.type || 'Transfer'}
                      </p>
                    </div>
                    {getStatusBadge(transfer.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dwolla.transfers && dwolla.transfers.length > 0 && (
            <Separator className="bg-cakewalk-border" />
          )}

          {/* Notifications */}
          {dwolla.notificationCount !== undefined && (
            <div>
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                Recent Notifications ({dwolla.notificationCount})
              </h4>
              {dwolla.notificationCount === 0 ? (
                <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">No recent notifications</p>
              ) : (
                <div className="space-y-2">
                  {dwolla.notifications?.map((notification: any) => (
                    <div
                      key={notification.id}
                      className="p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
                    >
                      <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                        {notification.message || 'No message'}
                      </p>
                      <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                        {notification.date || notification.created || 'Unknown date'} • {notification.type || 'Notification'}
                      </p>
                    </div>
                  )) || (
                    <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">Notifications available but not loaded</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
