"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { FileText, CreditCard, Building, CheckCircle, Clock, AlertCircle, VideoIcon } from "lucide-react"

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

  // Debug logging for clarity sessions
  console.log("[DATA PANELS DEBUG] Clarity sessions:", hubspot?.data?.claritySessions)

  return (
    <div className="space-y-6">
      {/* HubSpot and Dwolla Panels - Side by Side */}
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

            {/* Summary of Benefits - abbreviated for space */}
            {hubspot.summaryOfBenefits && hubspot.summaryOfBenefits.length > 0 && (
              <>
                <Separator className="bg-cakewalk-border" />
                <div>
                  <h4 className="text-cakewalk-body-sm font-semibold text-cakewalk-text-primary mb-3">
                    Summary of Benefits ({hubspot.summaryOfBenefits.length})
                  </h4>
                  {hubspot.summaryOfBenefits.slice(0, 1).map((sob: any) => (
                    <div key={sob.id} className="space-y-2">
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

            {/* Funding Sources */}
            {dwolla.fundingSources && dwolla.fundingSources.length > 0 && (
              <>
                <Separator className="bg-cakewalk-border" />
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
                          {source.bankName && (
                            <div className="flex justify-between">
                              <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">Bank Name:</span>
                              <span className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                                {source.bankName}
                              </span>
                            </div>
                          )}
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
              </>
            )}

            {/* Transfer History */}
            {dwolla.transfers && dwolla.transfers.length > 0 && (
              <>
                <Separator className="bg-cakewalk-border" />
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
              </>
            )}

            {/* Notifications */}
            {dwolla.notificationCount !== undefined && (
              <>
                <Separator className="bg-cakewalk-border" />
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clarity Sessions Panel - Full Width Below Both Panels */}
      {(hubspot?.data?.claritySessions?.length > 0 || true) && (
        <Card className="shadow-cakewalk-medium border-cakewalk-border transition-colors duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <VideoIcon className="w-5 h-5 text-cakewalk-primary" />
              <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">Microsoft Clarity Sessions</CardTitle>
            </div>
            <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              Session recordings and user behavior analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hubspot?.data?.claritySessions?.length > 0 ? (
              <div className="space-y-4">
                <div className="text-cakewalk-body-xs text-cakewalk-text-secondary">
                  Found {hubspot.data.claritySessions.length} session recording{hubspot.data.claritySessions.length !== 1 ? 's' : ''}
                </div>
                
                {hubspot.data.claritySessions.map((session: any, index: number) => (
                  <div key={session.id || index} className="p-4 bg-cakewalk-alice-200 rounded-xl border">
                    <div className="space-y-3">
                      {/* Session Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <VideoIcon className="w-4 h-4 text-cakewalk-primary" />
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
                            className="text-cakewalk-primary hover:text-cakewalk-primary-dark underline text-cakewalk-body-sm transition-colors duration-200"
                          >
                            🎥 Click to view recording
                          </a>
                        ) : (
                          <span className="text-cakewalk-text-secondary text-cakewalk-body-sm">
                            No recording URL available (Session ID: {session.id})
                          </span>
                        )}
                      </div>

                      {/* Session Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-cakewalk-body-xs">
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
                            <div className="font-medium text-cakewalk-text-primary capitalize">
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
                          <div className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary mb-2">
                            Smart Events:
                          </div>
                          <div className="space-y-1">
                            {session.smartEvents.slice(0, 3).map((event: any, eventIndex: number) => (
                              <div key={eventIndex} className="flex items-center justify-between text-cakewalk-body-xs">
                                <span className="text-cakewalk-text-primary">
                                  {event.event}
                                </span>
                                <span className="text-cakewalk-text-secondary">
                                  {event.startTime} • {event.type}
                                </span>
                              </div>
                            ))}
                            {session.smartEvents.length > 3 && (
                              <div className="text-cakewalk-body-xs text-cakewalk-text-secondary italic">
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
              <div className="text-center py-8 text-cakewalk-text-secondary">
                <VideoIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-cakewalk-body-sm">No session recordings found</p>
                <p className="text-cakewalk-body-xs mt-2">
                  Session recordings will appear here when available from Microsoft Clarity
                </p>
                
                {/* Debug Info */}
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 text-cakewalk-body-xs font-medium">Debug Info:</p>
                  <p className="text-yellow-700 text-cakewalk-body-xs mt-1">
                    Sessions in data: {hubspot?.data?.claritySessions?.length || 0}
                  </p>
                  {hubspot?.data?.claritySessions && (
                    <pre className="text-yellow-700 text-xs mt-2 overflow-x-auto">
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
