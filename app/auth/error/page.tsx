"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    Default: "An unexpected error occurred.",
  }

  const message = errorMessages[error || "Default"] || errorMessages.Default

  return (
    <div className="bg-cakewalk-alice-100 dark:bg-gray-900 flex min-h-screen items-center justify-center transition-colors duration-300">
      <div className="animate-fade-in">
        <div className="rounded-cakewalk-large p-cakewalk-32 w-full max-w-md bg-card text-center shadow-cakewalk-medium">
          <div className="mb-cakewalk-24">
            <div className="mb-cakewalk-16 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cakewalk-error/10">
              <svg
                className="h-8 w-8 text-cakewalk-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="mb-cakewalk-8 text-cakewalk-h2 text-cakewalk-primary-dark">
              Authentication Error
            </h1>
            <p className="mb-cakewalk-4 text-cakewalk-body-sm text-cakewalk-text-secondary">
              {message}
            </p>
            {error && (
              <p className="text-cakewalk-body-xs text-cakewalk-text-tertiary">
                Error code: {error}
              </p>
            )}
          </div>

          <Link href="/auth/signin">
            <Button className="w-full">Back to Sign In</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-cakewalk-alice-100 dark:bg-gray-900 flex min-h-screen items-center justify-center transition-colors duration-300">
          <div className="animate-pulse">
            <div className="rounded-cakewalk-large p-cakewalk-32 h-96 w-full max-w-md bg-card shadow-cakewalk-medium" />
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  )
}
