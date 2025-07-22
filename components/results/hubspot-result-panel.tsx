"use client"

import { ResultCard, CopyButton } from "./result-card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BuildingIcon,
  ReceiptIcon,
  UserIcon,
  MailIcon,
  FileIcon,
  AlertCircleIcon,
} from "lucide-react"
import { formatCurrency } from "@/utils/format-currency"
import { formatDate } from "@/utils/format-date"

interface HubSpotResultPanelProps {
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  isLoading?: boolean
  error?: string
}

export function HubSpotResultPanel({ data, isLoading, error }: HubSpotResultPanelProps) {
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
      <div className="bg-cakewalk-error/5 border-cakewalk-error/20 rounded-lg border p-6">
        <div className="text-cakewalk-error flex items-center gap-2">
          <AlertCircleIcon className="h-5 w-5" />
          <p className="font-medium">HubSpot Error</p>
        </div>
        <p className="text-cakewalk-text-secondary mt-2 text-sm">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-cakewalk-text-secondary py-12 text-center">
        <BuildingIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No HubSpot data found</p>
      </div>
    )
  }

  const { company, summaryOfBenefits } = data

  return (
    <div className="space-y-4">
      {/* Company Information */}
      <ResultCard
        title="Company Information"
        actions={<CopyButton value={company.id} label="Copy ID" />}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <BuildingIcon className="text-cakewalk-text-secondary mt-0.5 h-5 w-5" />
            <div className="flex-1">
              <p className="text-cakewalk-text-secondary text-sm">Company Name</p>
              <p className="font-medium">{company.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MailIcon className="text-cakewalk-text-secondary mt-0.5 h-5 w-5" />
            <div className="flex-1">
              <p className="text-cakewalk-text-secondary text-sm">Owner Email</p>
              <p className="font-medium">{company.ownerEmail || "Not set"}</p>
            </div>
          </div>

          {company.dwollaId && (
            <div className="flex items-start gap-3">
              <UserIcon className="text-cakewalk-text-secondary mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <p className="text-cakewalk-text-secondary text-sm">Dwolla ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium">{company.dwollaId}</p>
                  <CopyButton value={company.dwollaId} size="icon" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ResultCard>

      {/* Summary of Benefits */}
      {summaryOfBenefits && summaryOfBenefits.length > 0 && (
        <ResultCard title={`Summary of Benefits (${summaryOfBenefits.length})`}>
          <div className="space-y-4">
            {summaryOfBenefits.map(
              (
                sob: any,
                index: number // eslint-disable-line @typescript-eslint/no-explicit-any
              ) => (
                <div key={sob.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium">SOB #{index + 1}</p>
                      <p className="text-cakewalk-text-secondary text-sm">
                        {sob.totalPolicies} {sob.totalPolicies === 1 ? "policy" : "policies"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-cakewalk-text-secondary text-sm">Amount to Draft</p>
                      <p className="text-lg font-medium">{formatCurrency(sob.amountToDraft)}</p>
                    </div>
                  </div>

                  {sob.pdfDocumentUrl && (
                    <div className="mb-3 flex items-center gap-2">
                      <FileIcon className="text-cakewalk-text-secondary h-4 w-4" />
                      <a
                        href={sob.pdfDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cakewalk-primary text-sm hover:underline"
                      >
                        View PDF Document
                      </a>
                    </div>
                  )}

                  {sob.policies && sob.policies.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <p className="mb-2 text-sm font-medium">Policies:</p>
                        {sob.policies.map(
                          (
                            policy: any // eslint-disable-line @typescript-eslint/no-explicit-any
                          ) => (
                            <div
                              key={policy.id}
                              className="bg-cakewalk-bg-alice-100 rounded p-3 text-sm"
                            >
                              <div className="mb-1 flex items-start justify-between">
                                <span className="font-medium">{policy.policyNumber}</span>
                                <Badge
                                  variant={policy.status === "active" ? "default" : "secondary"}
                                >
                                  {policy.status}
                                </Badge>
                              </div>
                              <p className="text-cakewalk-text-secondary">
                                {policy.policyHolderName} • {policy.coverageType}
                              </p>
                              <p className="text-cakewalk-text-secondary">
                                Premium: {formatCurrency(policy.premiumAmount)}
                              </p>
                              <p className="text-cakewalk-text-secondary mt-1 text-xs">
                                Effective: {formatDate(policy.effectiveDate)}
                                {policy.expirationDate && ` - ${formatDate(policy.expirationDate)}`}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </>
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
