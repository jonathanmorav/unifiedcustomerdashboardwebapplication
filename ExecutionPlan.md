    # Unified Customer Dashboard - Execution Plan

    ## 🎯 Objective
    Build an enterprise-grade web application at the highest quality and maximum velocity using Cursor and Claude Code.

    ## 📋 Pre-Development Setup

    ### Credentials & Access Preparation
    ```
    Create "credentials.txt" with:
    - HubSpot API Key
    - Dwolla Client ID & Secret  
    - Google OAuth Client ID & Secret
    - Authorized email addresses list
    - Hosting account details (Vercel/Railway)
    ```

    ### Project Initialization
    ```
    1. Create folder "unified-customer-dashboard"
    2. Open in Cursor
    3. Create .env.example with all required variables
    4. Set up git repository
    ```

    ## 🏗️ Phase 1: Foundation Architecture

    ### Project Setup
    **Prompt for Claude Code:**
    ```
    Create a Next.js 14 app with:
    1. App router structure with TypeScript
    2. Tailwind CSS v4 following provided design guidelines
    3. shadcn/ui with new-york style
    4. Proper folder structure: /app, /components, /lib, /api
    5. Implement 8pt grid system and typography constraints
    6. Set up ESLint and Prettier for code quality
    ```

    ### Authentication System
    **Prompt for Claude Code:**
    ```
    Implement enterprise-grade Google OAuth:
    1. NextAuth.js with invite-only access control
    2. Secure session management (30-minute timeout)
    3. Protected routes with automatic redirects
    4. Authorized emails validation
    5. Comprehensive audit logging
    6. Security headers and CORS configuration
    ```

    ### Database & Core Layout
    **Prompt for Claude Code:**
    ```
    Create database layer and main UI structure:
    1. PostgreSQL schema for sessions and search history
    2. Dashboard layout with header components
    3. Advanced search bar with multi-parameter support
    4. Split-panel responsive layout (HubSpot/Dwolla)
    5. Dark mode infrastructure
    6. Loading states and error boundaries
    Apply 60/30/10 color rule and 8pt grid throughout.
    ```

    ## 🔌 Phase 2: API Integration Layer

    ### HubSpot Service Module
    **Prompt for Claude Code:**
    ```
    Build comprehensive HubSpot integration:
    1. Robust API client with retry logic
    2. Company search by email, name, ID
    3. Summary of Benefits custom object handling
    4. Support for 1-30 policies per SOB
    5. PDF document reference management
    6. Complete TypeScript type safety
    7. Efficient error handling and logging
    Reference PRD section 5.3 for exact requirements.
    ```

    ### Dwolla Service Module
    **Prompt for Claude Code:**
    ```
    Build secure Dwolla integration:
    1. OAuth2 client implementation
    2. Customer search functionality
    3. Funding source data with PCI compliance
    4. Transfer history with pagination
    5. Notifications retrieval system
    6. Account number masking logic
    7. Comprehensive error states
    Implement all fields from PRD section 5.3.
    ```

    ### Unified Search Engine
    **Prompt for Claude Code:**
    ```
    Create intelligent search system:
    1. Multi-parameter detection and routing
    2. Parallel API orchestration
    3. Data correlation algorithms
    4. Result ranking and relevance
    5. Search history with PostgreSQL
    6. Real-time validation and suggestions
    7. Performance optimization (sub-3s target)
    ```

    ## 🎨 Phase 3: User Interface Implementation

    ### HubSpot Data Display
    **Prompt for Claude Code:**
    ```
    Design HubSpot information panel:
    1. Company information cards
    2. Dynamic SOB display (1-30 policies)
    3. Collapsible sections with smooth animations
    4. PDF preview/download integration
    5. Data visualization for benefits
    6. Status indicators and badges
    Strictly follow typography rules: 4 sizes, 2 weights.
    ```

    ### Dwolla Data Display
    **Prompt for Claude Code:**
    ```
    Design Dwolla information panel:
    1. Customer profile with verification status
    2. Secure funding source display
    3. Interactive transfer history table
    4. Notification timeline view
    5. Account status visualizations
    6. Empty states and error handling
    Maintain visual consistency with HubSpot panel.
    ```

    ### Export System
    **Prompt for Claude Code:**
    ```
    Implement professional PDF export:
    1. One-click export functionality
    2. Custom PDF template design
    3. Complete data inclusion
    4. Metadata (timestamp, user, search params)
    5. Progress indicators
    6. Error recovery mechanisms
    Ensure enterprise-quality output.
    ```

    ## ⚡ Phase 4: Performance & Polish

    ### Dark Mode & Accessibility
    **Prompt for Claude Code:**
    ```
    Implement comprehensive theming:
    1. System preference detection
    2. Smooth theme transitions
    3. Persistent user preferences
    4. WCAG 2.1 AA compliance
    5. Keyboard navigation
    6. Screen reader optimization
    Use shadcn/ui theming patterns.
    ```

    ### Performance Optimization
    **Prompt for Claude Code:**
    ```
    Maximize application speed:
    1. React Query implementation
    2. Strategic caching layers
    3. Code splitting and lazy loading
    4. API call optimization
    3. Bundle size minimization
    6. Core Web Vitals optimization
    Target: All operations under 3 seconds.
    ```

    ### Security Hardening
    **Prompt for Claude Code:**
    ```
    Implement enterprise security:
    1. API rate limiting strategies
    2. Input sanitization layers
    3. XSS and CSRF protection
    4. Secure session management
    5. Comprehensive audit trails
    6. Penetration test readiness
    This handles sensitive financial data.
    ```

    ## 🚀 Phase 5: Production Readiness

    ### Quality Assurance
    **Prompt for Claude Code:**
    ```
    Create comprehensive testing:
    1. Unit tests for critical functions
    2. Integration tests for API flows
    3. E2E tests for user journeys
    4. Performance benchmarking
    5. Security vulnerability scanning
    6. Cross-browser compatibility
    Achieve 90%+ test coverage.
    ```

    ### Deployment Pipeline
    **Prompt for Claude Code:**
    ```
    Set up production deployment:
    1. CI/CD pipeline configuration
    2. Environment management
    3. Database migration system
    4. Monitoring and alerting
    5. Backup strategies
    6. Rollback procedures
    Create foolproof deployment process.
    ```

    ### Documentation Suite
    **Prompt for Claude Code:**
    ```
    Generate complete documentation:
    1. User guide with visual tutorials
    2. Admin manual for access control
    3. API integration reference
    4. Troubleshooting playbook
    5. Security protocols
    6. Maintenance procedures
    Make it accessible for all skill levels.
    ```

    ## 🎯 Critical Success Factors

    ### Code Quality Standards
    - **Architecture**: Follow provided code optimization principles
    - **Patterns**: Extend existing code, never duplicate
    - **Design**: Strict adherence to design system guidelines
    - **Security**: Enterprise-grade at every level
    - **Performance**: Sub-3 second response times

    ### Key Prompting Strategies for Claude Code
    1. Always reference specific PRD sections
    2. Emphasize security for sensitive data handling
    3. Enforce design system constraints
    4. Request comprehensive error handling
    5. Demand TypeScript type safety
    6. Require accessibility compliance

    ### Quality Checkpoints

    #### Foundation Complete
    - [ ] Authentication working flawlessly
    - [ ] Database schema optimized
    - [ ] UI framework properly configured
    - [ ] Security baseline established

    #### Integration Complete
    - [ ] All API endpoints functional
    - [ ] Data correlation working
    - [ ] Error handling comprehensive
    - [ ] Performance targets met

    #### Feature Complete
    - [ ] All PRD requirements implemented
    - [ ] Export functionality polished
    - [ ] Dark mode fully functional
    - [ ] Search performing optimally

    #### Production Ready
    - [ ] Security audit passed
    - [ ] Performance benchmarks exceeded
    - [ ] Documentation comprehensive
    - [ ] Deployment automated
    - [ ] Monitoring active

    ## 📊 Success Metrics

    ### Technical Excellence
    - Response time: <3 seconds for all operations
    - Uptime: 99.9% availability
    - Error rate: <1% of all requests
    - Test coverage: >90%

    ### Business Impact
    - Task completion: 70% time reduction
    - User adoption: 100% within first week
    - Data accuracy: Zero discrepancies
    - User satisfaction: >4.5/5 rating

    ## 🔧 Continuous Improvement

    ### Post-Launch Optimization
    - Performance monitoring and tuning
    - User feedback integration
    - Security updates and patches
    - Feature enhancement pipeline
    - Scale readiness assessment

    ### Long-term Maintenance
    - Regular dependency updates
    - Security vulnerability scanning
    - Performance regression testing
    - Documentation updates
    - Team knowledge transfer

    ---

    **Remember**: Every prompt to Claude Code should emphasize quality, security, and adherence to our design system. We're building enterprise software that handles sensitive financial data - there's no room for shortcuts.