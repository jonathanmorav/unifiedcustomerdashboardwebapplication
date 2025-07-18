# Security Implementation Guide for Developers

## Quick Start Security Checklist

Before implementing any feature, ensure you:
- [ ] Understand the security requirements
- [ ] Review existing security patterns in the codebase
- [ ] Plan for input validation and output encoding
- [ ] Consider rate limiting needs
- [ ] Add appropriate audit logging
- [ ] Write security tests

## Common Security Patterns

### 1. Protecting API Routes

```typescript
// Always use the withAuth middleware for protected routes
import { withAuth } from '@/lib/auth/middleware'
import { auditLog } from '@/lib/security/audit'

export const GET = withAuth(
  async (request, { user }) => {
    // Log the access
    await auditLog({
      userId: user.id,
      action: 'VIEW_SENSITIVE_DATA',
      resource: 'customer',
      resourceId: customerId,
      metadata: { reason: 'support_request' }
    })

    // Your logic here
    return Response.json(data)
  },
  { 
    requiredRole: 'SUPPORT',
    requireMFA: true // For sensitive operations
  }
)
```

### 2. Input Validation

```typescript
import { z } from 'zod'

// Define your schema
const searchSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  dwollaId: z.string().regex(/^[a-f0-9-]{36}$/).optional(),
})

// Validate input
export async function POST(request: Request) {
  const body = await request.json()
  
  // Validate with Zod
  const validation = searchSchema.safeParse(body)
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid input' }, // Generic error message
      { status: 400 }
    )
  }

  const data = validation.data
  // Process validated data
}
```

### 3. Rate Limiting

```typescript
import { createEndpointRateLimiter } from '@/lib/security/middleware/rate-limit-middleware'

// Create custom rate limiter
const searchLimiter = createEndpointRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many search requests'
})

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await searchLimiter(request)
  if (rateLimitResult) return rateLimitResult

  // Your logic here
}
```

### 4. CSRF Protection

```typescript
// Client-side: Using the CSRF hook
import { useCSRFToken } from '@/lib/hooks/use-csrf-token'

function MyComponent() {
  const { token, fetchWithCSRF } = useCSRFToken()

  const handleSubmit = async (data: any) => {
    const response = await fetchWithCSRF('/api/sensitive-action', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      // Handle error
    }
  }
}

// Server-side: CSRF is automatically validated by middleware
```

### 5. Secure Data Handling

```typescript
// Never expose sensitive data
interface CustomerResponse {
  id: string
  name: string
  email: string
  accountNumber: string // Will be masked
  // Never include: ssn, fullAccountNumber, passwords, etc.
}

// Mask sensitive data
function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return '****'
  return `****${accountNumber.slice(-4)}`
}

// Sanitize before storage
import { sanitizeHtml } from '@/lib/security/sanitization'

const sanitizedInput = sanitizeHtml(userInput)
```

### 6. Session Security

```typescript
// Check for session anomalies
import { SessionManagement } from '@/lib/security/session-management'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  
  // Detect anomalies
  const anomalies = await SessionManagement.detectSessionAnomalies(
    session.user.id,
    {
      fingerprint: request.headers.get('x-device-fingerprint'),
      ipAddress: request.ip,
      userAgent: request.headers.get('user-agent'),
      lastActive: new Date()
    }
  )

  // Handle high-severity anomalies
  if (anomalies.some(a => a.severity === 'high')) {
    return Response.json(
      { error: 'Session verification required' },
      { status: 403 }
    )
  }
}
```

## Security Anti-Patterns to Avoid

### ❌ Never Do This:

```typescript
// BAD: SQL Injection vulnerability
const query = `SELECT * FROM users WHERE email = '${userEmail}'`

// BAD: XSS vulnerability
return <div dangerouslySetInnerHTML={{ __html: userInput }} />

// BAD: Exposing sensitive data in errors
catch (error) {
  return Response.json({ error: error.message }, { status: 500 })
}

// BAD: Weak random values
const token = Math.random().toString(36)

// BAD: Storing secrets in code
const API_KEY = "sk_live_abcd1234"
```

### ✅ Do This Instead:

```typescript
// GOOD: Parameterized queries
const user = await db.user.findUnique({
  where: { email: userEmail }
})

// GOOD: Safe rendering
return <div>{userInput}</div>

// GOOD: Generic error messages
catch (error) {
  logger.error('Database error', { error, userId })
  return Response.json({ error: 'An error occurred' }, { status: 500 })
}

// GOOD: Cryptographically secure random
import { randomBytes } from 'crypto'
const token = randomBytes(32).toString('hex')

// GOOD: Environment variables
const API_KEY = process.env.API_KEY
```

## MFA Implementation

### Requiring MFA for Sensitive Operations

```typescript
// In your API route
export const POST = withAuth(
  async (request, { user }) => {
    // Sensitive operation logic
  },
  {
    requiredRole: 'ADMIN',
    requireMFA: true,
    requireFreshAuth: true // Within last 15 minutes
  }
)
```

### MFA Verification Flow

```typescript
// Check if user needs MFA
if (user.mfaEnabled && !session.mfaVerified) {
  return Response.json(
    { 
      error: 'MFA_REQUIRED',
      mfaToken: generateMFAToken(session.id)
    },
    { status: 403 }
  )
}
```

## Audit Logging

### What to Log

```typescript
// Always log these events
await auditLog({
  userId: user.id,
  action: 'EXPORT_CUSTOMER_DATA',
  resource: 'customer',
  resourceId: customerId,
  metadata: {
    exportFormat: 'pdf',
    recordCount: 150,
    includePaymentData: true
  },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
})
```

### Audit Log Categories

| Action | When to Log |
|--------|-------------|
| AUTH_* | All authentication events |
| ACCESS_* | Data access (view, search, export) |
| MODIFY_* | Data changes (create, update, delete) |
| ADMIN_* | Administrative actions |
| SECURITY_* | Security events (lockouts, MFA) |

## Error Handling

### Security-Safe Error Responses

```typescript
// Development vs Production errors
function handleError(error: unknown, isDevelopment: boolean) {
  // Log full error internally
  logger.error('API Error', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  })

  // Return safe error to client
  if (isDevelopment && error instanceof Error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    )
  }

  // Production: Generic messages
  return Response.json(
    { error: 'An error occurred' },
    { status: 500 }
  )
}
```

## Testing Security Features

### Unit Tests

```typescript
describe('API Security', () => {
  it('should reject requests without authentication', async () => {
    const response = await fetch('/api/protected')
    expect(response.status).toBe(401)
  })

  it('should enforce rate limiting', async () => {
    // Make requests up to limit
    for (let i = 0; i < 10; i++) {
      await fetch('/api/search', { method: 'POST' })
    }
    
    // 11th request should be rate limited
    const response = await fetch('/api/search', { method: 'POST' })
    expect(response.status).toBe(429)
  })

  it('should validate CSRF tokens', async () => {
    const response = await fetch('/api/sensitive', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': 'invalid-token'
      }
    })
    expect(response.status).toBe(403)
  })
})
```

### Integration Tests

```typescript
describe('MFA Flow', () => {
  it('should require MFA for sensitive operations', async () => {
    // Login
    const session = await login(testUser)
    
    // Try sensitive operation
    const response = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${session.token}` }
    })
    
    expect(response.status).toBe(403)
    expect(response.json()).toMatchObject({
      error: 'MFA_REQUIRED'
    })
  })
})
```

## Security Headers Configuration

### Next.js Middleware

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}
```

## Secure Coding Guidelines

### 1. Authentication Checks

Always verify authentication at the start of protected functions:

```typescript
const session = await getServerSession()
if (!session?.user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 2. Authorization Checks

Verify user permissions for the requested action:

```typescript
if (!canUserAccessResource(user, resource)) {
  await auditLog({
    userId: user.id,
    action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    resource: resource.type,
    resourceId: resource.id
  })
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 3. Data Validation

Validate all input data:

```typescript
// Use Zod for runtime validation
const schema = z.object({
  email: z.string().email(),
  amount: z.number().positive().max(10000),
  notes: z.string().max(500).optional()
})

const result = schema.safeParse(input)
if (!result.success) {
  return Response.json(
    { error: 'Invalid input', fields: result.error.flatten() },
    { status: 400 }
  )
}
```

### 4. Output Encoding

Always encode output to prevent XSS:

```typescript
// React automatically escapes values
return <div>{userContent}</div>

// For raw HTML (avoid if possible)
import DOMPurify from 'isomorphic-dompurify'
const clean = DOMPurify.sanitize(htmlContent)
```

## Performance & Security Balance

### Caching Sensitive Data

```typescript
// Cache with security in mind
const cacheKey = `user:${userId}:${sessionId}` // Include session
const ttl = 5 * 60 // 5 minutes max for sensitive data

// Clear cache on security events
async function onSecurityEvent(userId: string) {
  await cache.delete(`user:${userId}:*`)
}
```

### Database Query Optimization

```typescript
// Limit data exposure in queries
const customers = await db.customer.findMany({
  where: { companyId: user.companyId },
  select: {
    id: true,
    name: true,
    email: true,
    // Don't select sensitive fields unless needed
    // ssn: false,
    // bankAccount: false,
  },
  take: 100, // Always limit results
})
```

## Deployment Security Checklist

Before deploying:

- [ ] All environment variables are set correctly
- [ ] Database migrations include proper indexes
- [ ] Security headers are configured
- [ ] Rate limiting is enabled
- [ ] Audit logging is functional
- [ ] Error messages are generic
- [ ] HTTPS is enforced
- [ ] Backup procedures are tested
- [ ] Monitoring alerts are configured
- [ ] Security tests are passing

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- Internal Security Wiki: `wiki.company.com/security`

---

**Remember**: Security is everyone's responsibility. When in doubt, ask the security team!