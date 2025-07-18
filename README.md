# Unified Customer Dashboard

An enterprise-grade web application that consolidates customer data from HubSpot and Dwolla, providing support teams with a unified interface to eliminate context switching and reduce task completion time from 8-10 minutes to 2-3 minutes.

![Next.js](https://img.shields.io/badge/Next.js-15.4.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Features

### Core Functionality
- **Unified Search**: Search across HubSpot and Dwolla simultaneously
- **Smart Search Detection**: Automatically detects email, name, business name, or Dwolla ID
- **Parallel API Execution**: Concurrent API calls for < 3 second response times
- **Real-time Results**: Split-panel view showing data from both platforms
- **Export Options**: Export results as CSV, JSON, or PDF
- **Search History**: Autocomplete suggestions from previous searches

### Technical Features
- **Enterprise Authentication**: Google OAuth with email whitelist
- **Type Safety**: Full TypeScript implementation
- **Responsive Design**: Mobile-first approach with Cakewalk Design System
- **PCI Compliance**: Account numbers masked for security
- **Rate Limiting**: Intelligent API rate limit handling
- **Error Recovery**: Automatic retry logic with exponential backoff
- **Performance Monitoring**: Real-time metrics display

## 📋 Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Google OAuth credentials
- HubSpot API access token
- Dwolla API credentials

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/unified-customer-dashboard.git
   cd unified-customer-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your credentials

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Environment Variables

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/unified_customer_dashboard

# Allowed Emails (comma-separated)
ALLOWED_EMAILS=user1@example.com,user2@example.com

# HubSpot API
HUBSPOT_ACCESS_TOKEN=your-hubspot-access-token
HUBSPOT_BASE_URL=https://api.hubapi.com

# Dwolla API
DWOLLA_CLIENT_ID=your-dwolla-client-id
DWOLLA_CLIENT_SECRET=your-dwolla-client-secret
DWOLLA_ENVIRONMENT=sandbox # or production
DWOLLA_BASE_URL=https://api-sandbox.dwolla.com
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### HubSpot Configuration

1. Access your HubSpot account
2. Navigate to Settings > Integrations > API Key
3. Generate a new API key or use existing
4. Ensure access to Companies, Custom Objects (Summary of Benefits, Policies)

### Dwolla Setup

1. Create a Dwolla Sandbox account for development
2. Generate API credentials
3. Configure OAuth application settings
4. Set appropriate scopes for customer and funding source access

## 🏗️ Architecture

```
unified-customer-dashboard/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   └── dashboard/         # Main application
├── components/            # React components
│   ├── search/           # Search-related components
│   ├── results/          # Result display components
│   └── ui/               # Shared UI components
├── lib/                   # Core business logic
│   ├── api/              # API clients and services
│   ├── search/           # Unified search engine
│   └── types/            # TypeScript definitions
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
└── prisma/               # Database schema
```

## 📱 Usage

### Basic Search
1. Sign in with your authorized Google account
2. Enter search term in the search bar
3. Select search type or use auto-detection
4. View results in split-panel layout

### Keyboard Shortcuts
- `Cmd/Ctrl + K`: Focus search input
- `Escape`: Clear search
- `Enter`: Execute search

### Export Data
1. Complete a search
2. Click the export button in the action bar
3. Choose format: CSV, JSON, or PDF
4. File downloads automatically

## 🧪 Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run format     # Format with Prettier
npm run typecheck  # TypeScript type checking
```

### Project Structure

- **API Layer**: Separate client and service layers for each integration
- **Type Safety**: Comprehensive TypeScript types for all API responses
- **Error Handling**: Centralized error handling with custom error classes
- **State Management**: React hooks for local state, no external state library needed

### Code Quality

- ESLint configuration for code quality
- Prettier for consistent formatting
- TypeScript strict mode enabled
- Git hooks for pre-commit checks (coming soon)

## 🐳 Docker Support (Coming Soon)

```bash
docker compose up -d
```

## 📊 Performance

- **Search Response**: < 3 seconds (target)
- **API Calls**: Parallel execution with Promise.allSettled
- **Caching**: Browser cache for search history (Redis coming soon)
- **Bundle Size**: Optimized with Next.js automatic code splitting

## 🔒 Security

- OAuth 2.0 authentication
- Email whitelist for access control
- Session management with 30-minute timeout
- Account numbers masked in UI
- Environment variables validation with Zod
- Security headers configured

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Authentication by [NextAuth.js](https://next-auth.js.org/)
- Database ORM by [Prisma](https://www.prisma.io/)

## 📞 Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/unified-customer-dashboard/issues) page.

---

Built with ❤️ for support teams everywhere
