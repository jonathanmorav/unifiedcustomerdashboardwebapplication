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
    error 
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
      <div className="bg-cakewalk-error/5 border-cakewalk-error/20 rounded-lg border p-6">
        <div className="text-cakewalk-error flex items-center gap-2">
          <AlertCircleIcon className="h-5 w-5" />
          <p className="font-medium">Session Error</p>
        </div>
        <p className="text-cakewalk-text-secondary mt-2 text-sm">{error}</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-cakewalk-text-secondary py-12 text-center">
        <VideoIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No session recordings found</p>
        <p className="text-sm mt-2">Session recordings will appear here when available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-cakewalk-text-secondary">
        Found {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
      
      {sessions.map((session) => (
        <SessionCard 
          key={session.id} 
          session={session} 
          defaultExpanded={sessions.length === 1}
        />
      ))}
    </div>
  )
}