"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function SignInContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  return (
    <div className="bg-cakewalk-bg-alice-100 flex min-h-screen items-center justify-center">
      <div className="animate-fade-in">
        <div className="rounded-cakewalk-large shadow-cakewalk-medium p-cakewalk-32 w-full max-w-md bg-white">
          <div className="mb-cakewalk-32 text-center">
            <h1 className="text-cakewalk-h2 text-cakewalk-primary-dark mb-cakewalk-8">
              Unified Customer Dashboard
            </h1>
            <p className="text-cakewalk-body-sm text-cakewalk-text-secondary">
              Sign in to access customer data
            </p>
          </div>

          {error && (
            <div className="mb-cakewalk-24 p-cakewalk-16 bg-cakewalk-error/10 border-cakewalk-error/20 rounded-cakewalk-medium border">
              <p className="text-cakewalk-body-xs text-cakewalk-error font-cakewalk-medium">
                {error === "AccessDenied"
                  ? "Your email is not authorized to access this application."
                  : "An error occurred during sign in. Please try again."}
              </p>
            </div>
          )}

          <Button
            onClick={() => signIn("google", { callbackUrl })}
            className="h-12 w-full"
            size="lg"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>

          <p className="mt-cakewalk-24 text-cakewalk-body-xxs text-cakewalk-text-tertiary text-center">
            Access is restricted to authorized users only
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-cakewalk-bg-alice-100 flex min-h-screen items-center justify-center">
          <div className="animate-pulse">
            <div className="rounded-cakewalk-large shadow-cakewalk-medium p-cakewalk-32 h-96 w-full max-w-md bg-white" />
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
