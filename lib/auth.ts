import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { getEnv, isAuthorizedEmail } from "@/lib/env"
import type { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      mfaEnabled?: boolean
      mfaVerified?: boolean
    }
  }

  interface User {
    role: UserRole
    mfaEnabled?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    mfaEnabled?: boolean
    mfaVerified?: boolean
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  providers: [
    GoogleProvider({
      clientId: getEnv().GOOGLE_CLIENT_ID,
      clientSecret: getEnv().GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: getEnv().SESSION_TIMEOUT_MINUTES * 60, // Convert minutes to seconds
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === "development", // Enable debug in development
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("[NextAuth] SignIn callback:", {
        email: user.email,
        provider: account?.provider,
        authorized: user.email ? isAuthorizedEmail(user.email) : false
      })
      
      // Check if user email is in the authorized list
      if (!user.email || !isAuthorizedEmail(user.email)) {
        console.error("[NextAuth] Unauthorized email:", user.email)
        return false
      }
      
      console.log("[NextAuth] Email authorized, proceeding with sign in")
      return true
    },
    async redirect({ url, baseUrl }) {
      console.log("[NextAuth] Redirect callback:", { url, baseUrl })
      
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl + "/dashboard"
    },
    async jwt({ token, user, account, trigger }) {
      console.log("[NextAuth] JWT callback:", {
        trigger,
        hasUser: !!user,
        hasAccount: !!account,
        userId: user?.id
      })
      
      if (account && user) {
        // Initial sign in
        token.id = user.id
        token.role = user.role || "USER"

        try {
          // Check MFA status
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { mfaEnabled: true },
          })

          token.mfaEnabled = dbUser?.mfaEnabled || false
          token.mfaVerified = false // Requires separate verification

          // Log the sign-in event
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: "USER_LOGIN",
              resource: "auth",
              metadata: {
                provider: account.provider,
                email: user.email,
                mfaRequired: token.mfaEnabled,
              },
            },
          })
          
          console.log("[NextAuth] JWT token created successfully for user:", user.id)
        } catch (error) {
          console.error("[NextAuth] Error in JWT callback:", error)
          // Continue without audit log - don't block authentication
        }
      }

      // Handle MFA verification updates
      if (trigger === "update" && token) {
        // This would be called after successful MFA verification
        // Update token with MFA verification status
      }

      return token
    },
    async session({ session, token }) {
      console.log("[NextAuth] Session callback:", {
        hasSession: !!session,
        hasToken: !!token,
        tokenId: token?.id,
        tokenRole: token?.role
      })
      
      if (session.user && token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.mfaEnabled = token.mfaEnabled
        session.user.mfaVerified = token.mfaVerified
      }
      
      console.log("[NextAuth] Session created:", session.user?.email)
      return session
    },
  },
  events: {
    async signOut({ token }) {
      // Log the sign-out event
      if (token?.id) {
        await prisma.auditLog.create({
          data: {
            userId: token.id,
            action: "USER_LOGOUT",
            resource: "auth",
          },
        })
      }
    },
  },
}
