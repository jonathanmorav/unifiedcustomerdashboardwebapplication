"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthTestPage() {
  const { data: session, status } = useSession()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Test Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Status: {status}</p>
            {session?.user && (
              <div className="mt-2 space-y-1">
                <p className="text-sm">Email: {session.user.email}</p>
                <p className="text-sm">ID: {session.user.id}</p>
                <p className="text-sm">Role: {session.user.role}</p>
              </div>
            )}
          </div>
          
          {status === "authenticated" ? (
            <Button 
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full"
            >
              Sign Out
            </Button>
          ) : (
            <div className="space-y-2">
              <Button 
                onClick={() => {
                  console.log("Starting Google sign in...")
                  signIn("google", { callbackUrl: "/dashboard" })
                }}
                className="w-full"
              >
                Sign in with Google
              </Button>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>Check browser console for debug logs</p>
                <p>Authorized email: {process.env.NEXT_PUBLIC_AUTHORIZED_EMAIL || "Check .env.local"}</p>
              </div>
            </div>
          )}
          
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <p className="font-medium mb-1">Debug Info:</p>
            <p>NEXTAUTH_URL: {process.env.NEXT_PUBLIC_NEXTAUTH_URL || "Not visible (server-side)"}</p>
            <p>Callback URL: {window.location.origin}/api/auth/callback/google</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}