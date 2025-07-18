import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { getEnv, isAuthorizedEmail } from "@/lib/env"
import type { UserRole } from "@/lib/generated/prisma"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
    }
  }

  interface User {
    role: UserRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
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
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }) {
      // Check if user email is in the authorized list
      if (!user.email || !isAuthorizedEmail(user.email)) {
        return false
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        // Initial sign in
        token.id = user.id
        token.role = user.role || "USER"

        // Log the sign-in event
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "USER_LOGIN",
            resource: "auth",
            metadata: {
              provider: account.provider,
              email: user.email,
            },
          },
        })
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
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
