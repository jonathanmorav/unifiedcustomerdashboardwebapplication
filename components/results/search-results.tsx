"use client"

import { HubSpotResultPanel } from "./hubspot-result-panel"
import { DwollaResultPanel } from "./dwolla-result-panel"
import { EmptyState } from "./empty-state"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BuildingIcon, BanknoteIcon } from "lucide-react"

interface SearchResultsProps {
  result: any // eslint-disable-line @typescript-eslint/no-explicit-any
  isLoading: boolean
  error: Error | null
  searchTerm?: string
}

export function SearchResults({ result, isLoading, error, searchTerm }: SearchResultsProps) {
  // Initial state - no search performed yet
  if (!result && !isLoading && !error) {
    return <EmptyState type="initial" />
  }

  // Error state
  if (error) {
    return <EmptyState type="error" errorMessage={error.message} />
  }

  // No results found
  if (result && !result.summary.found && !isLoading) {
    return <EmptyState type="no-results" searchTerm={searchTerm} />
  }

  const showDesktopView = typeof window !== "undefined" && window.innerWidth >= 1024

  // Mobile view - use tabs
  if (!showDesktopView) {
    return (
      <div className="w-full">
        <div className="mb-4">
          {result && (
            <div className="text-cakewalk-text-secondary flex items-center justify-between text-sm">
              <span>Found in: {result.summary.foundIn.join(", ")}</span>
              <span>Search completed in {result.summary.duration}</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="hubspot" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hubspot" className="flex items-center gap-2">
              <BuildingIcon className="h-4 w-4" />
              HubSpot
            </TabsTrigger>
            <TabsTrigger value="dwolla" className="flex items-center gap-2">
              <BanknoteIcon className="h-4 w-4" />
              Dwolla
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hubspot" className="mt-4">
            <HubSpotResultPanel
              data={result?.hubspot}
              isLoading={isLoading}
              error={result?.hubspot?.error}
            />
          </TabsContent>
          <TabsContent value="dwolla" className="mt-4">
            <DwollaResultPanel
              data={result?.dwolla}
              isLoading={isLoading}
              error={result?.dwolla?.error}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Desktop view - split panel
  return (
    <div className="w-full">
      {result && (
        <div className="text-cakewalk-text-secondary mb-4 flex items-center justify-between text-sm">
          <span>Found in: {result.summary.foundIn.join(", ")}</span>
          <span>Search completed in {result.summary.duration}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* HubSpot Panel */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <BuildingIcon className="text-cakewalk-primary h-5 w-5" />
            <h2 className="text-xl font-semibold">HubSpot</h2>
          </div>
          <HubSpotResultPanel
            data={result?.hubspot}
            isLoading={isLoading}
            error={result?.hubspot?.error}
          />
        </div>

        {/* Divider */}
        <Separator orientation="vertical" className="hidden h-full lg:block" />

        {/* Dwolla Panel */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <BanknoteIcon className="text-cakewalk-primary h-5 w-5" />
            <h2 className="text-xl font-semibold">Dwolla</h2>
          </div>
          <DwollaResultPanel
            data={result?.dwolla}
            isLoading={isLoading}
            error={result?.dwolla?.error}
          />
        </div>
      </div>
    </div>
  )
}
