import { z } from "zod"

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // HubSpot API
  HUBSPOT_API_KEY: z.string(),
  HUBSPOT_BASE_URL: z.string().url().default("https://api.hubapi.com"),

  // Dwolla API
  DWOLLA_KEY: z.string(),
  DWOLLA_SECRET: z.string(),
  DWOLLA_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  DWOLLA_BASE_URL: z.string().url(),

  // Authorized Users
  AUTHORIZED_EMAILS: z.string().transform((val) => val.split(",").map((email) => email.trim())),

  // Session
  SESSION_TIMEOUT_MINUTES: z.string().default("30").transform(Number),

  // Application
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().default("60").transform(Number),

  // Security
  ENABLE_SECURITY_HEADERS: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  CSP_REPORT_URI: z.string().optional(),

  // PDF Export
  PDF_COMPANY_NAME: z.string().default("Your Company"),
  PDF_COMPANY_LOGO_URL: z.string().url().optional(),

  // API Security
  AUTHORIZED_API_KEYS: z
    .string()
    .optional()
    .transform((val) => val?.split(",").map((key) => key.trim()) || []),
})

// Minimal schema for authentication-related environment variables
const authEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  SESSION_TIMEOUT_MINUTES: z.string().default("30").transform(Number),
  AUTHORIZED_EMAILS: z.string().transform((val) => val.split(",").map((email) => email.trim())),
})

export type Env = z.infer<typeof envSchema>
export type AuthEnv = z.infer<typeof authEnvSchema>

let env: Env | undefined
let authEnv: AuthEnv | undefined

export function getEnv(): Env {
  if (!env) {
    try {
      env = envSchema.parse(process.env)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missing = error.issues.map((e) => e.path.join(".")).join(", ")
        throw new Error(`Missing or invalid environment variables: ${missing}`)
      }
      throw error
    }
  }
  return env
}

export function getAuthEnv(): AuthEnv {
  if (!authEnv) {
    try {
      authEnv = authEnvSchema.parse(process.env)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missing = error.issues.map((e) => e.path.join(".")).join(", ")
        throw new Error(`Missing or invalid authentication environment variables: ${missing}`)
      }
      throw error
    }
  }
  return authEnv
}

export function isAuthorizedEmail(email: string): boolean {
  const { AUTHORIZED_EMAILS } = getAuthEnv()
  return AUTHORIZED_EMAILS.includes(email.toLowerCase())
}
