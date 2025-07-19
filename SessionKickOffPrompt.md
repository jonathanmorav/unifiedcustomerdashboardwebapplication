You are building an enterprise-grade Unified Customer Dashboard web application. Before proceeding with any tasks, review and strictly adhere to these foundational documents:

## 🎯 PROJECT CONTEXT

You're developing a secure web application that consolidates customer data from HubSpot and Dwolla for support teams. This is sensitive financial data requiring enterprise-grade security and performance.

## 📚 REQUIRED READING

Please review these critical project documents:

1. **Product Requirements Document (PRD)** - Contains all functional and technical requirements
2. **Unified Customer Dashboard - Execution Plan** - Step-by-step implementation guide
3. **Cakewalk Design System Guidelines** - UI/UX standards and component patterns
4. **Execution Plan MD - All past and planned execution tasks 
5. **Claude.MD file 
6. *project_status.md file

## 🏗️ TECHNICAL STACK

- Frontend: Next.js 14+ with App Router
- UI: shadcn/ui with Tailwind CSS v4
- Auth: NextAuth.js with Google OAuth
- Database: PostgreSQL
- APIs: HubSpot & Dwolla
- Hosting: Vercel/Railway

## 🎨 DESIGN CONSTRAINTS

From Cakewalk Design System:

- Typography: ONLY 4 font sizes, 2 weights (Semibold, Regular)
- Spacing: 8pt grid system (all values divisible by 8 or 4)
- Colors: 60/30/10 distribution rule
- Component prefix: Use `cakewalk-` for all custom classes

## 🔐 SECURITY REQUIREMENTS

- Enterprise-grade security for sensitive financial data
- No local data storage
- All API communications encrypted
- Session timeout: 30 minutes
- Comprehensive audit logging
- Input sanitization and XSS protection

## ⚡ PERFORMANCE TARGETS

- All operations < 3 seconds
- 99.9% uptime
- Error rate < 1%
- Test coverage > 90%

## 💡 DEVELOPMENT PRINCIPLES

From "Building with Extended Thinking":

- EXTEND existing code, never duplicate
- Use established patterns before creating new ones
- Optimize for readability and maintainability
- Follow the architectural decision flowchart
- Implement comprehensive error handling

## ✅ QUALITY CHECKLIST

Before implementing any feature:

- [ ] Reviewed relevant PRD section
- [ ] Following Cakewalk design system
- [ ] Adhering to 8pt grid and typography rules
- [ ] Implementing proper security measures
- [ ] Writing TypeScript with full type safety
- [ ] Including comprehensive error handling
- [ ] Following accessibility guidelines (WCAG 2.1 AA)
- [ ] Optimizing for sub-3 second performance

## 🎯 SUCCESS METRICS

- Task completion time: 70% reduction (from 8-10 min to 2-3 min)
- User adoption: 100% within first week
- Zero security vulnerabilities
- Professional, polished UI following Cakewalk standards

Remember: This is enterprise software handling sensitive financial data. There's no room for shortcuts. Every decision should prioritize security, performance, and adherence to our design system.
