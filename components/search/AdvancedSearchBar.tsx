"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { 
  SearchIcon, 
  XIcon, 
  LoaderIcon, 
  Filter, 
  SlidersHorizontal,
  Save,
  Star
} from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { useSearchSuggestions } from "@/hooks/use-search-history"
import { FilterPanel } from "./filters/FilterPanel"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdvancedSearchParams, SearchFilters, SearchType, SavedSearch, SearchTemplate } from "@/lib/types/search"

interface AdvancedSearchBarProps {
  onSearch: (params: AdvancedSearchParams) => void
  searchType: SearchType
  isLoading: boolean
  savedSearches?: SavedSearch[]
  searchTemplates?: SearchTemplate[]
  onSaveSearch?: (name: string, description?: string) => void
  className?: string
}

export function AdvancedSearchBar({
  onSearch,
  searchType,
  isLoading,
  savedSearches = [],
  searchTemplates = [],
  onSaveSearch,
  className,
}: AdvancedSearchBarProps) {
  const [value, setValue] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({})
  const [isOpen, setIsOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const debouncedValue = useDebounce(value, 300)
  const { suggestions, fetchSuggestions } = useSearchSuggestions()
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    if (debouncedValue) {
      fetchSuggestions(debouncedValue)
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }, [debouncedValue, fetchSuggestions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSearch({
        searchTerm: value.trim(),
        searchType,
        filters,
      })
      setIsOpen(false)
    }
  }

  const handleSelectSuggestion = (suggestion: string) => {
    setValue(suggestion)
    onSearch({
      searchTerm: suggestion,
      searchType,
      filters,
    })
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setValue("")
    setFilters({})
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleApplyFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters)
    setShowFilters(false)
    
    // Re-run search if there's a search term
    if (value.trim()) {
      onSearch({
        searchTerm: value.trim(),
        searchType,
        filters: newFilters,
      })
    }
  }

  const handleLoadSavedSearch = (savedSearch: SavedSearch) => {
    setValue(savedSearch.searchParams.searchTerm)
    setFilters(savedSearch.searchParams.filters || {})
    onSearch(savedSearch.searchParams)
  }

  const handleApplyTemplate = (template: SearchTemplate) => {
    if (template.searchParams.searchTerm) {
      setValue(template.searchParams.searchTerm)
    }
    if (template.searchParams.filters) {
      setFilters(template.searchParams.filters)
    }
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.customerStatus?.length) count += filters.customerStatus.length
    if (filters.transferStatus?.length) count += filters.transferStatus.length
    if (filters.fundingSourceStatus?.length) count += filters.fundingSourceStatus.length
    if (filters.createdDateRange) count++
    if (filters.modifiedDateRange) count++
    if (filters.transferDateRange) count++
    if (filters.transferAmountRange) count++
    if (filters.benefitAmountRange) count++
    if (filters.hasFailedTransfers !== undefined) count++
    if (filters.hasUnverifiedFunding !== undefined) count++
    if (filters.hasPendingInvoices !== undefined) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  return (
    <>
      <form onSubmit={handleSubmit} className={`relative ${className}`}>
        <div className="relative">
          <SearchIcon className="text-cakewalk-text-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => value && suggestions.length > 0 && setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder="Search by email, name, business name, or Dwolla ID..."
            className="h-12 pr-32 pl-10 text-base"
            disabled={isLoading}
          />
          
          {/* Filter indicator badges */}
          {activeFilterCount > 0 && (
            <div className="absolute left-10 top-full mt-1 flex gap-1">
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </Badge>
            </div>
          )}
          
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {/* Quick actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {savedSearches.length > 0 && (
                  <>
                    <DropdownMenuLabel>Saved Searches</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {savedSearches.slice(0, 5).map((saved) => (
                        <DropdownMenuItem
                          key={saved.id}
                          onClick={() => handleLoadSavedSearch(saved)}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          {saved.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {searchTemplates.length > 0 && (
                  <>
                    <DropdownMenuLabel>Templates</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {searchTemplates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => handleApplyTemplate(template)}
                        >
                          {template.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {onSaveSearch && value.trim() && (
                  <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                    <Save className="mr-2 h-4 w-4" />
                    Save current search
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Filter button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 w-8 p-0 relative"
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cakewalk-primary text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8 w-8 p-0"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
            
            <Button type="submit" size="sm" disabled={!value.trim() || isLoading} className="h-8">
              {isLoading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </div>

        {isOpen && suggestions.length > 0 && (
          <div className="absolute top-full z-50 mt-8 w-full">
            <Command className="rounded-lg border shadow-md">
              <CommandList>
                <CommandGroup heading="Recent searches">
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion}
                      onSelect={() => handleSelectSuggestion(suggestion)}
                      className="cursor-pointer"
                    >
                      <SearchIcon className="mr-2 h-4 w-4" />
                      {suggestion}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </form>

      {/* Filter panel sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Search Filters</SheetTitle>
            <SheetDescription>
              Refine your search results with advanced filters
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <FilterPanel
              filters={filters}
              onFiltersChange={handleApplyFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}