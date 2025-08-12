#!/usr/bin/env node

const keys = [
  "NODE_ENV",
  "APP_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "AUTHORIZED_EMAILS",
  "SESSION_TIMEOUT_MINUTES",
  "HUBSPOT_API_KEY",
  "HUBSPOT_BASE_URL",
  "DWOLLA_KEY",
  "DWOLLA_SECRET",
  "DWOLLA_ENVIRONMENT",
  "DWOLLA_BASE_URL",
  "LOG_LEVEL",
  "RATE_LIMIT_REQUESTS_PER_MINUTE",
  "ENABLE_SECURITY_HEADERS",
  "CSP_REPORT_URI",
  "PDF_COMPANY_NAME",
  "PDF_COMPANY_LOGO_URL",
  "AUTHORIZED_API_KEYS",
]

function maskValue(key, value) {
  if (!value) return "__UNSET__"
  const isSecret = /secret|password|token|key|database_url|client_secret|dwolla_secret|dwolla_key|hubspot_api_key|nextauth_secret/i.test(
    key
  )
  if (!isSecret) return value
  if (value.length <= 8) return "***"
  return `${value.slice(0, 2)}***${value.slice(-2)}`
}

const lines = keys.map((k) => `${k}=${maskValue(k, process.env[k])}`)
lines.sort()
console.log(lines.join("\n"))