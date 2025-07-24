## Pull Request Checklist

### 📋 Description
<!-- Provide a brief description of the changes in this PR -->

### 🔄 Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement
- [ ] Security enhancement

### 🧪 Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed
- [ ] Accessibility tested (if UI changes)
- [ ] Cross-browser testing completed (if applicable)

### 📚 Documentation
- [ ] Code is self-documenting and/or well-commented
- [ ] README updated (if needed)
- [ ] CHANGELOG updated (if needed)
- [ ] API documentation updated (if applicable)

### ⚠️ Security & Best Practices Check
- [ ] **Date Objects**: Verified that no Date objects are being mutated directly
  - Use `new Date()` or date-fns functions instead of mutating existing dates
  - Check all date manipulation code for proper immutable patterns
- [ ] **Pagination**: Confirmed no duplicated pagination logic
  - Reuse existing pagination components/hooks instead of creating new ones
  - Verify pagination state management follows established patterns
- [ ] Input validation implemented for user inputs
- [ ] No sensitive data exposed in logs or client-side code
- [ ] CSRF tokens properly handled (if applicable)
- [ ] Rate limiting considered (if applicable)

### 🎯 Performance
- [ ] No unnecessary re-renders introduced
- [ ] Database queries optimized (if applicable)
- [ ] Bundle size impact considered
- [ ] Caching strategy implemented (if applicable)

### 🌐 Accessibility
- [ ] Keyboard navigation works correctly
- [ ] Screen reader compatibility verified
- [ ] Color contrast meets WCAG 2.1 AA standards
- [ ] Focus management implemented properly

### 📱 Responsive Design
- [ ] Mobile responsiveness tested
- [ ] Tablet view tested
- [ ] Desktop view tested
- [ ] Edge cases handled (very wide/narrow screens)

### 🔗 Related Issues
<!-- Link any related issues using "Closes #issue_number" or "Fixes #issue_number" -->

### 📸 Screenshots/GIFs
<!-- If applicable, add screenshots or GIFs to help explain your changes -->

### 🚀 Deployment Notes
<!-- Any special deployment instructions or environment variable changes -->

### 👀 Review Notes
<!-- Any specific areas you'd like reviewers to focus on -->

---

**⚠️ Important Reminders:**
1. **Never mutate Date objects directly** - Always create new instances
2. **Avoid duplicating pagination logic** - Use existing components/hooks
3. **Test status changes thoroughly** - Remember "completed" is now "processed"
4. **Verify accessibility** - All UI changes must maintain WCAG 2.1 AA compliance
