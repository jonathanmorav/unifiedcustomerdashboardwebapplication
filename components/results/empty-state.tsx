import { SearchIcon, InfoIcon } from "lucide-react"

interface EmptyStateProps {
  type: "initial" | "no-results" | "error"
  searchTerm?: string
  errorMessage?: string
}

export function EmptyState({ type, searchTerm, errorMessage }: EmptyStateProps) {
  if (type === "initial") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <SearchIcon className="mb-4 h-12 w-12 text-cakewalk-text-secondary" />
        <h3 className="mb-2 text-lg font-medium text-cakewalk-text-primary">Start your search</h3>
        <p className="max-w-md text-cakewalk-text-secondary">
          Enter an email address, name, business name, or Dwolla ID to search across both HubSpot
          and Dwolla systems simultaneously.
        </p>
      </div>
    )
  }

  if (type === "no-results") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <InfoIcon className="mb-4 h-12 w-12 text-cakewalk-text-secondary" />
        <h3 className="mb-2 text-lg font-medium text-cakewalk-text-primary">No results found</h3>
        <p className="max-w-md text-cakewalk-text-secondary">
          No customer data found for &quot;{searchTerm}&quot; in either HubSpot or Dwolla. Try
          searching with a different term or search type.
        </p>
      </div>
    )
  }

  if (type === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 rounded-full bg-cakewalk-error/10 p-3">
          <InfoIcon className="h-8 w-8 text-cakewalk-error" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-cakewalk-text-primary">Search failed</h3>
        <p className="mb-4 max-w-md text-cakewalk-text-secondary">
          {errorMessage || "An error occurred while searching. Please try again."}
        </p>
      </div>
    )
  }

  return null
}
