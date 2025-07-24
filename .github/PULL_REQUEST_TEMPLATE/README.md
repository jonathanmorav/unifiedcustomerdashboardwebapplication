# Pull Request Templates

This directory contains specialized pull request templates for different types of changes. Using the appropriate template helps ensure code quality and prevents common issues.

## How to Use Templates

When creating a pull request, GitHub will show the default template. To use a specific template, append the template name to your PR URL:

```
https://github.com/your-org/unified-customer-dashboard/compare/main...your-branch?template=template-name.md
```

## Available Templates

### 1. Default Template
**File**: `../.github/pull_request_template.md`
**Use for**: General changes, refactoring, documentation updates

The default template includes comprehensive checklists covering:
- Security and best practices (Date mutation and pagination checks)
- Testing requirements
- Documentation updates
- Accessibility compliance

### 2. Date Feature Template
**File**: `date-feature.md`
**Use for**: Any changes involving date handling, filtering, or calculations

**Special Focus**:
- ⚠️ **Date Mutation Prevention**: Ensures no Date objects are mutated
- Immutable date patterns validation
- Edge case testing (leap years, timezones)
- Date-specific accessibility checks

### 3. Pagination Feature Template
**File**: `pagination-feature.md`
**Use for**: Changes to pagination logic, components, or controls

**Special Focus**:
- ⚠️ **Duplication Prevention**: Ensures existing pagination components are reused
- Component reusability validation
- Performance optimization checks
- Pagination-specific testing requirements

### 4. Bug Fix Template
**File**: `bug-fix.md`
**Use for**: Fixing bugs, issues, or defects

**Special Focus**:
- Root cause analysis (especially for Date mutations and pagination duplication)
- Regression testing requirements
- Common bug pattern checks
- Fix verification steps

## Common Issues to Avoid

### 🚫 Date Mutations
**Problem**: Directly modifying Date objects causes unexpected behavior
```typescript
// ❌ DON'T DO THIS
const date = new Date()
date.setDate(date.getDate() + 1)

// ✅ DO THIS INSTEAD
import { addDays } from 'date-fns'
const tomorrow = addDays(new Date(), 1)
```

### 🚫 Pagination Duplication
**Problem**: Creating new pagination logic when existing components exist
```typescript
// ❌ DON'T CREATE NEW PAGINATION
const MyNewPagination = () => { /* custom pagination logic */ }

// ✅ USE EXISTING COMPONENTS
import { PaginationControls } from '@/components/search/PaginationControls'
```

### 🚫 Status Inconsistency
**Problem**: Using old "completed" status instead of "processed"
```typescript
// ❌ OLD STATUS
status === 'completed'

// ✅ NEW STATUS
status === 'processed'
```

## Template Selection Guide

| Change Type | Recommended Template | Key Checks |
|-------------|---------------------|------------|
| Date filtering, date pickers, date calculations | `date-feature.md` | Date mutation prevention |
| Pagination components, page controls | `pagination-feature.md` | Duplication prevention |
| Bug fixes, issue resolution | `bug-fix.md` | Root cause analysis |
| General features, refactoring | Default template | All security checks |

## Checklist Summary

All templates include these critical reminders:

1. **🚫 Never mutate Date objects** - Always create new instances
2. **🔄 Reuse pagination components** - Don't duplicate existing logic
3. **✅ Use "processed" status** - Not "completed"
4. **♿ Maintain accessibility** - WCAG 2.1 AA compliance
5. **🧪 Add comprehensive tests** - Prevent regressions

## Questions?

If you're unsure which template to use or have questions about the requirements, please:
1. Ask in the team Slack channel
2. Tag reviewers in your PR for guidance
3. Refer to the codebase documentation in `/docs`

Remember: These templates are designed to help prevent the most common issues we've encountered. Taking a few extra minutes to use the right template can save hours of debugging later!
