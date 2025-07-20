import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Clock, Search, X } from "lucide-react"

// Mock data for recent searches
const recentSearches = [
  {
    id: "1",
    query: "john.doe@example.com",
    type: "email",
    timestamp: "2 hours ago",
  },
  {
    id: "2",
    query: "Jane Smith",
    type: "name",
    timestamp: "Yesterday",
  },
  {
    id: "3",
    query: "Acme Corporation",
    type: "business",
    timestamp: "2 days ago",
  },
  {
    id: "4",
    query: "DW-12345",
    type: "dwolla",
    timestamp: "3 days ago",
  },
]

export function RecentSearches() {
  return (
    <Card className="shadow-cakewalk-medium border-cakewalk-border transition-colors duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary flex items-center gap-2">
          <Clock className="h-5 w-5 text-cakewalk-primary" />
          Recent Searches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentSearches.map((search) => (
          <div
            key={search.id}
            className="flex items-center justify-between p-3 bg-cakewalk-alice-200 rounded-xl transition-colors duration-300"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-cakewalk-text-secondary" />
              <div>
                <p className="text-cakewalk-body-xs font-medium text-cakewalk-text-primary">{search.query}</p>
                <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">{search.timestamp}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <X className="h-4 w-4" />
              <span className="sr-only">Remove</span>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
