"use client"

import { useState, useEffect } from "react"
import { HubSpotResultPanel } from "./hubspot-result-panel"
import { DwollaResultPanel } from "./dwolla-result-panel"
import { ClarityResultPanel } from "./clarity-result-panel"
import { EmptyState } from "./empty-state"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BuildingIcon, BanknoteIcon, VideoIcon } from "lucide-react"

interface SearchResultsProps {
  result: any // eslint-disable-line @typescript-eslint/no-explicit-any
  isLoading: boolean
  error: Error | null
  searchTerm?: string
}

export function SearchResults({ result, isLoading, error, searchTerm }: SearchResultsProps) {
  // React hooks must be called before any early returns
  const [showDesktopView, setShowDesktopView] = useState(true)

  useEffect(() => {
    const checkViewport = () => {
      setShowDesktopView(window.innerWidth >= 1024)
      console.log(
        "[SEARCH RESULTS DEBUG] Viewport check - showDesktopView:",
        window.innerWidth >= 1024,
        "Width:",
        window.innerWidth
      )
    }

    // Set initial value
    checkViewport()

    // Add listener
    window.addEventListener("resize", checkViewport)

    // Cleanup
    return () => window.removeEventListener("resize", checkViewport)
  }, [])

  // Debug logging
  if (result) {
    console.log("[SEARCH RESULTS DEBUG] Full result:", result)
    console.log("[SEARCH RESULTS DEBUG] HubSpot data:", result.hubspot)
    console.log("[SEARCH RESULTS DEBUG] HubSpot data.data:", result.hubspot?.data)
    console.log("[SEARCH RESULTS DEBUG] Clarity sessions:", result.hubspot?.data?.claritySessions)
    console.log(
      "[SEARCH RESULTS DEBUG] Clarity sessions count:",
      result.hubspot?.data?.claritySessions?.length || 0
    )
  }

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

  // Mobile view - use tabs
  if (!showDesktopView) {
    return (
      <div className="w-full">
        <div className="mb-4">
          {result && (
            <div className="flex items-center justify-between text-sm text-cakewalk-text-secondary">
              <span>Found in: {result.summary.foundIn.join(", ")}</span>
              <span>Search completed in {result.summary.duration}</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="hubspot" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hubspot" className="flex items-center gap-2">
              <BuildingIcon className="h-4 w-4" />
              HubSpot
            </TabsTrigger>
            <TabsTrigger value="dwolla" className="flex items-center gap-2">
              <BanknoteIcon className="h-4 w-4" />
              Dwolla
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <VideoIcon className="h-4 w-4" />
              Sessions
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
          <TabsContent value="sessions" className="mt-4">
            <ClarityResultPanel
              sessions={result?.hubspot?.data?.claritySessions}
              isLoading={isLoading}
              error={result?.sessions?.error}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Desktop view - vertical stack
  return (
    <div className="w-full">
      {result && (
        <div className="mb-4 flex items-center justify-between text-sm text-cakewalk-text-secondary">
          <span>Found in: {result.summary.foundIn.join(", ")}</span>
          <span>Search completed in {result.summary.duration}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* HubSpot Panel */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <BuildingIcon className="h-5 w-5 text-cakewalk-primary" />
            <h2 className="text-xl font-semibold">HubSpot</h2>
          </div>
          <HubSpotResultPanel
            data={result?.hubspot}
            isLoading={isLoading}
            error={result?.hubspot?.error}
          />
        </div>

        <Separator />

        {/* Dwolla Panel */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <BanknoteIcon className="h-5 w-5 text-cakewalk-primary" />
            <h2 className="text-xl font-semibold">Dwolla</h2>
          </div>
          <DwollaResultPanel
            data={result?.dwolla}
            isLoading={isLoading}
            error={result?.dwolla?.error}
          />
        </div>

        <Separator />

        {/* Clarity Sessions Panel */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <VideoIcon className="h-5 w-5 text-cakewalk-primary" />
            <h2 className="text-xl font-semibold">Session Recordings</h2>
          </div>
          <ClarityResultPanel
            sessions={result?.hubspot?.data?.claritySessions}
            isLoading={isLoading}
            error={result?.sessions?.error}
          />
        </div>
      </div>
    </div>
  )
}
