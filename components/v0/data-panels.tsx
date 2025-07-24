"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import {
  FileText,
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  VideoIcon,
} from "lucide-react"

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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="p-6 text-center text-cakewalk-text-secondary">
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
          <Badge className="border-0 bg-cakewalk-success-light text-cakewalk-success-dark">
            <CheckCircle className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        )
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="border-0 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          >
            <Clock className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        )
      case "failed":
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

  // Debug logging for clarity sessions
  console.log("[DATA PANELS DEBUG] Clarity sessions:", hubspot?.data?.claritySessions)

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
                  <div className="flex items-center justify-between">
                    <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                      Status:
                    </span>
                    {getStatusBadge(dwolla.customer.status || "unknown")}
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
                              Account:
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
                          {source.routingNumber && (
                            <div className="flex justify-between">
                              <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                                Routing Number:
                              </span>
                              <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                                {source.routingNumber}
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
                        className="flex items-center justify-between rounded-xl bg-cakewalk-alice-200 p-3 transition-colors duration-300"
                      >
                        <div>
                          <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                            {transfer.amount || "No amount"}
                          </p>
                          <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                            {transfer.date || transfer.created || "Unknown date"} •{" "}
                            {transfer.type || "Transfer"}
                          </p>
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
                  ) : (
                    <div className="space-y-2">
                      {dwolla.notifications?.map((notification: any) => (
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
                      )) || (
                        <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                          Notifications available but not loaded
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clarity Sessions Panel - Full Width Below Both Panels */}
      {(hubspot?.data?.claritySessions?.length > 0 || true) && (
        <Card className="border-cakewalk-border shadow-cakewalk-medium transition-colors duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <VideoIcon className="h-5 w-5 text-cakewalk-primary" />
              <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">
                Microsoft Clarity Sessions
              </CardTitle>
            </div>
            <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              Session recordings and user behavior analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hubspot?.data?.claritySessions?.length > 0 ? (
              <div className="space-y-4">
                <div className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                  Found {hubspot.data.claritySessions.length} session recording
                  {hubspot.data.claritySessions.length !== 1 ? "s" : ""}
                </div>

                {hubspot.data.claritySessions.map((session: any, index: number) => (
                  <div
                    key={session.id || index}
                    className="rounded-xl border bg-cakewalk-alice-200 p-4"
                  >
                    <div className="space-y-3">
                      {/* Session Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <VideoIcon className="h-4 w-4 text-cakewalk-primary" />
                          <span className="text-cakewalk-body-sm font-medium text-cakewalk-text-primary">
                            Microsoft Clarity Session
                          </span>
                        </div>
                        <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                          {new Date(session.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Recording Link */}
                      <div className="flex items-center justify-between">
                        {session.recordingUrl ? (
                          <a
                            href={session.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cakewalk-body-sm text-cakewalk-primary underline transition-colors duration-200 hover:text-cakewalk-primary-dark"
                          >
                            🎥 Click to view recording
                          </a>
                        ) : (
                          <span className="text-cakewalk-body-sm text-cakewalk-text-secondary">
                            No recording URL available (Session ID: {session.id})
                          </span>
                        )}
                      </div>

                      {/* Session Details */}
                      <div className="grid grid-cols-2 gap-4 text-cakewalk-body-xs md:grid-cols-4">
                        {session.duration && (
                          <div>
                            <span className="text-cakewalk-text-secondary">Duration:</span>
                            <div className="font-medium text-cakewalk-text-primary">
                              {Math.floor(session.duration / 60)}m {session.duration % 60}s
                            </div>
                          </div>
                        )}
                        {session.deviceType && (
                          <div>
                            <span className="text-cakewalk-text-secondary">Device:</span>
                            <div className="font-medium capitalize text-cakewalk-text-primary">
                              {session.deviceType}
                            </div>
                          </div>
                        )}
                        {session.browser && (
                          <div>
                            <span className="text-cakewalk-text-secondary">Browser:</span>
                            <div className="font-medium text-cakewalk-text-primary">
                              {session.browser}
                            </div>
                          </div>
                        )}
                        {session.smartEvents && (
                          <div>
                            <span className="text-cakewalk-text-secondary">Events:</span>
                            <div className="font-medium text-cakewalk-text-primary">
                              {session.smartEvents.length} recorded
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Smart Events */}
                      {session.smartEvents && session.smartEvents.length > 0 && (
                        <div className="border-t border-cakewalk-border pt-3">
                          <div className="mb-2 text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                            Smart Events:
                          </div>
                          <div className="space-y-1">
                            {session.smartEvents
                              .slice(0, 3)
                              .map((event: any, eventIndex: number) => (
                                <div
                                  key={eventIndex}
                                  className="flex items-center justify-between text-cakewalk-body-xs"
                                >
                                  <span className="text-cakewalk-text-primary">{event.event}</span>
                                  <span className="text-cakewalk-text-secondary">
                                    {event.startTime} • {event.type}
                                  </span>
                                </div>
                              ))}
                            {session.smartEvents.length > 3 && (
                              <div className="text-cakewalk-body-xs italic text-cakewalk-text-secondary">
                                ... and {session.smartEvents.length - 3} more events
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-cakewalk-text-secondary">
                <VideoIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-cakewalk-body-sm">No session recordings found</p>
                <p className="mt-2 text-cakewalk-body-xs">
                  Session recordings will appear here when available from Microsoft Clarity
                </p>

                {/* Debug Info */}
                <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-cakewalk-body-xs font-medium text-yellow-800">Debug Info:</p>
                  <p className="mt-1 text-cakewalk-body-xs text-yellow-700">
                    Sessions in data: {hubspot?.data?.claritySessions?.length || 0}
                  </p>
                  {hubspot?.data?.claritySessions && (
                    <pre className="mt-2 overflow-x-auto text-xs text-yellow-700">
                      {JSON.stringify(hubspot.data.claritySessions, null, 2).substring(0, 200)}...
                    </pre>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
