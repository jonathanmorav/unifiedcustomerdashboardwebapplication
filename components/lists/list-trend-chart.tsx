"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from "recharts"
import { formatDate } from "@/utils/format-date"

interface ListTrendChartProps {
  listName: string
  data: Array<{
    date: string
    memberCount: number
  }>
  timeframe: "daily" | "weekly" | "monthly"
}

export function ListTrendChart({ listName, data, timeframe }: ListTrendChartProps) {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-cakewalk-light border-cakewalk-border">
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
            No historical data available yet
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate trend
  const firstValue = data[0]?.memberCount || 0
  const lastValue = data[data.length - 1]?.memberCount || 0
  const trendValue = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0
  const isPositiveTrend = trendValue >= 0

  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    memberCount: item.memberCount || 0,
    displayDate: formatDate(item.date, timeframe === "daily" ? "short" : "medium"),
  }))

  return (
    <Card className="shadow-cakewalk-light border-cakewalk-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <h5 className="text-cakewalk-body-md font-cakewalk-semibold text-cakewalk-text-primary">
            {listName}
          </h5>
          <div className="flex items-center gap-2">
            <span className="text-cakewalk-body-sm font-cakewalk-medium text-cakewalk-text-primary">
              {lastValue.toLocaleString()} members
            </span>
            <Badge 
              variant={isPositiveTrend ? "default" : "destructive"}
              className={`${
                isPositiveTrend 
                  ? "bg-cakewalk-success-light text-cakewalk-success-dark" 
                  : "bg-cakewalk-error/10 text-cakewalk-error"
              } border-0`}
            >
              <span className="flex items-center gap-1">
                {isPositiveTrend ? (
                  <TrendingUpIcon className="h-3 w-3" />
                ) : (
                  <TrendingDownIcon className="h-3 w-3" />
                )}
                {Math.abs(trendValue).toFixed(1)}%
              </span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`gradient-${listName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#005dfe" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#005dfe" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eaf2ff" />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 12, fill: "#5d6b85" }}
                axisLine={{ stroke: "#cbdeff" }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: "#5d6b85" }}
                axisLine={{ stroke: "#cbdeff" }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "#fff",
                  border: "1px solid #cbdeff",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
                labelStyle={{ color: "#424b5b", fontWeight: 500 }}
                formatter={(value: number) => [value.toLocaleString(), "Members"]}
              />
              <Area 
                type="monotone" 
                dataKey="memberCount" 
                stroke="#005dfe"
                strokeWidth={2}
                fill={`url(#gradient-${listName})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}