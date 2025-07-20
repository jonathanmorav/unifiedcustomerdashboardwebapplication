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
          <div>
            <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">Company Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Company ID:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {hubspot.company.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Company Name:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {hubspot.company.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Owner Email:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {hubspot.company.ownerEmail}
                </span>
              </div>
            </div>
          </div>

          <Separator className="bg-cakewalk-border" />

          {/* Summary of Benefits */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary">Summary of Benefits</h4>
              <Button
                variant="outline"
                size="sm"
                className="border-cakewalk-border text-cakewalk-primary hover:bg-cakewalk-alice-200 bg-transparent transition-colors duration-300"
              >
                <FileText className="w-4 h-4 mr-1" />
                View PDF
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Amount to Draft:</span>
                <span className="text-cakewalk-body-xs font-semibold text-cakewalk-text-primary">
                  {hubspot.summaryOfBenefits.amountToDraft}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Fee Amount:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {hubspot.summaryOfBenefits.feeAmount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Monthly Invoice:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {hubspot.summaryOfBenefits.monthlyInvoice}
                </span>
              </div>
            </div>
          </div>

          <Separator className="bg-cakewalk-border" />

          {/* Policies */}
          <div>
            <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
              Associated Policies ({hubspot.summaryOfBenefits.policies.length})
            </h4>
            <div className="space-y-2">
              {hubspot.summaryOfBenefits.policies.map((policy: any) => (
                <div
                  key={policy.id}
                  className="flex items-center justify-between p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
                >
                  <div>
                    <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">{policy.name}</p>
                    <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">{policy.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-cakewalk-body-xs font-semibold text-cakewalk-text-primary">{policy.amount}</p>
                    {getStatusBadge(policy.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
          <div>
            <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
              Customer Information
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Dwolla ID:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {dwolla.customer.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Email:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {dwolla.customer.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Name:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {dwolla.customer.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Status:</span>
                {getStatusBadge(dwolla.customer.status)}
              </div>
            </div>
          </div>

          <Separator className="bg-cakewalk-border" />

          {/* Funding Source */}
          <div>
            <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">Funding Source</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Account Type:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary capitalize">
                  {dwolla.fundingSource.accountType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Account Number:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {dwolla.fundingSource.accountNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Routing Number:</span>
                <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  {dwolla.fundingSource.routingNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Verification:</span>
                {getStatusBadge(dwolla.fundingSource.verificationStatus)}
              </div>
            </div>
          </div>

          <Separator className="bg-cakewalk-border" />

          {/* Transfer History */}
          <div>
            <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">Recent Transfers</h4>
            <div className="space-y-2">
              {dwolla.transfers.map((transfer: any) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
                >
                  <div>
                    <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">{transfer.amount}</p>
                    <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                      {transfer.date} • {transfer.type}
                    </p>
                  </div>
                  {getStatusBadge(transfer.status)}
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-cakewalk-border" />

          {/* Notifications */}
          <div>
            <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
              Recent Notifications ({dwolla.notifications.length})
            </h4>
            <div className="space-y-2">
              {dwolla.notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className="p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
                >
                  <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">{notification.message}</p>
                  <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                    {notification.date} • {notification.type}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
