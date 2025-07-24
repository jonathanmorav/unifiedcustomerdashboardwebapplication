import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const debug = {
    env: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET (length: " + process.env.NEXTAUTH_SECRET.length + ")" : "NOT SET",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "SET" : "NOT SET",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "SET" : "NOT SET",
      AUTHORIZED_EMAILS: process.env.AUTHORIZED_EMAILS || "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET"
    },
    callbacks: {
      googleCallback: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
      signInPage: `${process.env.NEXTAUTH_URL}/auth/signin`,
      errorPage: `${process.env.NEXTAUTH_URL}/auth/error`
    },
    issues: []
  }

  // Check for common issues
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
    debug.issues.push("NEXTAUTH_SECRET must be at least 32 characters")
  }
  
  if (!process.env.NEXTAUTH_URL) {
    debug.issues.push("NEXTAUTH_URL is not set")
  }
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    debug.issues.push("Google OAuth credentials are not set")
  }
  
  if (!process.env.AUTHORIZED_EMAILS) {
    debug.issues.push("No authorized emails configured")
  }

  return NextResponse.json(debug, { 
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  })
}