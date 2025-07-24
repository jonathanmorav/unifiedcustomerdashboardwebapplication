"use client"

import { Dashboard } from "@/components/v0/dashboard"
import { SearchProvider } from "@/contexts/search-context"

export default function DashboardPage() {
  return (
    <SearchProvider>
      <Dashboard />
    </SearchProvider>
  )
}
