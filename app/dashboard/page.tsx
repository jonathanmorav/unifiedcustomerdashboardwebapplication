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
    <div className="animate-fade-in mx-auto max-w-7xl">
      <Toaster position="top-right" />
      
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-cakewalk-24 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center text-sm text-amber-800">
          <strong>Demo Mode:</strong> Using mock data. Search for any term to see sample results.
        </div>
      )}

      {/* Header */}
      <div className="mb-cakewalk-32">
        <h1 className="text-cakewalk-h1 text-cakewalk-primary-dark mb-cakewalk-8">
          Customer Search
        </h1>
        <p className="text-cakewalk-body text-cakewalk-text-secondary">
          Search across HubSpot and Dwolla simultaneously to find customer information quickly.
          Press <kbd className="bg-cakewalk-bg-alice-200 rounded px-2 py-1 text-xs">⌘K</kbd> to
          focus search.
        </p>
      </div>

      {/* Search Controls */}
      <div className="mb-cakewalk-32 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row">
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
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
        <div className="space-y-6">
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
