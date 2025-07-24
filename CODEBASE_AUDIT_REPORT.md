# Codebase Audit Report - Three Problem Areas

This document provides a complete inventory of all affected files and line numbers for the three targeted problem areas that need to be fixed.

## Problem Area 1: Date Preset Logic

### Files with Date Preset Issues:

#### `components/search/filters/DateRangeFilter.tsx`

- **Lines 22-54**: `presetRanges` array with hardcoded date logic
- **Lines 27, 33, 39**: `setDate()` calls with hardcoded day calculations
- **Lines 67-73**: `handlePresetClick()` function using preset logic
- **Lines 110-117**: Preset buttons rendering

#### `components/billing/BillingFilters.tsx`

- **Lines 55-62**: `datePresets` array definition
- **Lines 83-115**: `handleDatePresetChange()` function with hardcoded date calculations
- **Lines 88-103**: Switch statement with hardcoded preset logic (today, week, month, quarter, year)
- **Lines 190-203**: Date preset selector in UI
- **Lines 197-201**: Preset options mapping

#### `__tests__/components/search/filters/DateRangeFilter.test.tsx`

- **Lines 5, 57, 64, 73, 89, 105, 123, 141, 292, 298**: Test cases using preset logic

#### `components/search/filters/AmountRangeFilter.tsx`

- **Lines 36, 67-71, 136, 138, 141, 143**: Date-related preset logic (likely copy-paste error)

#### Additional Files with Date Logic:

- `lib/api/dwolla/ach-sync.ts` - Line 422
- `app/api/lists/history/route.ts` - Line 24
- `app/billing/page.tsx` - Lines 30, 72
- `lib/types/search.ts` - Line 143
- `scripts/seed-ach-simple.js` - Line 19
- `app/api/lists/snapshot/route.ts` - Line 82

## Problem Area 2: Status String Issues

### Files with Status String Problems:

#### `components/billing/BillingFilters.tsx`

- **Line 67**: Hardcoded "Completed" status string in statusOptions

#### `components/billing/TransactionTable.tsx`

- **Lines 29, 58**: Status type definition and usage with "completed" string

#### `components/search/filters/FilterPanel.tsx`

- **Line 150**: Status string usage

#### `lib/api/dwolla/ach-sync.ts`

- **Lines 96, 357, 388, 409, 449-451**: Multiple "completed" status references

#### `hooks/use-ach-transactions.ts`

- **Lines 124, 138, 148**: Status handling with "completed" strings

#### `lib/types/search.ts`

- **Line 8**: Status type definition

#### `app/api/search/advanced/route.ts`

- **Lines 16, 186**: Status filtering logic

#### Additional Files with Status Issues:

- `components/results/search-results.tsx` - Lines 66, 118
- `components/v0/dashboard.tsx` - Lines 102, 109, 116, 124, 130
- `components/billing/TransactionDetailModal.tsx` - Lines 39, 60
- `app/billing/page.tsx` - Lines 178, 181
- `prisma/schema.prisma` - Line 219
- `scripts/seed-ach-transactions.ts` - Line 74
- `lib/search/unified-search.ts` - Line 94

## Problem Area 3: Pagination Control Issues

### Files with Pagination Problems:

#### `components/search/PaginationControls.tsx` (Primary pagination component)

- **Lines 27-28**: `totalPages` and `currentPage` variables
- **Lines 35, 37, 42, 47-48, 51, 57, 61**: Page calculation logic
- **Lines 69, 78, 90-91**: Page change handlers
- **Lines 130, 138-139, 151, 167-168, 176-177**: Navigation button implementations

#### `components/billing/TransactionTable.tsx` (Duplicate pagination)

- **Lines 88, 114-115**: `currentPage` and pagination state
- **Lines 274, 284-285, 291, 293, 295, 297-298, 300, 306**: Pagination logic
- **Lines 319-320**: Page navigation
- **Lines 288, 322**: "Previous/Next" button text

#### `components/v0/ui/pagination.tsx`

- **Lines 62, 73, 76, 78, 88, 92, 115-116**: UI pagination component with Previous/Next

#### `app/billing/page.tsx`

- **Lines 19, 52-53, 316, 319, 325-326, 333-334**: Page state management
- **Lines 328, 336**: Navigation button usage

#### `hooks/use-ach-transactions.ts`

- **Lines 30-31, 57, 118, 191-192**: Pagination state and logic

#### Backend API Files with Pagination:

- `lib/search/advanced-search.ts` - Lines 62, 65
- `app/api/ach/transactions/route.ts` - Line 150
- `app/api/search/advanced/route.ts` - Lines 103, 106
- `lib/types/search.ts` - Lines 95, 98

#### Additional Pagination References:

- `components/v0/ui/carousel.tsx` - Lines 28, 30, 69, 77, 84-85, 95, 98, 132, 134, 197, 220, 224, 226, 230, 244-245, 249, 253, 260-261

## Summary of Issues by Priority

### High Priority (Core Business Logic):

1. **Date Presets**: 11 files with hardcoded date calculation logic
2. **Status Strings**: 15+ files with inconsistent status handling
3. **Pagination**: 8 files with duplicate/inconsistent pagination implementations

### Medium Priority (Tests & Documentation):

- Test files referencing the above logic
- Documentation files with outdated examples

### Low Priority (Configuration & Build):

- Package.json references
- Build script implications

## Recommended Fix Order:

1. **Start with Type Definitions** (`lib/types/search.ts`)
2. **Fix Core Components** (DateRangeFilter, BillingFilters, PaginationControls)
3. **Update API Routes** (All backend pagination and status handling)
4. **Fix Duplicate Components** (TransactionTable pagination)
5. **Update Tests** (All test files referencing the fixed logic)
6. **Verify Integration** (End-to-end testing)

## Files Requiring Immediate Attention:

### Date Logic:

- `components/search/filters/DateRangeFilter.tsx` (22 issues)
- `components/billing/BillingFilters.tsx` (15 issues)

### Status Logic:

- `lib/api/dwolla/ach-sync.ts` (7 issues)
- `components/billing/TransactionTable.tsx` (3 issues)

### Pagination Logic:

- `components/search/PaginationControls.tsx` (15 issues)
- `components/billing/TransactionTable.tsx` (12 issues)
- `app/billing/page.tsx` (8 issues)

This audit provides the complete inventory needed to systematically address all three problem areas across the codebase.
