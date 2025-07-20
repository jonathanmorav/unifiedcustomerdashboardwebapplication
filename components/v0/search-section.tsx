"use client"

import type React from "react"

import { useState } from "react"
import { Search, Mail, User, Building, Hash } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useSearch } from "@/hooks/use-search"

export function SearchSection() {
  const [searchValue, setSearchValue] = useState("")
  const [activeTab, setActiveTab] = useState("email")
  const { search, isLoading } = useSearch()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchValue) return

    // Map tab values to search types
    const searchTypeMap: Record<string, string> = {
      email: "email",
      name: "name",
      business: "business",
      dwolla: "dwollaId"
    }

    await search(searchValue, searchTypeMap[activeTab] || "email")
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setSearchValue("")
  }

  return (
    <Card className="shadow-cakewalk-medium border-cakewalk-border transition-colors duration-300">
      <CardContent className="p-4 md:p-6">
        <Tabs defaultValue="email" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Name</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Business</span>
            </TabsTrigger>
            <TabsTrigger value="dwolla" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Dwolla ID</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cakewalk-text-tertiary" />
                <Input
                  type="email"
                  placeholder="Search by email address..."
                  className="pl-10 bg-background border-cakewalk-border transition-colors duration-300"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isLoading || !searchValue}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="name">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cakewalk-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search by first and last name..."
                  className="pl-10 bg-background border-cakewalk-border transition-colors duration-300"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isLoading || !searchValue}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="business">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cakewalk-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search by business name..."
                  className="pl-10 bg-background border-cakewalk-border transition-colors duration-300"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isLoading || !searchValue}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="dwolla">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cakewalk-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search by Dwolla ID..."
                  className="pl-10 bg-background border-cakewalk-border transition-colors duration-300"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isLoading || !searchValue}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}