"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Loader2, Download } from "lucide-react"
import { SearchType } from "@/lib/search/unified-search"
import { useSearchSuggestions } from "@/hooks/use-search-history"
import { useDebounce } from "@/hooks/use-debounce"

interface UnifiedSearchSectionProps {
  onSearch: (searchTerm: string, searchType: SearchType) => void
  isLoading: boolean
  onExport?: () => void
}

export function UnifiedSearchSection({ onSearch, isLoading, onExport }: UnifiedSearchSectionProps) {
  const [searchType, setSearchType] = useState("email")
  const [searchValues, setSearchValues] = useState({
    email: "",
    firstName: "",
    lastName: "",
    businessName: "",
    dwollaId: "",
  })

  const handleSearch = () => {
    let searchTerm = ""
    let actualSearchType: SearchType = "auto"

    switch (searchType) {
      case "email":
        searchTerm = searchValues.email.trim()
        actualSearchType = "email"
        break
      case "name":
        searchTerm = `${searchValues.firstName.trim()} ${searchValues.lastName.trim()}`
        actualSearchType = "name"
        break
      case "business_name":
        searchTerm = searchValues.businessName.trim()
        actualSearchType = "business_name"
        break
      case "dwolla_id":
        searchTerm = searchValues.dwollaId.trim()
        actualSearchType = "dwolla_id"
        break
    }

    if (searchTerm) {
      onSearch(searchTerm, actualSearchType)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearchDisabled()) {
      handleSearch()
    }
  }

  const isSearchDisabled = () => {
    switch (searchType) {
      case "email":
        return !searchValues.email.trim()
      case "name":
        return !searchValues.firstName.trim() || !searchValues.lastName.trim()
      case "business_name":
        return !searchValues.businessName.trim()
      case "dwolla_id":
        return !searchValues.dwollaId.trim()
      default:
        return true
    }
  }

  return (
    <Card className="shadow-cakewalk-medium border-cakewalk-border">
      <CardHeader>
        <CardTitle className="text-cakewalk-h3 text-cakewalk-text-primary">Customer Search</CardTitle>
        <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
          Search for customer data across HubSpot and Dwolla systems
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={searchType} onValueChange={setSearchType} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="email" className="text-cakewalk-body-xs">
              Email
            </TabsTrigger>
            <TabsTrigger value="name" className="text-cakewalk-body-xs">
              Name
            </TabsTrigger>
            <TabsTrigger value="business_name" className="text-cakewalk-body-xs">
              Business
            </TabsTrigger>
            <TabsTrigger value="dwolla_id" className="text-cakewalk-body-xs">
              Dwolla ID
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={searchValues.email}
                onChange={(e) => setSearchValues((prev) => ({ ...prev, email: e.target.value }))}
                onKeyPress={handleKeyPress}
                className="mt-2 h-11 border-cakewalk-border rounded-xl"
              />
            </div>
          </TabsContent>

          <TabsContent value="name" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={searchValues.firstName}
                  onChange={(e) => setSearchValues((prev) => ({ ...prev, firstName: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  className="mt-2 h-11 border-cakewalk-border rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={searchValues.lastName}
                  onChange={(e) => setSearchValues((prev) => ({ ...prev, lastName: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  className="mt-2 h-11 border-cakewalk-border rounded-xl"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="business_name" className="space-y-4">
            <div>
              <Label htmlFor="businessName" className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                Business Name
              </Label>
              <Input
                id="businessName"
                placeholder="Acme Corporation"
                value={searchValues.businessName}
                onChange={(e) => setSearchValues((prev) => ({ ...prev, businessName: e.target.value }))}
                onKeyPress={handleKeyPress}
                className="mt-2 h-11 border-cakewalk-border rounded-xl"
              />
            </div>
          </TabsContent>

          <TabsContent value="dwolla_id" className="space-y-4">
            <div>
              <Label htmlFor="dwollaId" className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">
                Dwolla Customer ID
              </Label>
              <Input
                id="dwollaId"
                placeholder="DW-12345"
                value={searchValues.dwollaId}
                onChange={(e) => setSearchValues((prev) => ({ ...prev, dwollaId: e.target.value }))}
                onKeyPress={handleKeyPress}
                className="mt-2 h-11 border-cakewalk-border rounded-xl"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleSearch}
            disabled={isSearchDisabled() || isLoading}
            className="bg-cakewalk-primary hover:bg-cakewalk-primary-royal text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 hover:shadow-cakewalk-hover"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Customer
              </>
            )}
          </Button>

          {onExport && (
            <Button
              variant="outline"
              onClick={onExport}
              disabled={isLoading}
              className="border-cakewalk-border text-cakewalk-text-primary hover:bg-cakewalk-alice-200 px-6 py-2.5 rounded-xl bg-transparent"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}