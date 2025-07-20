# UI Migration Component Mapping

## Overview
This document maps the components from the existing UI to the new design to ensure proper migration while preserving backend functionality.

## Key Differences

### 1. Authentication
- **Current**: Uses NextAuth with Google OAuth via `/app/auth/signin/page.tsx`
- **New Design**: Mock auth screen in `components/auth-screen.tsx`
- **Action**: Keep existing NextAuth implementation, update only styling

### 2. Design System
- **Current**: Uses Cakewalk design tokens with specific prefix (`cakewalk-`)
- **New Design**: Uses shadcn/ui with HSL color variables
- **Action**: Merge both systems, keeping Cakewalk branding

### 3. Component Structure

#### Search Components
| Current Component | New Component | Migration Notes |
|------------------|---------------|-----------------|
| `UnifiedSearchBar` | `SearchSection` | Keep search logic, update UI |
| `SearchTypeSelector` | Tabs in `SearchSection` | Preserve auto-detection |
| `useSearch` hook | Mock in Dashboard | Keep existing hook |
| `AdvancedSearchBar` | N/A | Preserve for advanced features |

#### Result Display
| Current Component | New Component | Migration Notes |
|------------------|---------------|-----------------|
| `SearchResults` | `DataPanels` | Keep data structure |
| `HubSpotResultPanel` | Part of `DataPanels` | Preserve data fetching |
| `DwollaResultPanel` | Part of `DataPanels` | Keep API integration |
| `SearchHistory` | `RecentSearches` | Update UI only |

#### UI Primitives
| Current Component | New Component | Migration Notes |
|------------------|---------------|-----------------|
| shadcn Button | shadcn Button | Update styling |
| shadcn Input | shadcn Input | Add rounded-xl |
| shadcn Card | shadcn Card | Update shadows |
| Custom Skeleton | Keep existing | No change |

### 4. Layout Structure
- **Current**: Dashboard layout with sidebar for metrics
- **New Design**: Simplified layout with stacked sections
- **Action**: Merge approaches, keep metrics in sidebar

### 5. API Integration Points (DO NOT MODIFY)
- `/api/search/*` - All search endpoints
- `/api/auth/*` - Authentication endpoints
- `/api/export/*` - PDF export functionality
- `/api/health/*` - Health check endpoints
- All hooks in `/hooks/*`

### 6. State Management
- **Current**: Custom hooks (useSearch, useKeyboardShortcuts)
- **New Design**: Local state in components
- **Action**: Keep existing hooks, connect to new UI

### 7. Theme System
- **Current**: ThemeProvider with dark mode
- **New Design**: CSS variables only
- **Action**: Keep ThemeProvider, update CSS variables

## Migration Priority

### Phase 1: Foundation (Day 1-2)
1. Merge Tailwind configs
2. Update global CSS with new design tokens
3. Keep existing font configuration

### Phase 2: UI Components (Day 3-5)
1. Update Button, Input, Card components
2. Migrate search UI while keeping logic
3. Update result display panels

### Phase 3: Layout & Pages (Day 6-7)
1. Update dashboard layout
2. Preserve authentication flow
3. Maintain all routing

### Phase 4: Testing (Day 8-9)
1. Verify all API calls work
2. Test search functionality
3. Ensure authentication works
4. Check PDF export

## Files to Preserve (No Changes)
- `/app/api/**/*` - All API routes
- `/lib/auth/*` - Authentication logic
- `/lib/search/*` - Search implementation
- `/lib/security/*` - Security middleware
- `/hooks/*` - Business logic hooks
- `/prisma/*` - Database schema
- `/.env*` - Environment files

## Success Criteria
- ✅ All backend functionality unchanged
- ✅ Search works identically
- ✅ Authentication flow preserved
- ✅ New UI matches design
- ✅ Performance maintained
- ✅ No breaking changes