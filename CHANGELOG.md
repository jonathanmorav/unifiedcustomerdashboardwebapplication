# Changelog

All notable changes to the Unified Customer Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING CHANGE**: Transaction status "completed" has been renamed to "processed" across the entire application
  - Database migration updates all existing "completed" status records to "processed"
  - API responses now return "processed" instead of "completed"
  - UI components and filters updated to display "processed" status
  - Transaction sorting and filtering logic updated
  - Test cases updated to use new status values

### Added
- Comprehensive test coverage for status migration
- Enhanced transaction status validation
- Improved status badge styling for better accessibility

### Fixed
- Transaction status consistency across all data sources
- Status filter functionality with new processed status
- Status sorting logic for proper chronological ordering

## [0.1.0] - 2024-01-XX

### Added
- Initial release of Unified Customer Dashboard
- HubSpot and Dwolla API integration
- Unified search functionality
- Google OAuth authentication
- Responsive UI with dark mode support
- Comprehensive security features (CSRF, rate limiting)
- Accessibility compliance (WCAG 2.1 AA)
- Comprehensive test suite
- CI/CD pipeline
