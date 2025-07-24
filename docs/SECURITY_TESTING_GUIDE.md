# Security Testing Guide

## Overview

This guide provides comprehensive instructions for testing the security features of the Unified Customer Dashboard. All security features must be thoroughly tested before deployment.

## Testing Environment Setup

### Prerequisites

```bash
# Install testing tools
npm install --save-dev @testing-library/react @testing-library/jest-dom jest ts-jest
npm install --save-dev supertest @types/supertest
npm install --save-dev nock # For mocking external APIs

# Security testing tools
npm install --save-dev zap-cli # OWASP ZAP
npm install --save-dev snyk # Vulnerability scanning
```

### Environment Configuration

```bash
# .env.test
NODE_ENV=test
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-secret-key
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
AUTHORIZED_EMAILS=test@example.com,admin@example.com
RATE_LIMIT_REQUESTS_PER_MINUTE=100
MFA_REQUIRED=true
```

## Unit Testing Security Features

### 1. Authentication Tests

```typescript
// __tests__/api/auth.test.ts
import { createMocks } from "node-mocks-http"
import { POST } from "@/app/api/auth/[...nextauth]/route"

describe("Authentication", () => {
  describe("Login", () => {
    it("should reject unauthorized emails", async () => {
      const { req, res } = createMocks({
        method: "POST",
        body: {
          email: "unauthorized@example.com",
          password: "password123",
        },
      })

      await POST(req as any, res as any)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toMatchObject({
        error: "Unauthorized",
      })
    })

    it("should track failed login attempts", async () => {
      const email = "test@example.com"

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const { req, res } = createMocks({
          method: "POST",
          body: { email, password: "wrong-password" },
        })

        await POST(req as any, res as any)
      }

      // 6th attempt should be locked out
      const { req, res } = createMocks({
        method: "POST",
        body: { email, password: "correct-password" },
      })

      await POST(req as any, res as any)

      expect(res._getStatusCode()).toBe(429)
      expect(JSON.parse(res._getData())).toMatchObject({
        error: "Account locked",
      })
    })
  })

  describe("Session Management", () => {
    it("should timeout after inactivity", async () => {
      // Create session
      const session = await createSession(testUser)

      // Fast-forward time
      jest.advanceTimersByTime(31 * 60 * 1000) // 31 minutes

      // Try to use session
      const response = await fetch("/api/protected", {
        headers: { Cookie: `session=${session.token}` },
      })

      expect(response.status).toBe(401)
    })
  })
})
```

### 2. CSRF Protection Tests

```typescript
// __tests__/security/csrf.test.ts
describe("CSRF Protection", () => {
  it("should reject requests without CSRF token", async () => {
    const response = await fetch("/api/customer/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "New Name" }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "CSRF token missing",
    })
  })

  it("should reject requests with invalid CSRF token", async () => {
    const response = await fetch("/api/customer/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "invalid-token",
      },
      body: JSON.stringify({ name: "New Name" }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "Invalid CSRF token",
    })
  })

  it("should accept valid API signature", async () => {
    const apiKey = "test-api-key"
    const timestamp = Date.now().toString()
    const body = { name: "New Name" }
    const bodyHash = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex")

    const signature = crypto
      .createHmac("sha256", apiKey)
      .update(`POST:/api/customer/update:${timestamp}:${bodyHash}`)
      .digest("hex")

    const response = await fetch("/api/customer/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-Request-Signature": signature,
        "X-Timestamp": timestamp,
        "X-Body-Hash": bodyHash,
      },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(200)
  })
})
```

### 3. Rate Limiting Tests

```typescript
// __tests__/security/rate-limit.test.ts
describe("Rate Limiting", () => {
  it("should enforce rate limits", async () => {
    const requests = []

    // Make requests up to the limit
    for (let i = 0; i < 60; i++) {
      requests.push(fetch("/api/search", { method: "POST" }))
    }

    const responses = await Promise.all(requests)
    const statuses = responses.map((r) => r.status)

    // First 60 should succeed
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true)

    // Make one more request
    const response = await fetch("/api/search", { method: "POST" })

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBeDefined()
  })

  it("should provide rate limit headers", async () => {
    const response = await fetch("/api/search", { method: "POST" })

    expect(response.headers.get("X-RateLimit-Limit")).toBe("60")
    expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined()
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined()
  })

  it("should handle burst traffic", async () => {
    // Fill normal limit
    for (let i = 0; i < 60; i++) {
      await fetch("/api/search", { method: "POST" })
    }

    // Burst requests (up to 150% = 90 total)
    const burstResponses = []
    for (let i = 0; i < 30; i++) {
      burstResponses.push(fetch("/api/search", { method: "POST" }))
    }

    const results = await Promise.all(burstResponses)
    const successCount = results.filter((r) => r.status === 200).length

    expect(successCount).toBeGreaterThan(0)
    expect(successCount).toBeLessThanOrEqual(30)
  })
})
```

### 4. MFA Tests

```typescript
// __tests__/security/mfa.test.ts
describe("Multi-Factor Authentication", () => {
  describe("Setup", () => {
    it("should generate QR code without exposing secret", async () => {
      const response = await fetch("/api/auth/mfa/setup", {
        headers: { Authorization: `Bearer ${session.token}` },
      })

      const data = await response.json()

      expect(data.qrCode).toMatch(/^data:image\/png;base64,/)
      expect(data.secret).toBeUndefined() // Never expose secret
      expect(data.backupCodes).toHaveLength(10)
    })

    it("should generate unique backup codes", async () => {
      const response = await fetch("/api/auth/mfa/setup", {
        headers: { Authorization: `Bearer ${session.token}` },
      })

      const { backupCodes } = await response.json()
      const uniqueCodes = new Set(backupCodes)

      expect(uniqueCodes.size).toBe(10)
      expect(backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    })
  })

  describe("Verification", () => {
    it("should enforce rate limiting on TOTP attempts", async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await fetch("/api/auth/mfa/verify", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ code: "000000" }),
        })
      }

      // 4th attempt should be rate limited
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ code: "123456" }),
      })

      expect(response.status).toBe(429)
      expect(await response.json()).toMatchObject({
        error: "Too many attempts",
        lockoutMinutes: 15,
      })
    })

    it("should consume backup codes after use", async () => {
      const { backupCodes } = await setupMFA(testUser)
      const codeToUse = backupCodes[0]

      // Use backup code
      const response1 = await fetch("/api/auth/mfa/verify-backup", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ code: codeToUse }),
      })

      expect(response1.status).toBe(200)

      // Try to reuse the same code
      const response2 = await fetch("/api/auth/mfa/verify-backup", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ code: codeToUse }),
      })

      expect(response2.status).toBe(401)
      expect(await response2.json()).toMatchObject({
        error: "Invalid code",
      })
    })
  })
})
```

### 5. Session Anomaly Tests

```typescript
// __tests__/security/session-anomalies.test.ts
describe("Session Anomaly Detection", () => {
  it("should detect impossible travel", async () => {
    // Login from New York
    const session1 = await login({
      email: "test@example.com",
      headers: { "X-Forwarded-For": "72.229.28.185" }, // NY IP
    })

    // Wait 5 minutes
    await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000))

    // Try to use session from Tokyo
    const response = await fetch("/api/sensitive-data", {
      headers: {
        Authorization: `Bearer ${session1.token}`,
        "X-Forwarded-For": "126.116.55.123", // Tokyo IP
      },
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "Session verification required",
      reason: "IMPOSSIBLE_TRAVEL",
    })
  })

  it("should detect concurrent sessions from different IPs", async () => {
    // Create 3 sessions from different IPs
    const sessions = await Promise.all([
      login({ headers: { "X-Forwarded-For": "192.168.1.1" } }),
      login({ headers: { "X-Forwarded-For": "10.0.0.1" } }),
      login({ headers: { "X-Forwarded-For": "172.16.0.1" } }),
    ])

    // 4th session should trigger anomaly
    const response = await login({
      headers: { "X-Forwarded-For": "203.0.113.1" },
    })

    expect(response.anomalies).toContainEqual(
      expect.objectContaining({
        type: "CONCURRENT_SESSIONS",
        severity: "medium",
      })
    )
  })
})
```

## Integration Testing

### 1. End-to-End Authentication Flow

```typescript
// __tests__/e2e/auth-flow.test.ts
import { test, expect } from "@playwright/test"

test.describe("Authentication Flow", () => {
  test("complete login with MFA", async ({ page }) => {
    // Navigate to login
    await page.goto("/auth/signin")

    // Enter credentials
    await page.fill('input[name="email"]', "test@example.com")
    await page.fill('input[name="password"]', "SecurePass123!")
    await page.click('button[type="submit"]')

    // MFA challenge
    await expect(page).toHaveURL("/auth/mfa")

    // Enter TOTP code
    const totpCode = generateTOTPCode(testUser.mfaSecret)
    await page.fill('input[name="code"]', totpCode)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard")

    // Verify session
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find((c) => c.name === "next-auth.session-token")
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie.httpOnly).toBe(true)
    expect(sessionCookie.secure).toBe(true)
  })

  test("account lockout after failed attempts", async ({ page }) => {
    await page.goto("/auth/signin")

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', "test@example.com")
      await page.fill('input[name="password"]', "wrong-password")
      await page.click('button[type="submit"]')

      await expect(page.locator(".error-message")).toContainText("Invalid credentials")
    }

    // 6th attempt should show lockout
    await page.fill('input[name="email"]', "test@example.com")
    await page.fill('input[name="password"]', "correct-password")
    await page.click('button[type="submit"]')

    await expect(page.locator(".error-message")).toContainText("Account locked")
  })
})
```

### 2. API Security Tests

```typescript
// __tests__/e2e/api-security.test.ts
test.describe("API Security", () => {
  test("CSRF protection on state-changing operations", async ({ request }) => {
    // Get CSRF token
    const csrfResponse = await request.get("/api/auth/csrf")
    const { csrfToken } = await csrfResponse.json()

    // Make protected request
    const response = await request.post("/api/customer/update", {
      data: { name: "Updated Name" },
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    })

    expect(response.ok()).toBeTruthy()
  })

  test("rate limiting enforcement", async ({ request }) => {
    const requests = []

    // Make 61 requests (1 over limit)
    for (let i = 0; i < 61; i++) {
      requests.push(
        request.post("/api/search", {
          data: { query: "test" },
        })
      )
    }

    const responses = await Promise.all(requests)
    const rateLimited = responses.filter((r) => r.status() === 429)

    expect(rateLimited.length).toBeGreaterThan(0)
  })
})
```

## Security Scanning

### 1. Dependency Scanning

```bash
# Check for known vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Check with Snyk
npx snyk test

# Check licenses
npx license-checker --production --summary
```

### 2. Static Code Analysis

```bash
# ESLint security rules
npm run lint:security

# Semgrep security patterns
semgrep --config=auto --severity=ERROR

# GitLeaks for secrets
gitleaks detect --source . --verbose
```

### 3. Dynamic Application Security Testing (DAST)

```bash
# Start OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r security-report.html

# Run specific security tests
zap-cli quick-scan --self-contained \
  --start-options '-config api.disablekey=true' \
  http://localhost:3000
```

## Penetration Testing Checklist

### Authentication & Session Management

- [ ] Test for session fixation vulnerabilities
- [ ] Verify session timeout functionality
- [ ] Test concurrent session limits
- [ ] Check for session hijacking possibilities
- [ ] Verify secure cookie attributes
- [ ] Test remember me functionality
- [ ] Check password reset flow security

### Authorization

- [ ] Test horizontal privilege escalation
- [ ] Test vertical privilege escalation
- [ ] Verify role-based access controls
- [ ] Check direct object references
- [ ] Test for path traversal
- [ ] Verify API authorization

### Input Validation

- [ ] Test for SQL injection
- [ ] Test for XSS (reflected, stored, DOM-based)
- [ ] Test for command injection
- [ ] Test for XXE injection
- [ ] Test for LDAP injection
- [ ] Test file upload restrictions
- [ ] Verify input length limits

### CSRF Protection

- [ ] Test state-changing operations without token
- [ ] Test with invalid tokens
- [ ] Test token expiration
- [ ] Verify token uniqueness
- [ ] Test cross-origin requests

### Rate Limiting

- [ ] Test rate limit enforcement
- [ ] Verify rate limit headers
- [ ] Test burst handling
- [ ] Check for rate limit bypass
- [ ] Test distributed attacks

### Cryptography

- [ ] Verify HTTPS enforcement
- [ ] Check TLS configuration
- [ ] Test for weak ciphers
- [ ] Verify certificate validation
- [ ] Check for hardcoded secrets
- [ ] Test encryption at rest

## Performance Security Testing

```typescript
// __tests__/performance/security-performance.test.ts
describe("Security Performance", () => {
  test("CSRF token generation performance", async () => {
    const times = []

    for (let i = 0; i < 100; i++) {
      const start = performance.now()
      await CSRFProtection.generateToken("session-id")
      const end = performance.now()

      times.push(end - start)
    }

    const avg = times.reduce((a, b) => a + b) / times.length
    expect(avg).toBeLessThan(10) // Should take less than 10ms
  })

  test("Rate limiting performance under load", async () => {
    const limiter = new RateLimiter()
    const start = performance.now()

    // Simulate 1000 requests
    const promises = []
    for (let i = 0; i < 1000; i++) {
      promises.push(limiter.check(`ip-${i % 100}`))
    }

    await Promise.all(promises)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(1000) // Should handle 1000 requests in < 1 second
  })
})
```

## Continuous Security Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 0 * * *" # Daily

jobs:
  security-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Run security tests
        run: npm run test:security

      - name: Run dependency check
        run: npm audit --production

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run SAST scan
        uses: github/super-linter@v4
        env:
          VALIDATE_JAVASCRIPT_ES: true
          VALIDATE_TYPESCRIPT_ES: true

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: security-test-results
          path: |
            coverage/
            security-report.html
```

## Security Test Reporting

### Test Report Template

```markdown
# Security Test Report

**Date**: [Date]
**Version**: [Version]
**Tester**: [Name]

## Summary

- Total Tests: X
- Passed: X
- Failed: X
- Vulnerabilities Found: X

## Test Results

### Authentication

- [x] Session management
- [x] Password policies
- [ ] MFA bypass attempts

### Authorization

- [x] Role-based access
- [x] API permissions
- [ ] Privilege escalation

### Input Validation

- [x] XSS prevention
- [x] SQL injection
- [x] File upload security

### Rate Limiting

- [x] Endpoint limits
- [x] Burst handling
- [ ] Distributed attacks

## Vulnerabilities

### Critical

- None found

### High

- [Description and remediation]

### Medium

- [Description and remediation]

### Low

- [Description and remediation]

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]

## Sign-off

- Security Team: [Name]
- Development Team: [Name]
- Management: [Name]
```

---

**Remember**: Security testing is an ongoing process. Regular testing and updates are essential for maintaining a secure application.
