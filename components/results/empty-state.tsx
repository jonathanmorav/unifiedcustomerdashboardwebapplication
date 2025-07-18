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
        <SearchIcon className="text-cakewalk-text-secondary mb-4 h-12 w-12" />
        <h3 className="text-cakewalk-text-primary mb-2 text-lg font-medium">Start your search</h3>
        <p className="text-cakewalk-text-secondary max-w-md">
          Enter an email address, name, business name, or Dwolla ID to search across both HubSpot
          and Dwolla systems simultaneously.
        </p>
      </div>
    )
  }

  if (type === "no-results") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <InfoIcon className="text-cakewalk-text-secondary mb-4 h-12 w-12" />
        <h3 className="text-cakewalk-text-primary mb-2 text-lg font-medium">No results found</h3>
        <p className="text-cakewalk-text-secondary max-w-md">
          No customer data found for &quot;{searchTerm}&quot; in either HubSpot or Dwolla. Try
          searching with a different term or search type.
        </p>
      </div>
    )
  }

  if (type === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="bg-cakewalk-error/10 mb-4 rounded-full p-3">
          <InfoIcon className="text-cakewalk-error h-8 w-8" />
        </div>
        <h3 className="text-cakewalk-text-primary mb-2 text-lg font-medium">Search failed</h3>
        <p className="text-cakewalk-text-secondary mb-4 max-w-md">
          {errorMessage || "An error occurred while searching. Please try again."}
        </p>
      </div>
    )
  }

  return null
}
