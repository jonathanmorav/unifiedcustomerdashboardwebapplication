"use client"

import { SessionCard } from "./session-card"
import { Skeleton } from "@/components/ui/skeleton"
import { VideoIcon, AlertCircleIcon } from "lucide-react"
import type { ClaritySession } from "@/lib/types/hubspot"

interface ClarityResultPanelProps {
  sessions?: ClaritySession[]
  isLoading: boolean
  error?: string
}

export function ClarityResultPanel({ sessions, isLoading, error }: ClarityResultPanelProps) {
  console.log("[CLARITY DEBUG] ClarityResultPanel props:", {
    sessionsCount: sessions?.length,
    sessions,
    isLoading,
    error,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-cakewalk-error/20 bg-cakewalk-error/5 p-6">
        <div className="flex items-center gap-2 text-cakewalk-error">
          <AlertCircleIcon className="h-5 w-5" />
          <p className="font-medium">Session Error</p>
        </div>
        <p className="mt-2 text-sm text-cakewalk-text-secondary">{error}</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="py-12 text-center text-cakewalk-text-secondary">
        <VideoIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No session recordings found</p>
        <p className="mt-2 text-sm">Session recordings will appear here when available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-cakewalk-text-secondary">
        Found {sessions.length} session{sessions.length !== 1 ? "s" : ""}
      </div>

      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} defaultExpanded={sessions.length === 1} />
      ))}
    </div>
  )
}
