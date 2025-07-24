import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * Require authentication for API routes
 */
export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    return {
      authenticated: false,
      user: null
    }
  }
  
  return {
    authenticated: true,
    user: session.user
  }
}

/**
 * Check if user has required role
 */
export function requireRole(userRole: string, requiredRole: string | string[]) {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  return roles.includes(userRole)
}