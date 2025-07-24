"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  VideoIcon,
  ZapIcon,
  ClockIcon,
  ExternalLinkIcon,
} from "lucide-react"
import type { ClaritySession } from "@/lib/types/hubspot"
import { formatDate } from "@/utils/format-date"

interface SessionCardProps {
  session: ClaritySession
  defaultExpanded?: boolean
}

export function SessionCard({ session, defaultExpanded = false }: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Debug logging for session data
  console.log(`[CLARITY DEBUG] SessionCard rendering session:`, {
    id: session.id,
    recordingUrl: session.recordingUrl,
    timestamp: session.timestamp,
    duration: session.duration,
    smartEvents: session.smartEvents?.length || 0,
  })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="cursor-pointer pb-3" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="space-y-2">
          {/* Header with Clarity branding and timestamp */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VideoIcon className="h-5 w-5 text-cakewalk-primary" />
              <span className="font-medium">Microsoft Clarity</span>
            </div>
            <span className="text-sm text-cakewalk-text-secondary">
              {formatDate(session.timestamp)}
            </span>
          </div>

          {/* Recording link and expand indicator */}
          <div className="flex items-center justify-between">
            {session.recordingUrl ? (
              <a
                href={session.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-cakewalk-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Click to view recording
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            ) : (
              <div className="flex items-center gap-1 text-sm text-cakewalk-text-secondary">
                <span>No recording URL available</span>
                <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                  Debug: Session ID {session.id}
                </span>
              </div>
            )}
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-cakewalk-text-secondary" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-cakewalk-text-secondary" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && session.smartEvents && session.smartEvents.length > 0 && (
        <CardContent className="border-t pt-4">
          <div className="space-y-3">
            <h4 className="font-medium">Smart events</h4>

            {session.smartEvents.map((event, index) => (
              <div key={index} className="flex items-start gap-3 pl-2">
                <ZapIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Event:</span>
                    <span className="text-sm">{event.event}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 text-xs">
                      Type: {event.type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-3 w-3 text-cakewalk-text-secondary" />
                    <span className="text-sm text-cakewalk-text-secondary">
                      Start Time: {event.startTime}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Optional: Additional metadata */}
          {(session.duration || session.deviceType || session.browser) && (
            <div className="mt-4 space-y-2 border-t pt-4">
              {session.duration && (
                <div className="flex items-center gap-2 text-sm text-cakewalk-text-secondary">
                  <ClockIcon className="h-3 w-3" />
                  Duration: {Math.floor(session.duration / 60)}m {session.duration % 60}s
                </div>
              )}
              {session.deviceType && (
                <div className="text-sm text-cakewalk-text-secondary">
                  Device: {session.deviceType}
                </div>
              )}
              {session.browser && (
                <div className="text-sm text-cakewalk-text-secondary">
                  Browser: {session.browser}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
