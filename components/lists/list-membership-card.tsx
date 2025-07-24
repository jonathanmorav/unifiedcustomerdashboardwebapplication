"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, ListIcon, ClockIcon } from "lucide-react"
import { formatDate } from "@/utils/format-date"
import type { HubSpotListMembership } from "@/lib/types/hubspot"

interface ListMembershipCardProps {
  list: HubSpotListMembership
}

export function ListMembershipCard({ list }: ListMembershipCardProps) {
  const isStatic = list.listType === "STATIC"

  return (
    <Card className="border-cakewalk-border shadow-cakewalk-medium transition-shadow duration-300 hover:shadow-cakewalk-hover">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ListIcon className="h-5 w-5 text-cakewalk-primary" />
            <h4 className="text-cakewalk-body-md font-cakewalk-semibold line-clamp-1 text-cakewalk-text-primary">
              {list.listName}
            </h4>
          </div>
          <Badge
            variant={isStatic ? "secondary" : "default"}
            className={`${
              isStatic
                ? "bg-cakewalk-text-secondary/10 text-cakewalk-text-secondary"
                : "bg-cakewalk-success-light text-cakewalk-success-dark"
            } border-0`}
          >
            {list.listType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-cakewalk-body-xs text-cakewalk-text-secondary">
          <span className="font-cakewalk-medium">List ID:</span>
          <span className="font-mono">{list.listId}</span>
        </div>

        {list.membershipTimestamp && (
          <div className="flex items-center gap-2 text-cakewalk-body-xs text-cakewalk-text-secondary">
            <CalendarIcon className="h-4 w-4" />
            <span>Added: {formatDate(list.membershipTimestamp)}</span>
          </div>
        )}

        <div className="border-t border-cakewalk-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              {isStatic ? "Fixed membership" : "Auto-updating"}
            </span>
            {!isStatic && (
              <div className="flex items-center gap-1 text-cakewalk-success">
                <ClockIcon className="h-3 w-3" />
                <span className="text-cakewalk-body-xxs">Active</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
