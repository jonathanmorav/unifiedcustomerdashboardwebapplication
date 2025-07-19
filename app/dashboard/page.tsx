"use client"

import { useState, useRef } from "react"
import { UnifiedSearchBar } from "@/components/search/unified-search-bar"
import { SearchTypeSelector } from "@/components/search/search-type-selector"
import { SearchResults } from "@/components/results/search-results"
import { SearchHistory } from "@/components/search/search-history"
import { ActionBar } from "@/components/actions/action-bar"
import { SearchMetrics } from "@/components/monitoring/search-metrics"
import { Toaster } from "@/components/ui/sonner"
import { useSearch } from "@/hooks/use-search"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { SearchType } from "@/lib/search/unified-search"

export default function DashboardPage() {
  const [searchType, setSearchType] = useState<SearchType>("auto")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { search, isLoading, error, result } = useSearch()

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      meta: true,
      callback: () => {
        searchInputRef.current?.focus()
      },
    },
    {
      key: "k",
      ctrl: true,
      callback: () => {
        searchInputRef.current?.focus()
      },
    },
  ])

  const handleSearch = (searchTerm: string, type: SearchType) => {
    search(searchTerm, type)
  }

  const handleRefresh = () => {
    if (result) {
      const searchTerm = result.searchTerm || ""
      search(searchTerm, searchType)
    }
  }

  // Calculate metrics
  const responseTime = result?.summary?.duration ? parseInt(result.summary.duration) : undefined
  const hubspotStatus = result?.hubspot?.error ? "error" : "healthy"
  const dwollaStatus = result?.dwolla?.error ? "error" : "healthy"

  // Check if we're in demo mode
  const isDemoMode = !process.env.NEXT_PUBLIC_HUBSPOT_CONFIGURED

  return (
    <div className="animate-fade-in container mx-auto px-cakewalk-16 py-cakewalk-32 md:px-cakewalk-32">
      <Toaster position="top-right" />

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-cakewalk-24 rounded-cakewalk-medium border border-cakewalk-warning/20 bg-cakewalk-warning/10 px-cakewalk-16 py-cakewalk-12 text-center">
          <p className="text-cakewalk-body-sm text-cakewalk-warning font-cakewalk-medium">
            <strong className="font-cakewalk-semibold">Demo Mode:</strong> Using mock data. Search for any term to see sample results.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-cakewalk-32">
        <h1 className="text-cakewalk-h1 font-cakewalk-bold text-cakewalk-primary-dark mb-cakewalk-8 font-space-grotesk">
          Customer Search
        </h1>
        <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
          Search across HubSpot and Dwolla simultaneously to find customer information quickly.
          Press <kbd className="bg-cakewalk-bg-alice-200 border border-cakewalk-border rounded-cakewalk-small px-cakewalk-8 py-cakewalk-4 text-cakewalk-body-xs font-cakewalk-medium">⌘K</kbd> to
          focus search.
        </p>
      </div>

      {/* Search Controls */}
      <div className="mb-cakewalk-32 space-y-cakewalk-16">
        <div className="flex flex-col gap-cakewalk-16 md:flex-row">
          <div className="flex-1">
            <UnifiedSearchBar
              onSearch={handleSearch}
              searchType={searchType}
              isLoading={isLoading}
              className="w-full"
            />
          </div>
          <SearchTypeSelector value={searchType} onChange={setSearchType} />
        </div>

        {/* Action Bar */}
        {result && <ActionBar data={result} onRefresh={handleRefresh} isLoading={isLoading} />}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-cakewalk-24 xl:grid-cols-4">
        {/* Search Results - Takes up 3 columns on XL screens */}
        <div className="xl:col-span-3">
          <SearchResults
            result={result}
            isLoading={isLoading}
            error={error}
            searchTerm={result?.searchTerm}
          />
        </div>

        {/* Sidebar - Search History and Metrics */}
        <div className="space-y-cakewalk-24">
          {/* Performance Metrics */}
          <SearchMetrics
            responseTime={responseTime}
            hubspotStatus={hubspotStatus as "healthy" | "degraded" | "error"}
            dwollaStatus={dwollaStatus as "healthy" | "degraded" | "error"}
            errorRate={0}
            isRateLimited={false}
          />

          {/* Search History */}
          <SearchHistory />
        </div>
      </div>
    </div>
  )
}
