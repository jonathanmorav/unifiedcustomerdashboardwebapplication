# Demo Data Guide

This guide explains the mock data available in demo mode and how to test the search functionality.

## 🚀 Quick Start

1. **Set up demo environment:**

   ```bash
   npm run setup:demo
   ```

2. **Start the database:**

   ```bash
   docker-compose up postgres -d
   ```

3. **Set up the database:**

   ```bash
   npm run setup:db
   ```

4. **Start the application:**

   ```bash
   npm run dev
   ```

5. **Visit the dashboard:**
   ```
   http://localhost:3000/dashboard
   ```

## 📊 Available Mock Data

### HubSpot Data

#### Company: Acme Corporation

- **Company ID:** 12345
- **Domain:** acme.com
- **Industry:** Technology
- **Location:** San Francisco, California
- **Status:** Customer
- **Created:** January 15, 2024

#### Summary of Benefits

- **Q1 2024 Benefits**
  - Amount to Draft: $5,000
  - Fee Amount: $150
  - Status: Active
  - Effective Date: January 1, 2024

#### Policies

1. **Health Insurance (POL-2024-001)**
   - Carrier: Blue Shield
   - Coverage Type: Health
   - Premium: $1,200/month
   - Status: Active

2. **Dental Insurance (POL-2024-002)**
   - Carrier: MetLife
   - Coverage Type: Dental
   - Premium: $300/month
   - Status: Active

#### Monthly Invoice

- **Invoice Number:** INV-2024-001
- **Amount:** $5,150
- **Due Date:** February 1, 2024
- **Status:** Paid
- **Payment Date:** January 28, 2024

### Dwolla Data

#### Customer: John Doe (Acme Corporation)

- **Customer ID:** cust_12345
- **Email:** john.doe@acme.com
- **Business Type:** Corporation
- **Status:** Verified
- **EIN:** 12-3456789
- **Website:** https://acme.com

#### Funding Source

- **Account Type:** Business Checking
- **Bank:** Wells Fargo
- **Balance:** $25,000
- **Status:** Verified

#### Transfers

1. **Transfer 001 (Processed)**
   - Amount: $5,150
   - Date: December 15, 2024
   - Type: Premium Collection
   - Invoice: INV-2024-001

2. **Transfer 002 (Pending)**
   - Amount: $3,200
   - Date: December 20, 2024
   - Type: Claim Reimbursement
   - Invoice: INV-2024-002

3. **Transfer 003 (Failed)**
   - Amount: $1,500
   - Date: December 18, 2024
   - Type: Refund
   - Invoice: INV-2024-003

### Additional Company: Tech Innovations Inc

- **Company ID:** 67890
- **Domain:** techinnovations.com
- **Industry:** Technology
- **Location:** New York
- **Status:** Customer

## 🔍 Sample Search Terms

### Company Searches

```
acme
acme corporation
acme corp
tech innovations
tech innovations inc
```

### Email Searches

```
john.doe@acme.com
contact@acme.com
contact@techinnovations.com
```

### Customer ID Searches

```
cust_12345
12345
67890
```

### Invoice Searches

```
invoice
INV-2024-001
INV-2024-002
INV-2024-003
```

### Policy Searches

```
policy
POL-2024-001
POL-2024-002
blue shield
metlife
```

### Transfer Searches

```
transfer
transfer_001
transfer_002
transfer_003
premium collection
claim reimbursement
```

### Status Searches

```
verified
active
pending
failed
customer
```

## 🎯 Search Types

### Auto Detection

The system automatically detects the search type based on the input:

- **Email addresses** → Email search
- **Customer IDs** → Customer ID search
- **Company names** → Company search
- **Everything else** → General search

### Manual Selection

You can also manually select search types:

- **All Sources** - Searches both HubSpot and Dwolla
- **HubSpot Only** - Searches only HubSpot data
- **Dwolla Only** - Searches only Dwolla data

## 📈 Expected Results

### Search for "acme"

**HubSpot Results:**

- Company: Acme Corporation
- Summary of Benefits
- Policies (Health & Dental)
- Monthly Invoice

**Dwolla Results:**

- Customer: John Doe (Acme Corporation)
- Funding Source
- Transfers (3 total)

### Search for "john.doe@acme.com"

**HubSpot Results:**

- Company: Acme Corporation (via email association)

**Dwolla Results:**

- Customer: John Doe
- All associated transfers and funding sources

### Search for "invoice"

**HubSpot Results:**

- Monthly Invoice: INV-2024-001

**Dwolla Results:**

- Transfers with invoice metadata

## 🔧 Advanced Search Features

### Filters

- **Type:** HubSpot, Dwolla, or Both
- **Status:** Active, Pending, Failed, Verified
- **Date Range:** Filter by creation/modification dates
- **Amount Range:** Filter by transaction amounts

### Sorting

- **Relevance Score** (default)
- **Date Created**
- **Date Modified**
- **Name/Title**
- **Amount**

### Pagination

- Results are paginated with 20 items per page
- Navigation controls for browsing through results

## 🎨 UI Features in Demo Mode

### Demo Banner

A yellow banner appears at the top indicating demo mode is active.

### Mock Data Indicators

- Search results show realistic data
- Response times are simulated
- Error states can be triggered for testing

### Export Features

- PDF export works with mock data
- Generates realistic-looking reports

## 🐛 Testing Error Scenarios

### Network Errors

Search for terms that trigger error responses:

```
error-test
network-error
timeout-test
```

### Empty Results

Search for non-existent data:

```
nonexistent-company
fake-email@example.com
invalid-id-99999
```

### Partial Results

Search for terms that return data from only one source:

```
hubspot-only
dwolla-only
```

## 📝 Notes

- **Demo mode** uses mock data only - no real API calls are made
- **Response times** are simulated to mimic real-world conditions
- **Data is static** - it doesn't change between searches
- **All features work** - including advanced search, filters, and exports
- **Authentication** is bypassed in demo mode for easier testing

## 🔄 Switching to Real Data

To switch from demo mode to real data:

1. **Get API credentials:**
   - HubSpot: Create a private app with required scopes
   - Dwolla: Sign up for a sandbox account
   - Google OAuth: Follow the setup guide in `docs/GOOGLE_OAUTH_SETUP.md`

2. **Update environment variables:**

   ```bash
   DEMO_MODE="false"
   HUBSPOT_API_KEY="your-real-api-key"
   DWOLLA_CLIENT_ID="your-real-client-id"
   DWOLLA_CLIENT_SECRET="your-real-client-secret"
   GOOGLE_CLIENT_ID="your-real-google-client-id"
   GOOGLE_CLIENT_SECRET="your-real-google-client-secret"
   ```

3. **Restart the application:**
   ```bash
   npm run dev
   ```

The application will automatically detect the real credentials and switch to live data mode.
