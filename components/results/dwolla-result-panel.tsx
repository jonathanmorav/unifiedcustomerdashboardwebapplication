"use client"

import { ResultCard, CopyButton } from "./result-card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  UserIcon,
  MailIcon,
  CalendarIcon,
  CreditCardIcon,
  ArrowRightIcon,
  BellIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  BanknoteIcon,
} from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { formatDateTime, formatRelativeTime } from "@/utils/format-date"

interface DwollaResultPanelProps {
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  isLoading?: boolean
  error?: string
}

export function DwollaResultPanel({ data, isLoading, error }: DwollaResultPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-cakewalk-error/20 bg-cakewalk-error/5 p-6">
        <div className="flex items-center gap-2 text-cakewalk-error">
          <AlertCircleIcon className="h-5 w-5" />
          <p className="font-medium">Dwolla Error</p>
        </div>
        <p className="mt-2 text-sm text-cakewalk-text-secondary">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-cakewalk-text-secondary">
        <BanknoteIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No Dwolla data found</p>
      </div>
    )
  }

  const { customer, fundingSources, transfers, notificationCount } = data

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "verified":
      case "processed":
        return "default"
      case "pending":
        return "secondary"
      case "unverified":
        return "warning"
      case "failed":
      case "suspended":
      case "deactivated":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-4">
      {/* Customer Information */}
      <ResultCard
        title="Customer Information"
        actions={<CopyButton value={customer.id} label="Copy ID" />}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <UserIcon className="mt-0.5 h-5 w-5 text-cakewalk-text-secondary" />
            <div className="flex-1">
              <p className="text-sm text-cakewalk-text-secondary">Name</p>
              <p className="font-medium">{customer.name}</p>
              {customer.businessName && (
                <p className="text-sm text-cakewalk-text-secondary">
                  Business: {customer.businessName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MailIcon className="mt-0.5 h-5 w-5 text-cakewalk-text-secondary" />
            <div className="flex-1">
              <p className="text-sm text-cakewalk-text-secondary">Email</p>
              <p className="font-medium">{customer.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 h-5 w-5 text-cakewalk-text-secondary" />
            <div className="flex-1">
              <p className="text-sm text-cakewalk-text-secondary">Customer Type & Status</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{customer.type}</Badge>
                <Badge variant={getStatusColor(customer.status)}>{customer.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-cakewalk-text-secondary">
                Created: {formatDateTime(customer.created)}
              </p>
            </div>
          </div>

          {notificationCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-cakewalk-warning/10 p-3">
              <BellIcon className="h-5 w-5 text-cakewalk-warning" />
              <p className="text-sm">
                {notificationCount} notification{notificationCount === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      </ResultCard>

      {/* Funding Sources */}
      {fundingSources && fundingSources.length > 0 && (
        <ResultCard title={`Funding Sources (${fundingSources.length})`}>
          <div className="space-y-3">
            {fundingSources.map(
              (
                source: any // eslint-disable-line @typescript-eslint/no-explicit-any
              ) => (
                <div key={source.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCardIcon className="h-5 w-5 text-cakewalk-text-secondary" />
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm capitalize text-cakewalk-text-secondary">
                          {source.type} {source.bankAccountType && `• ${source.bankAccountType}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={source.verified ? "default" : "secondary"}>
                        {source.verified ? (
                          <>
                            <CheckCircleIcon className="mr-1 h-3 w-3" />
                            Verified
                          </>
                        ) : (
                          "Unverified"
                        )}
                      </Badge>
                      <Badge variant={getStatusColor(source.status)}>{source.status}</Badge>
                    </div>
                  </div>

                  {source.accountNumberMasked && (
                    <div className="text-sm text-cakewalk-text-secondary">
                      Account: {source.accountNumberMasked}
                      {source.routingNumber && ` • Routing: ${source.routingNumber}`}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </ResultCard>
      )}

      {/* Recent Transfers */}
      {transfers && transfers.length > 0 && (
        <ResultCard title={`Recent Transfers (${transfers.length})`}>
          <div className="space-y-3">
            {transfers.map(
              (
                transfer: any // eslint-disable-line @typescript-eslint/no-explicit-any
              ) => (
                <div key={transfer.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRightIcon className="h-5 w-5 text-cakewalk-text-secondary" />
                      <div>
                        <p className="text-lg font-medium">
                          {formatCurrency(transfer.amount, transfer.currency)}
                        </p>
                        <p className="text-sm text-cakewalk-text-secondary">
                          {formatRelativeTime(transfer.created)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(transfer.status)}>{transfer.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-cakewalk-text-secondary">From</p>
                      <p className="font-mono text-xs">{transfer.sourceId}</p>
                    </div>
                    <div>
                      <p className="text-cakewalk-text-secondary">To</p>
                      <p className="font-mono text-xs">{transfer.destinationId}</p>
                    </div>
                  </div>

                  {transfer.correlationId && (
                    <div className="mt-2 text-sm">
                      <p className="text-cakewalk-text-secondary">Correlation ID</p>
                      <p className="font-mono text-xs">{transfer.correlationId}</p>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </ResultCard>
      )}
    </div>
  )
}
