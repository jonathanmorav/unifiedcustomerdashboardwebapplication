"use client"

import { useState } from "react"
import { Star, Trash2, Edit2, Search, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { SavedSearch, AdvancedSearchParams } from "@/lib/types/search"
import { formatDistanceToNow } from "date-fns"

interface SavedSearchesProps {
  searches: SavedSearch[]
  onLoad: (search: SavedSearch) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<SavedSearch>) => void
  onCreate: (
    name: string,
    description: string,
    params: AdvancedSearchParams,
    isPublic: boolean
  ) => void
  currentSearchParams?: AdvancedSearchParams
  className?: string
}

export function SavedSearches({
  searches,
  onLoad,
  onDelete,
  onUpdate,
  onCreate,
  currentSearchParams,
  className,
}: SavedSearchesProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null)
  const [newSearchName, setNewSearchName] = useState("")
  const [newSearchDescription, setNewSearchDescription] = useState("")
  const [newSearchPublic, setNewSearchPublic] = useState(false)

  const handleCreate = () => {
    if (newSearchName && currentSearchParams) {
      onCreate(newSearchName, newSearchDescription, currentSearchParams, newSearchPublic)
      setShowCreateDialog(false)
      setNewSearchName("")
      setNewSearchDescription("")
      setNewSearchPublic(false)
    }
  }

  const handleUpdate = () => {
    if (editingSearch && newSearchName) {
      onUpdate(editingSearch.id, {
        name: newSearchName,
        description: newSearchDescription,
        isPublic: newSearchPublic,
      })
      setEditingSearch(null)
      setNewSearchName("")
      setNewSearchDescription("")
      setNewSearchPublic(false)
    }
  }

  const formatSearchSummary = (search: SavedSearch) => {
    const params = search.searchParams
    const parts = []

    if (params.searchTerm) {
      parts.push(`"${params.searchTerm}"`)
    }

    if (params.filters) {
      const filterCount = Object.keys(params.filters).filter(
        (key) => params.filters![key as keyof typeof params.filters] !== undefined
      ).length
      if (filterCount > 0) {
        parts.push(`${filterCount} filter${filterCount > 1 ? "s" : ""}`)
      }
    }

    return parts.join(" with ") || "Empty search"
  }

  const sortedSearches = [...searches].sort((a, b) => {
    // Templates first
    if (a.isTemplate && !b.isTemplate) return -1
    if (!a.isTemplate && b.isTemplate) return 1

    // Then by last used
    const aLastUsed = a.lastUsed ? new Date(a.lastUsed).getTime() : 0
    const bLastUsed = b.lastUsed ? new Date(b.lastUsed).getTime() : 0
    return bLastUsed - aLastUsed
  })

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Saved Searches</h3>
        {currentSearchParams && (
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Star className="mr-2 h-4 w-4" />
            Save Current
          </Button>
        )}
      </div>

      {searches.length === 0 ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-500">No saved searches yet</p>
          {currentSearchParams && (
            <p className="mt-2 text-sm text-gray-400">
              Save your current search to quickly access it later
            </p>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedSearches.map((search) => (
            <Card
              key={search.id}
              className="cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => onLoad(search)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-medium">{search.name}</h4>
                    {search.isTemplate && (
                      <Badge variant="secondary" className="text-xs">
                        Template
                      </Badge>
                    )}
                    {search.isPublic && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="mr-1 h-3 w-3" />
                        Shared
                      </Badge>
                    )}
                  </div>

                  {search.description && (
                    <p className="mb-2 text-sm text-gray-600">{search.description}</p>
                  )}

                  <p className="text-sm text-gray-500">{formatSearchSummary(search)}</p>

                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    {search.lastUsed && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Used {formatDistanceToNow(new Date(search.lastUsed), { addSuffix: true })}
                      </span>
                    )}
                    <span>{search.useCount} uses</span>
                  </div>
                </div>

                {!search.isTemplate && (
                  <div className="ml-4 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingSearch(search)
                        setNewSearchName(search.name)
                        setNewSearchDescription(search.description || "")
                        setNewSearchPublic(search.isPublic)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm("Are you sure you want to delete this saved search?")) {
                          onDelete(search.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingSearch}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingSearch(null)
            setNewSearchName("")
            setNewSearchDescription("")
            setNewSearchPublic(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSearch ? "Edit Saved Search" : "Save Current Search"}</DialogTitle>
            <DialogDescription>
              Give your search a name and description to easily find it later
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newSearchName}
                onChange={(e) => setNewSearchName(e.target.value)}
                placeholder="e.g., Unverified customers with pending transfers"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newSearchDescription}
                onChange={(e) => setNewSearchDescription(e.target.value)}
                placeholder="Add notes about when to use this search..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="public">Share with team</Label>
                <p className="text-sm text-gray-500">Allow other team members to use this search</p>
              </div>
              <Switch id="public" checked={newSearchPublic} onCheckedChange={setNewSearchPublic} />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingSearch(null)
                setNewSearchName("")
                setNewSearchDescription("")
                setNewSearchPublic(false)
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingSearch ? handleUpdate : handleCreate} disabled={!newSearchName}>
              {editingSearch ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
