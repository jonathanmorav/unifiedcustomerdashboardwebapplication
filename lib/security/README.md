# Security Implementation Guide

## CSRF Protection

### Overview
Our CSRF protection implementation provides defense against Cross-Site Request Forgery attacks with support for both web-based and API-based authentication.

### Web Application Usage

For standard web forms and AJAX requests, use the `useCSRFToken` hook:

```typescript
import { useCSRFToken, fetchWithCSRF } from '@/lib/hooks/use-csrf-token'

function MyComponent() {
  const { token, loading, error } = useCSRFToken()

  const handleSubmit = async (data: any) => {
    if (!token) return

    const response = await fetchWithCSRF('/api/data', {
      method: 'POST',
      body: JSON.stringify(data),
      csrfToken: token,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Handle response
  }
}
```

### API Client Usage

For machine-to-machine communication, use HMAC signature authentication:

```typescript
import { fetchWithAPISignature } from '@/lib/hooks/use-csrf-token'

// API clients should use signed requests
const response = await fetchWithAPISignature('https://api.example.com/data', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' }),
  apiKey: process.env.API_KEY,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

### CSRF Exemption Policy

The following endpoints are exempt from CSRF protection:

1. **Authentication endpoints** (`/api/auth/*`) - Handled by NextAuth
2. **Health check endpoints** (`/api/health`) - No state changes
3. **Static assets** (`/_next/*`, `/favicon.ico`) - No state changes

### API Authentication Requirements

API endpoints can bypass CSRF if they include:

1. `X-API-Key` header with a valid API key
2. `X-Request-Signature` header with HMAC-SHA256 signature
3. `X-Timestamp` header within 5 minutes of current time
4. `X-Body-Hash` header for requests with body content

### Signature Calculation

```
Signature = HMAC-SHA256(apiKey, "METHOD:PATH:TIMESTAMP:BODY_HASH")
```

Example:
```
GET /api/data with timestamp 1234567890
Signature = HMAC-SHA256(apiKey, "GET:/api/data:1234567890:")
```

### Security Headers

All requests include:
- `X-Request-ID`: Unique identifier for each request
- `X-Correlation-ID`: Trace requests across systems

## Security Headers

### HSTS (Strict-Transport-Security)
Production environments enforce HTTPS with:
- `max-age=31536000` (1 year)
- `includeSubDomains` - applies to all subdomains
- `preload` - eligible for browser preload lists

### Additional Security Headers
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer info
- `X-Permitted-Cross-Domain-Policies: none` - Restricts Adobe Flash/PDF
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` - Disables APIs
- `X-DNS-Prefetch-Control: off` - Disables DNS prefetching

### Content Security Policy (CSP)
Enhanced CSP directives:
- `default-src 'self'` - Default to same origin
- `frame-ancestors 'none'` - Prevents embedding
- `form-action 'self'` - Forms can only submit to same origin
- `base-uri 'self'` - Restricts base URL
- Report URI support for violation monitoring

## Correlation Tracking

### Overview
End-to-end request correlation enables tracing requests across all systems:

```typescript
import { CorrelationTracking } from '@/lib/security/correlation'

// Automatic correlation in external API calls
const correlationId = await CorrelationTracking.getCorrelationId()
const requestId = await CorrelationTracking.getRequestId()

// Structured logging with correlation
await CorrelationTracking.log('info', 'Processing request', {
  userId: session.user.id,
  action: 'search',
  resultCount: results.length
})
```

### External API Integration
Both HubSpot and Dwolla clients automatically:
- Include correlation headers in all requests
- Log errors with correlation context
- Support distributed tracing

### Testing Correlation
```bash
# Make request with correlation ID
curl -X GET http://localhost:3000/api/search \
  -H "X-Correlation-ID: test-correlation-123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check logs for correlation
# All related logs will include "correlationId": "test-correlation-123"
```

## Rate Limiting

### Overview
Our rate limiting implementation provides protection against abuse with configurable limits per endpoint, burst handling, and automatic lockout for repeated violations.

### Default Rate Limits

- **Global**: 60 requests/minute (configurable via `RATE_LIMIT_REQUESTS_PER_MINUTE`)
- **Authentication**: 5 attempts/15 minutes
- **API**: 100 requests/minute
- **Search**: 30 searches/minute

### Rate Limit Headers

All responses include standard rate limit headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in window
- `RateLimit-Reset`: Time when limit resets (ISO 8601)
- `Retry-After`: Seconds until retry (on 429 responses)

### Burst Handling

The system allows temporary bursts up to 150% of the limit with exponential backoff. This helps legitimate users during peak usage while preventing abuse.

### Custom Rate Limiting

For endpoints requiring specific limits:

```typescript
import { createEndpointRateLimiter } from '@/lib/security/middleware/rate-limit-middleware'

const customLimiter = createEndpointRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per window
})

export async function POST(request: NextRequest) {
  const rateLimitResult = await customLimiter(request)
  if (rateLimitResult) return rateLimitResult
  
  // Your logic here
}
```

### Abuse Detection

The system automatically detects abuse patterns:
- More than 10 rate limit violations in 1 hour triggers a 1-hour lockout
- All violations are logged in the audit trail
- Alerts can be configured for repeated violations

### Testing Rate Limits

```bash
# Test rate limiting
for i in {1..70}; do
  curl -X GET http://localhost:3000/api/search \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -w "\nStatus: %{http_code}, Remaining: %{header.ratelimit-remaining}\n"
  sleep 0.5
done
```

## Implementation Checklist

- [x] CSRF token generation and validation
- [x] CSRF middleware with exemptions
- [x] API signature validation for machine clients
- [x] Client-side hooks for token management
- [x] Request/Correlation ID tracking
- [x] Rate limiting middleware with burst handling
- [x] Abuse pattern detection and lockouts
- [x] Custom endpoint rate limiters
- [x] HSTS header implementation (1 year, includeSubDomains, preload)
- [x] Enhanced security headers (Permissions-Policy, X-DNS-Prefetch-Control, etc.)
- [x] End-to-end correlation tracking across all API calls
- [x] TOTP-based MFA for all roles with backup codes
- [x] Account lockout policies with configurable thresholds
- [x] Session management with anomaly detection
- [x] Device fingerprinting and tracking
- [x] Concurrent session limits (3 per user)
- [x] Impossible travel detection
- [x] Logout everywhere functionality
- [ ] Input sanitization layer
- [ ] Field-level encryption for PII

## Multi-Factor Authentication (MFA)

### Overview
TOTP-based MFA is mandatory for all users with world-class security features:

- **No Secret Exposure**: Only QR codes shown, never raw secrets
- **Single-Use Backup Codes**: 10 codes, hashed, removed after use
- **Fresh Session Requirements**: 15-minute window for sensitive operations
- **Aggressive Rate Limiting**: 3 attempts per window with escalation

### MFA Setup Flow
```typescript
// 1. Initialize MFA setup
GET /api/auth/mfa/setup
Response: { qrCode, backupCodes, warning }

// 2. Verify TOTP to enable
POST /api/auth/mfa/setup
Body: { code: "123456" }

// 3. Check MFA status
GET /api/auth/mfa/status
Response: { enabled, required, backupCodesRemaining }
```

### Backup Codes Management
```typescript
// Regenerate backup codes (requires TOTP + password)
POST /api/auth/mfa/backup-codes
Body: { password, currentCode }
Response: { backupCodes, warning, remainingCodes }
```

### MFA Verification During Login
```typescript
// After initial auth, verify MFA
POST /api/auth/mfa/verify
Body: { email, code, sessionToken }
Response: { success, message }
```

## Account Security

### Lockout Policies
- **Failed Attempts**: 5 attempts trigger 30-minute lockout
- **Reset Window**: Counter resets after 15 minutes of no failures
- **Escalation**: 10+ violations in 1 hour escalates to security team

### Login Tracking
All login attempts are tracked with:
- Success/failure status
- IP address and user agent
- Failure reason
- Timestamp

### Admin Controls
```typescript
// Unlock account (admin only)
POST /api/auth/account/unlock
Body: { userId, reason }
```

## Session Management

### Session Features
- **Concurrent Limit**: Maximum 3 active sessions per user
- **Device Fingerprinting**: Tracks device characteristics
- **Anomaly Detection**: New device, new location, impossible travel
- **Logout Everywhere**: Revoke all sessions except current

### Session API
```typescript
// Get active sessions
GET /api/auth/sessions
Response: { sessions, total, limit }

// Revoke specific session
DELETE /api/auth/sessions
Body: { sessionId }

// Revoke all sessions
DELETE /api/auth/sessions
Body: { revokeAll: true }

// Check for anomalies
POST /api/auth/sessions/check-anomalies
Response: { anomalies, requiresMFA, sessionHealth }
```

### Anomaly Types
1. **New Device**: Previously unseen user agent
2. **New Location**: New IP address
3. **Impossible Travel**: Different locations too quickly
4. **Concurrent Sessions**: Multiple active from different IPs

### Anomaly Severity
- **Low**: Logged but allowed (new IP)
- **Medium**: Logged with notification (new device)
- **High**: Requires MFA re-verification (impossible travel)

## Testing CSRF Protection

### Manual Testing

1. **Valid Request Test**:
   ```bash
   # Get CSRF token
   curl -X GET http://localhost:3000/api/auth/csrf \
     -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
   
   # Use token in request
   curl -X POST http://localhost:3000/api/search \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"searchTerm": "test"}'
   ```

2. **API Client Test**:
   ```bash
   # Generate signature
   TIMESTAMP=$(date +%s)
   BODY_HASH=$(echo -n '{"searchTerm":"test"}' | sha256sum | cut -d' ' -f1)
   SIGNATURE=$(echo -n "POST:/api/search:$TIMESTAMP:$BODY_HASH" | \
     openssl dgst -sha256 -hmac "YOUR_API_KEY" | cut -d' ' -f2)
   
   # Make request
   curl -X POST http://localhost:3000/api/search \
     -H "X-API-Key: YOUR_API_KEY" \
     -H "X-Request-Signature: $SIGNATURE" \
     -H "X-Timestamp: $TIMESTAMP" \
     -H "X-Body-Hash: $BODY_HASH" \
     -H "Content-Type: application/json" \
     -d '{"searchTerm": "test"}'
   ```

### Automated Testing

See `/tests/security/csrf.test.ts` for comprehensive test suite.