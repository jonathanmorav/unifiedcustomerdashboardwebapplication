# HubSpot Active Lists Integration

## Overview

This feature adds HubSpot Active Lists functionality to the Unified Customer Dashboard, allowing users to view and analyze list memberships and historical trends for companies.

## Features

### 1. List Membership Display
- View all active lists that a company's contacts belong to
- Distinguish between DYNAMIC (auto-updating) and STATIC lists
- See membership timestamps and list metadata

### 2. List Analytics Dashboard
- Dedicated "List Analytics" tab in the main dashboard
- Statistics cards showing total lists, dynamic lists, and static lists
- Historical trend charts for member counts
- Responsive grid layout for list membership cards

### 3. Trend Visualization
- Area charts showing member count trends over time
- Daily, weekly, and monthly view options
- Percentage change indicators
- Color-coded trend indicators (positive/negative)

## API Integration

### Required HubSpot Scopes
```
crm.objects.companies.read
crm.objects.contacts.read
crm.lists.read
crm.objects.custom.read
```

### New API Methods

#### HubSpot Client (`lib/api/hubspot/client.ts`)
- `getAllLists()` - Get all lists with pagination
- `getListById()` - Get specific list details
- `getContactListMemberships()` - Get lists for a contact
- `getCompanyContacts()` - Get contacts for a company
- `getCompanyListMemberships()` - Aggregate lists for all company contacts

#### HubSpot Service (`lib/api/hubspot/service.ts`)
- Updated `searchCustomer()` to include list memberships
- Updated `formatCustomerData()` to format list data

## UI Components

### New Components
1. **ListAnalyticsDashboard** (`components/lists/list-analytics-dashboard.tsx`)
   - Main dashboard view for list analytics
   - Handles loading states and empty states
   - Integrates with search context

2. **ListMembershipCard** (`components/lists/list-membership-card.tsx`)
   - Individual card for displaying list details
   - Shows list name, type, ID, and membership date
   - Visual indicators for list type

3. **ListTrendChart** (`components/lists/list-trend-chart.tsx`)
   - Recharts-based area chart for trends
   - Customized to match Cakewalk design system
   - Responsive and interactive tooltips

4. **ListStatsCard** (`components/lists/list-stats-card.tsx`)
   - Statistics display card
   - Shows metrics with optional trend indicators
   - Icon support for visual clarity

## Design System Compliance

All components follow the Cakewalk design system:
- Colors: Primary blue (#005dfe), success green (#15cb94)
- Typography: DM Sans font family with defined size scales
- Spacing: 8px grid system
- Shadows: cakewalk-medium, cakewalk-light
- Border radius: 16px for cards, 8px for badges
- Responsive breakpoints: mobile-first approach

## Usage

1. Search for a company using the search bar
2. Click on the "List Analytics" tab
3. View list memberships and trends
4. Switch between daily/weekly/monthly trend views

## Future Enhancements

1. **Historical Data Storage**
   - Database schema for storing trend data
   - Background jobs to collect daily metrics
   - Data retention policies

2. **Advanced Analytics**
   - List growth rate calculations
   - Engagement metrics
   - List comparison tools

3. **Export Functionality**
   - CSV export for list data
   - PDF reports with charts
   - Scheduled email reports

4. **Performance Optimization**
   - Redis caching for list data
   - Pagination for large list counts
   - Lazy loading for trend data

## Testing

Run the test suite:
```bash
npm test -- __tests__/unit/lib/api/hubspot/lists.test.ts
```

## Configuration

Update your `.env` file with the required HubSpot API key and ensure it has the necessary scopes:
```
HUBSPOT_API_KEY=your-api-key-with-list-scopes
```