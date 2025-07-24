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
      <div className="rounded-lg border border-cakewalk-error/20 bg-cakewalk-error/5 p-6">
        <div className="flex items-center gap-2 text-cakewalk-error">
          <AlertCircleIcon className="h-5 w-5" />
          <p className="font-medium">HubSpot Error</p>
        </div>
        <p className="mt-2 text-sm text-cakewalk-text-secondary">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-cakewalk-text-secondary">
        <BuildingIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No HubSpot data found</p>
      </div>
    )
  }

  const { company, summaryOfBenefits } = data

  // Debug logging
  console.log("HubSpot Result Panel - Full data:", data)
  console.log("HubSpot Result Panel - Company data:", company)
  console.log("HubSpot Result Panel - onboardingStatus:", company?.onboardingStatus)
  console.log("HubSpot Result Panel - onboardingStep:", company?.onboardingStep)

  return (
    <div className="space-y-4">
      {/* Company Information */}
      <ResultCard
        title="Company Information"
        actions={<CopyButton value={company.id} label="Copy ID" />}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <BuildingIcon className="mt-0.5 h-5 w-5 text-cakewalk-text-secondary" />
            <div className="flex-1">
              <p className="text-sm text-cakewalk-text-secondary">Company Name</p>
              <p className="font-medium">{company.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MailIcon className="mt-0.5 h-5 w-5 text-cakewalk-text-secondary" />
            <div className="flex-1">
              <p className="text-sm text-cakewalk-text-secondary">Owner Email</p>
              <p className="font-medium">{company.ownerEmail || "Not set"}</p>
            </div>
          </div>

          {company.dwollaId && (
            <div className="flex items-start gap-3">
              <UserIcon className="mt-0.5 h-5 w-5 text-cakewalk-text-secondary" />
              <div className="flex-1">
                <p className="text-sm text-cakewalk-text-secondary">Dwolla ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium">{company.dwollaId}</p>
                  <CopyButton value={company.dwollaId} size="icon" />
                </div>
              </div>
            </div>
          )}

          <div
            className="flex items-start gap-3 border-2 border-red-500 p-2"
            style={{ backgroundColor: "yellow" }}
          >
            <span className="font-medium text-black">{company.onboardingStatus || "[EMPTY]"}</span>
            <span className="text-sm text-cakewalk-text-secondary">Onboarding Status</span>
          </div>

          <div
            className="flex items-start gap-3 border-2 border-blue-500 p-2"
            style={{ backgroundColor: "lightblue" }}
          >
            <span className="font-medium text-black">{company.onboardingStep || "[EMPTY]"}</span>
            <span className="text-sm text-cakewalk-text-secondary">Onboarding Step</span>
          </div>
        </div>
      </ResultCard>

      {/* Summary of Benefits */}
      {summaryOfBenefits && summaryOfBenefits.length > 0 && (
        <ResultCard title={`Summary of Benefits (${summaryOfBenefits.length})`}>
          <div className="space-y-4">
            {summaryOfBenefits.map((sob: any, index: number) => (
              <div key={sob.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-medium">SOB #{index + 1}</p>
                    <p className="text-sm text-cakewalk-text-secondary">
                      {sob.totalPolicies} {sob.totalPolicies === 1 ? "policy" : "policies"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-cakewalk-text-secondary">Amount to Draft</p>
                    <p className="text-lg font-medium">{formatCurrency(sob.amountToDraft)}</p>
                  </div>
                </div>

                {sob.pdfDocumentUrl && (
                  <div className="mb-3 flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-cakewalk-text-secondary" />
                    <a
                      href={sob.pdfDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cakewalk-primary hover:underline"
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
                              <Badge variant={policy.status === "active" ? "default" : "secondary"}>
                                {policy.status}
                              </Badge>
                            </div>
                            <p className="text-cakewalk-text-secondary">
                              {policy.policyHolderName} • {policy.coverageType}
                            </p>
                            <p className="text-cakewalk-text-secondary">
                              Premium: {formatCurrency(policy.premiumAmount)}
                            </p>
                            <p className="mt-1 text-xs text-cakewalk-text-secondary">
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
            ))}
          </div>
        </ResultCard>
      )}
    </div>
  )
}
