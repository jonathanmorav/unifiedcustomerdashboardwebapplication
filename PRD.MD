# Product Requirements Document: Unified Customer Dashboard (Web Application)

## 1. Executive Summary

A secure, enterprise-grade web application that provides support teams with a unified view of customer data from HubSpot and Dwolla. The application eliminates context switching and reduces task completion time by consolidating critical customer information into a single, secure interface with robust search capabilities.

## 2. Problem Statement

Support and technical teams currently waste significant time switching between HubSpot and Dwolla to gather customer information, resulting in:

- Extended task completion times (current average: 8-10 minutes per lookup)
- Risk of missing critical payment or benefits information
- Inconsistent data viewing across team members
- Difficulty tracking customer payment setup and benefits status

## 3. Solution Overview

A modern web application that:

- Provides secure OAuth login with Google (invite-only)
- Accepts multiple search parameters (email, name, business name, Dwolla ID)
- Fetches real-time data from HubSpot and Dwolla APIs
- Displays consolidated customer information with PDF export
- Maintains enterprise-grade security with no local data retention
- Supports dark mode and recent searches

## 4. Technical Architecture

### 4.1 Technology Stack

- **Frontend:** Next.js 14+ with App Router
- **UI Framework:** shadcn/ui with Tailwind CSS v4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (for user sessions, recent searches)
- **Authentication:** NextAuth.js with Google OAuth
- **Hosting:** Vercel or Railway
- **State Management:** React Query for API data
- **PDF Generation:** React PDF or similar

### 4.2 Design System

Following the provided design guidelines:

- **Typography:** 4 font sizes, 2 weights (Semibold, Regular)
- **Spacing:** 8pt grid system (all values divisible by 8 or 4)
- **Color Distribution:** 60/30/10 rule
- **Component Architecture:** shadcn/ui with CVA for variants

## 5. Functional Requirements

### 5.1 Authentication & Access Control

**Google OAuth Integration:**
- Login with Google accounts
- Invite-only access list maintained by admin
- Session management with 30-minute timeout
- Secure token storage

**User Roles:**
- Support Team (3-4 users)
- Technical Support (2-3 users)
- Admin (manage invite list)

### 5.2 Search Functionality

**Multi-parameter Search:**
- Email address (primary)
- First name + Last name
- Business name
- Dwolla ID

**Search Features:**
- Real-time validation
- Recent searches (last 10)
- Auto-trim whitespace
- Case-insensitive matching

### 5.3 Data Display Requirements

#### HubSpot Data Panel

**Company Information:**
- Company ID
- Company Name
- Owner Email Address

**Summary of Benefits (Custom Object):**
- Amount to Draft
- Fee Amount
- All Associated Policies (1-30 policies with full details)
- Link to PDF SOB document
- Monthly invoice relationship

#### Dwolla Data Panel

**Customer Information:**
- Dwolla ID
- Email
- Name
- Status

**Funding Source:**
- Account Type
- Funding Source ID
- Account Number (masked - last 4 digits only)
- Routing Number
- Verification Status (verified/unverified)

**Transfer History:**
- Last 5 transfers
- Date, Amount, Status, Type

**Notifications:**
- Complete list of customer notifications

### 5.4 User Interface Requirements

**Layout:**
- Clean, modern design following shadcn/ui patterns
- Split view (HubSpot left, Dwolla right)
- Responsive for different screen sizes
- Dark mode toggle

**Visual Features:**
- Loading states with skeletons
- Error states with retry options
- Status badges for quick scanning
- Highlight data matches between systems

### 5.5 Export Functionality

**PDF Export:**
- Combined view of all customer data
- Professional formatting
- Include timestamp and user who generated
- Company branding

## 6. Non-Functional Requirements

### 6.1 Performance

- Search results within 3 seconds
- Smooth transitions and animations
- Optimized API calls (parallel when possible)
- Efficient data caching strategy

### 6.2 Security

- Enterprise-grade security standards
- All data encrypted in transit (HTTPS)
- No sensitive data stored locally
- API keys secured in environment variables
- Audit trail for all searches
- CORS properly configured
- Rate limiting on API endpoints

### 6.3 Scalability

- Support 10 concurrent users
- Handle 200+ searches per day
- Efficient database queries
- CDN for static assets

### 6.4 Reliability

- 99.9% uptime target
- Graceful error handling
- Automatic retry logic
- Offline detection

## 7. Data Flow Architecture

### 1. User Authentication
- Google OAuth → NextAuth → Session Created

### 2. Search Flow
- User Input → Validation → Parallel API Calls
- HubSpot API → Company + SOB Data
- Dwolla API → Customer + Payment Data
- Results → Formatted Display

### 3. Data Linking Logic
- **Primary:** Email matching
- **Secondary:** Dwolla ID (stored in HubSpot)
- **Tertiary:** First + Last name matching

### 4. Session Management
- Recent searches stored in PostgreSQL
- Auto-logout after 30 minutes
- Secure session tokens

## 8. Success Metrics

**Primary KPI: Task completion time**
- **Baseline:** 8-10 minutes
- **Target:** 2-3 minutes (70% reduction)

**Secondary Metrics:**
- User adoption: 100% of team members
- Daily searches: 50+ average
- Error rate: <1%
- PDF exports: Track usage

## 9. Implementation Phases

### Phase 1: Foundation
- Project setup with Next.js
- Authentication with Google OAuth
- Basic UI with shadcn/ui
- Database schema

### Phase 2: Core Features
- Search interface
- API integrations (HubSpot + Dwolla)
- Data display panels
- Error handling

### Phase 3: Advanced Features
- PDF export
- Recent searches
- Dark mode
- Performance optimization

### Phase 4: Polish & Deploy
- Security audit
- Load testing
- Documentation
- Deployment