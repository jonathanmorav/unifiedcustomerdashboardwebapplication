import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { getEnv, isAuthorizedEmail } from "@/lib/env"
import type { UserRole } from "@prisma/client"

// This is a debug version of auth.ts with extensive logging

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
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
    maxAge: getEnv().SESSION_TIMEOUT_MINUTES * 60,
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: true, // Enable debug mode
  logger: {
    error(code, metadata) {
      console.error('[NextAuth] Error:', code, metadata)
    },
    warn(code) {
      console.warn('[NextAuth] Warning:', code)
    },
    debug(code, metadata) {
      console.log('[NextAuth] Debug:', code, metadata)
    }
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[NextAuth] signIn callback:', {
        user: { id: user.id, email: user.email },
        account: { provider: account?.provider, type: account?.type },
        hasProfile: !!profile
      })
      
      // Check if user email is in the authorized list
      if (!user.email || !isAuthorizedEmail(user.email)) {
        console.error('[NextAuth] Unauthorized email:', user.email)
        return false
      }
      
      console.log('[NextAuth] Email authorized:', user.email)
      return true
    },
    async redirect({ url, baseUrl }) {
      console.log('[NextAuth] redirect callback:', { url, baseUrl })
      
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async jwt({ token, user, account, trigger }) {
      console.log('[NextAuth] jwt callback:', {
        trigger,
        hasToken: !!token,
        hasUser: !!user,
        hasAccount: !!account
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
          token.mfaVerified = false

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
          
          console.log('[NextAuth] JWT token created successfully')
        } catch (error) {
          console.error('[NextAuth] Error in JWT callback:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      console.log('[NextAuth] session callback:', {
        hasSession: !!session,
        hasToken: !!token,
        tokenId: token?.id
      })
      
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role as UserRole
        session.user.mfaEnabled = token.mfaEnabled as boolean
        session.user.mfaVerified = token.mfaVerified as boolean
      }
      
      return session
    },
  },
  events: {
    async signIn(message) {
      console.log('[NextAuth] Event - signIn:', message.user.email)
    },
    async signOut(message) {
      console.log('[NextAuth] Event - signOut')
    },
    async createUser(message) {
      console.log('[NextAuth] Event - createUser:', message.user.email)
    },
    async linkAccount(message) {
      console.log('[NextAuth] Event - linkAccount:', message.account.provider)
    },
    async session(message) {
      console.log('[NextAuth] Event - session')
    },
  },
}