"use client"

import React from "react"
import { ErrorBoundary } from "@/components/errors/error-boundary"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"

interface Props {
  children: React.ReactNode
}

export function ErrorProvider({ children }: Props) {
  const router = useRouter()

  const appErrorFallback = (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-lg space-y-8 p-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-6 dark:bg-red-900/20">
            <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Application Error</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            We&apos;re sorry, but something went wrong. Our team has been notified and is working on it.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              size="lg"
              className="inline-flex items-center"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Reload page
            </Button>

            <Button
              onClick={() => router.push("/")}
              variant="outline"
              size="lg"
              className="inline-flex items-center"
            >
              <Home className="mr-2 h-5 w-5" />
              Go home
            </Button>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            If the problem persists, please contact support
          </p>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="border-t border-gray-200 pt-8 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Check the console for error details (development mode)
            </p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={appErrorFallback}
      level="page"
      onError={(error, errorInfo) => {
        // Log to monitoring service in production
        if (process.env.NODE_ENV === "production") {
          // This would send to your monitoring service
          console.error("Application Error:", {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          })
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
