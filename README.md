# Cakewalk Benefits - Unified Customer Dashboard

<div align="center">
  
  An enterprise-grade customer data management platform that consolidates customer information from HubSpot CRM and Dwolla payment systems.
  
  [![Next.js](https://img.shields.io/badge/Next.js-14.0-black)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC)](https://tailwindcss.com/)
  [![WCAG 2.1 AA](https://img.shields.io/badge/WCAG_2.1_AA-compliant-green)](https://www.w3.org/WAI/WCAG21/quickref/)
  [![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)
</div>

## 📋 Overview

The Unified Customer Dashboard provides support teams with a single interface to search and manage customer data, reducing task completion time from 8-10 minutes to 2-3 minutes by eliminating context switching between multiple systems.

> **⚠️ Breaking Change Notice**: Version 0.2.0 introduces a breaking change where transaction status "completed" has been renamed to "processed" for consistency across all data sources. Please update any external integrations accordingly. See [CHANGELOG.md](CHANGELOG.md) for details.

## ✨ Key Features

### Core Functionality

- **🔍 Unified Search**: Search across HubSpot and Dwolla simultaneously
- **⚡ Smart Detection**: Automatically identifies email, name, business name, or customer IDs
- **🚀 Fast Response**: Parallel API execution ensures < 3 second response times
- **📊 Consolidated View**: All customer data in one intuitive interface

### Security & Compliance

- **🔐 Google OAuth**: Secure authentication with session management
- **🛡️ Enterprise Security**: CSRF protection, rate limiting, and audit logging
- **♿ WCAG 2.1 AA**: Full accessibility compliance
- **🔒 Data Protection**: Field-level encryption for PII (planned)

### User Experience

- **🎨 Modern Design**: Cakewalk Benefits design system
- **🌓 Dark Mode**: Automatic theme switching
- **📱 Responsive**: Mobile-first design approach
- **⌨️ Keyboard Navigation**: Full keyboard accessibility

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Google OAuth credentials
- Docker (optional)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/cakewalk-benefits/unified-customer-dashboard.git
   cd unified-customer-dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up database**

   ```bash
   # Using Docker
   docker-compose -f docker-compose.dev.yml up -d postgres

   # Run migrations
   npm run setup:db
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Demo Mode

Try the application with mock data:

```bash
npm run setup:demo
npm run dev
```

## 🏗️ Architecture

### Tech Stack

| Layer          | Technologies                                   |
| -------------- | ---------------------------------------------- |
| **Frontend**   | Next.js 14, React 19, TypeScript, Tailwind CSS |
| **Backend**    | Next.js API Routes, Prisma ORM                 |
| **Database**   | PostgreSQL with connection pooling             |
| **Auth**       | NextAuth.js with Google OAuth                  |
| **Security**   | CSRF tokens, rate limiting, helmet.js          |
| **Testing**    | Jest, React Testing Library, Playwright        |
| **Monitoring** | Custom metrics, health checks                  |

### Project Structure

```
unified-customer-dashboard/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   ├── dashboard/         # Dashboard UI
│   └── auth/              # Authentication
├── components/            # React components
│   ├── ui/               # Design system components
│   ├── search/           # Search functionality
│   └── errors/           # Error boundaries
├── lib/                   # Core libraries
│   ├── auth/             # Authentication logic
│   ├── search/           # Search implementation
│   ├── security/         # Security middleware
│   └── errors/           # Error handling
├── prisma/               # Database schema
├── public/               # Static assets
├── docs/                 # Documentation
└── __tests__/            # Test suites
```

## 🔧 Configuration

### Required Environment Variables

| Variable               | Description                  |
| ---------------------- | ---------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string |
| `NEXTAUTH_URL`         | Application URL              |
| `NEXTAUTH_SECRET`      | 32+ character secret         |
| `GOOGLE_CLIENT_ID`     | OAuth client ID              |
| `GOOGLE_CLIENT_SECRET` | OAuth secret                 |

### Optional API Configuration

| Variable               | Description      | Default   |
| ---------------------- | ---------------- | --------- |
| `HUBSPOT_API_KEY`      | HubSpot API key  | Demo mode |
| `DWOLLA_CLIENT_ID`     | Dwolla client ID | Demo mode |
| `DWOLLA_CLIENT_SECRET` | Dwolla secret    | Demo mode |
| `DEMO_MODE`            | Enable mock data | `false`   |

## 📝 Development

### Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm test            # Run all tests
npm run test:watch  # Watch mode
npm run test:coverage # Coverage report

# Code Quality
npm run lint        # ESLint
npm run format      # Prettier
npm run typecheck   # TypeScript

# Database
npm run setup:db    # Run migrations
npm run db:studio   # Prisma Studio
```

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Automatic formatting
- **Commits**: Conventional commits

## 🚢 Deployment

### Docker

```bash
# Production build
docker build -t cakewalk-dashboard .
docker run -p 3000:3000 cakewalk-dashboard

# Docker Compose
docker-compose up --build
```

### Vercel

```bash
vercel --prod
```

### Manual

```bash
npm run build
npm start
```

## 🔒 Security Features

- **Authentication**: Google OAuth with JWT sessions
- **Authorization**: Role-based access control
- **API Security**: Rate limiting, CORS, CSP headers
- **Data Protection**: Input validation, SQL injection prevention
- **Audit Trail**: Comprehensive logging of sensitive operations

## 📊 Performance

- **Response Time**: < 3 seconds for search operations
- **Lighthouse Score**: 95+ across all metrics
- **Bundle Size**: Optimized with code splitting
- **Caching**: Redis integration (planned)

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Accessibility tests
npm run test:a11y

# Security tests
npm run test:security
```

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Overview](docs/SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

Proprietary software owned by Cakewalk Benefits. All rights reserved.

## 🆘 Support

- Email: support@cakewalkbenefits.com
- Documentation: [docs.cakewalkbenefits.com](https://docs.cakewalkbenefits.com)
- Issues: [GitHub Issues](https://github.com/cakewalk-benefits/unified-customer-dashboard/issues)

---

Built with ❤️ by the Cakewalk Benefits team
