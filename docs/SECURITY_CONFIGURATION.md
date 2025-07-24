# Security Configuration Reference

## Environment Variables

### Required Security Environment Variables

```bash
# Authentication
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Database (with SSL)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Authorized Users (comma-separated)
AUTHORIZED_EMAILS=admin@company.com,support@company.com

# API Keys (for external services)
HUBSPOT_API_KEY=your-hubspot-key
DWOLLA_CLIENT_ID=your-dwolla-client-id
DWOLLA_CLIENT_SECRET=your-dwolla-client-secret

# Security Settings
SESSION_TIMEOUT_MINUTES=30
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
MFA_REQUIRED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info
AUDIT_LOG_RETENTION_DAYS=730
```

### Optional Security Environment Variables

```bash
# Advanced Security
CSRF_TOKEN_LENGTH=32
API_SIGNATURE_WINDOW_MINUTES=5
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_SPECIAL=true
PASSWORD_HISTORY_COUNT=5
SESSION_CONCURRENT_LIMIT=3

# IP Allowlisting (comma-separated)
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8

# Security Headers
CSP_REPORT_URI=https://yourdomain.com/api/csp-report
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_CSRF_PROTECTION=true
ENABLE_AUDIT_LOGGING=true
ENABLE_SESSION_MONITORING=true
```

## Security Configuration Files

### 1. Rate Limiting Configuration

```typescript
// config/rate-limits.ts
export const rateLimitConfigs = {
  global: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || "60"),
    standardHeaders: true,
    legacyHeaders: false,
  },

  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    skipSuccessfulRequests: true,
  },

  api: {
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.headers.get("x-api-key") || req.ip,
  },

  search: {
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many search requests, please try again later",
  },

  export: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: "Export limit exceeded",
  },
}
```

### 2. CORS Configuration

```typescript
// config/cors.ts
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.NEXTAUTH_URL,
      "https://app.company.com",
      "https://staging.company.com",
    ]

    // Allow requests with no origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-API-Key",
    "X-Request-ID",
    "X-Correlation-ID",
  ],
  exposedHeaders: [
    "X-Request-ID",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],
  maxAge: 86400, // 24 hours
}
```

### 3. Session Configuration

```typescript
// config/session.ts
export const sessionConfig = {
  secret: process.env.NEXTAUTH_SECRET!,

  session: {
    strategy: "database" as const,
    maxAge: parseInt(process.env.SESSION_TIMEOUT_MINUTES || "30") * 60,
    updateAge: 5 * 60, // Update session every 5 minutes
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },

  callbacks: {
    async session({ session, user }) {
      // Add security properties to session
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          lastLoginAt: user.lastLoginAt,
        },
      }
    },
  },
}
```

### 4. MFA Configuration

```typescript
// config/mfa.ts
export const mfaConfig = {
  // TOTP Configuration
  totp: {
    issuer: "Unified Customer Dashboard",
    algorithm: "SHA256",
    digits: 6,
    period: 30,
    window: 1, // Allow 1 period before/after
    secretLength: 32,
  },

  // Backup Codes
  backupCodes: {
    count: 10,
    length: 12, // XXXX-XXXX-XXXX format
    hashRounds: 10,
  },

  // Rate Limiting
  rateLimit: {
    maxAttempts: 3,
    windowMinutes: 15,
    lockoutMinutes: 15,
  },

  // Session Requirements
  session: {
    requireFreshAuth: true,
    freshAuthWindowMinutes: 15,
    requireForSensitiveOps: ["EXPORT_DATA", "VIEW_PAYMENT_INFO", "MODIFY_USER", "ACCESS_ADMIN"],
  },
}
```

### 5. Audit Log Configuration

```typescript
// config/audit.ts
export const auditConfig = {
  // What to log
  actions: {
    authentication: [
      "LOGIN_SUCCESS",
      "LOGIN_FAILURE",
      "LOGOUT",
      "MFA_ENABLED",
      "MFA_DISABLED",
      "PASSWORD_CHANGED",
    ],

    dataAccess: ["SEARCH_CUSTOMER", "VIEW_CUSTOMER", "EXPORT_DATA", "VIEW_PAYMENT_INFO"],

    administrative: [
      "USER_CREATED",
      "USER_MODIFIED",
      "USER_DELETED",
      "ROLE_CHANGED",
      "SETTINGS_CHANGED",
    ],

    security: ["ACCOUNT_LOCKED", "ACCOUNT_UNLOCKED", "SESSION_REVOKED", "SUSPICIOUS_ACTIVITY"],
  },

  // Retention policies
  retention: {
    securityLogs: 730, // 2 years
    accessLogs: 365, // 1 year
    adminLogs: 1095, // 3 years
    default: 90, // 3 months
  },

  // Storage
  storage: {
    type: "database", // or 's3', 'elasticsearch'
    encryption: true,
    compression: true,
  },

  // Alerting
  alerts: {
    channels: ["email", "slack"],
    rules: [
      {
        pattern: "ACCOUNT_LOCKED",
        threshold: 5,
        window: "1h",
        severity: "high",
      },
      {
        pattern: "LOGIN_FAILURE",
        threshold: 50,
        window: "15m",
        severity: "critical",
      },
    ],
  },
}
```

### 6. Security Headers Configuration

```typescript
// config/security-headers.ts
export const securityHeaders = {
  // Content Security Policy
  csp: {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'", // Required for Next.js
      "'unsafe-eval'", // Required for development
      "https://apis.google.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      "https://api.hubapi.com",
      "https://api.dwolla.com",
      process.env.NEXTAUTH_URL,
    ],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "report-uri": process.env.CSP_REPORT_URI,
  },

  // Other headers
  headers: {
    "Strict-Transport-Security": `max-age=${process.env.HSTS_MAX_AGE || 31536000}; includeSubDomains; preload`,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  },
}
```

## Database Security Configuration

### PostgreSQL Security Settings

```sql
-- Enable SSL
ALTER SYSTEM SET ssl = on;

-- Require SSL for all connections
ALTER DATABASE unified_customer_dashboard SET ssl_enforce = on;

-- Set connection limits
ALTER DATABASE unified_customer_dashboard CONNECTION LIMIT 100;

-- Create read-only user for reporting
CREATE USER reporting_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE unified_customer_dashboard TO reporting_user;
GRANT USAGE ON SCHEMA public TO reporting_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;

-- Enable row-level security for sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY user_isolation ON users
  FOR ALL TO application_user
  USING (id = current_setting('app.current_user_id')::uuid);
```

### Prisma Security Configuration

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fieldReference", "extendedWhereUnique"]
  binaryTargets = ["native"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
  connectionLimit = 10
  connectTimeout = 10
  pool_timeout = 10
}

// Secure model example
model User {
  id                String    @id @default(cuid())
  email             String    @unique @db.VarChar(255)
  password          String?   @db.VarChar(255) // Bcrypt hash

  // Security fields
  mfaEnabled        Boolean   @default(false)
  mfaSecret         String?   @db.Text // Encrypted
  failedLoginAttempts Int     @default(0)
  lockedUntil       DateTime?
  lastLoginAt       DateTime?
  lastLoginIp       String?   @db.Inet
  passwordChangedAt DateTime?

  // Indexes for performance
  @@index([email])
  @@index([lockedUntil])
  @@map("users")
}
```

## Monitoring Configuration

### Sentry Configuration

```typescript
// sentry.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Security settings
  beforeSend(event, hint) {
    // Remove sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies
    }
    if (event.user?.email) {
      event.user.email = "[REDACTED]"
    }

    // Filter out non-errors in production
    if (process.env.NODE_ENV === "production" && event.level !== "error") {
      return null
    }

    return event
  },

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Integrations
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
})
```

## Deployment Security Checklist

### Pre-Deployment

```bash
# Check for vulnerabilities
npm audit --production

# Update dependencies
npm update

# Check for secrets in code
git secrets --scan

# Run security tests
npm run test:security

# Verify environment variables
node scripts/check-env.js
```

### Production Configuration

```nginx
# nginx.conf security settings
server {
    listen 443 ssl http2;
    server_name app.company.com;

    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Regular Security Tasks

### Daily

- Monitor failed login attempts
- Review security alerts
- Check rate limit violations

### Weekly

- Run vulnerability scans
- Review audit logs
- Update security dashboard

### Monthly

- Rotate API keys
- Review user access
- Security metrics report

### Quarterly

- Security training
- Penetration testing
- Policy review

---

**Note**: Always test security configurations in a staging environment before applying to production.
