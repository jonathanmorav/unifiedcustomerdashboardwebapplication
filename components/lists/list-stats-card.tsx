"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface ListStatsCardProps {
  icon: LucideIcon
  title: string
  value: number | string
  description: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function ListStatsCard({
  icon: Icon,
  title,
  value,
  description,
  trend,
}: ListStatsCardProps) {
  return (
    <Card className="border-cakewalk-border shadow-cakewalk-medium">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-5 w-5 text-cakewalk-primary" />
              <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">{title}</p>
            </div>
            <p className="font-cakewalk-bold mb-1 text-cakewalk-h2 text-cakewalk-text-primary">
              {value}
            </p>
            <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">{description}</p>
          </div>

          {trend && (
            <div
              className={`flex items-center gap-1 ${
                trend.isPositive ? "text-cakewalk-success" : "text-cakewalk-error"
              }`}
            >
              {trend.isPositive ? (
                <TrendingUpIcon className="h-4 w-4" />
              ) : (
                <TrendingDownIcon className="h-4 w-4" />
              )}
              <span className="font-cakewalk-semibold text-cakewalk-body-xs">{trend.value}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
