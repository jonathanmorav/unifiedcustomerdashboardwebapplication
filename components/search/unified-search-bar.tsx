"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { SearchIcon, XIcon, LoaderIcon } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { useSearchSuggestions } from "@/hooks/use-search-history"
import { SearchType } from "@/lib/search/unified-search"

interface UnifiedSearchBarProps {
  onSearch: (searchTerm: string, searchType: SearchType) => void
  searchType: SearchType
  isLoading: boolean
  className?: string
}

export function UnifiedSearchBar({
  onSearch,
  searchType,
  isLoading,
  className,
}: UnifiedSearchBarProps) {
  const [value, setValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
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
      onSearch(value.trim(), searchType)
      setIsOpen(false)
    }
  }

  const handleSelectSuggestion = (suggestion: string) => {
    setValue(suggestion)
    onSearch(suggestion, searchType)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setValue("")
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cakewalk-text-secondary" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => value && suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search by email, name, business name, or Dwolla ID..."
          className="h-12 pl-10 pr-24 text-base"
          disabled={isLoading}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
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
        <div className="absolute top-full z-50 mt-2 w-full">
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
  )
}
