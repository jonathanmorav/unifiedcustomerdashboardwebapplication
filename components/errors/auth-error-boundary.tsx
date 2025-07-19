'use client'

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut, AlertCircle } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

export function AuthErrorBoundary({ children }: Props) {
  const handleAuthError = (error: Error) => {
    // Check if it's an authentication error
    if (
      error.message.includes('401') ||
      error.message.includes('unauthorized') ||
      error.message.includes('authentication') ||
      error.message.includes('session')
    ) {
      // Sign out after a delay to show the error message
      setTimeout(() => {
        signOut({ callbackUrl: '/auth/signin' })
      }, 3000)
    }
  }

  const authErrorFallback = (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-3">
            <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Authentication Error
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your session has expired or is invalid. You'll be redirected to sign in again.
          </p>
        </div>

        <Button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          variant="default"
          className="inline-flex items-center"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign in again
        </Button>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={authErrorFallback}
      onError={handleAuthError}
      level="section"
      isolate
    >
      {children}
    </ErrorBoundary>
  )
}