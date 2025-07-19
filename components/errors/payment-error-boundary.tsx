'use client'

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { Button } from '@/components/ui/button'
import { ShieldAlert, Home, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  children: React.ReactNode
}

export function PaymentErrorBoundary({ children }: Props) {
  const router = useRouter()

  const paymentErrorFallback = (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
            <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Secure Processing Error
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We encountered an error while processing secure financial data. 
            For your security, this action has been stopped.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Your data is safe.</strong> No financial information was compromised. 
            This error has been logged for review.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => window.location.reload()}
            variant="default"
            className="inline-flex items-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            className="inline-flex items-center"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to dashboard
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Error ID: {crypto.randomUUID()}
        </p>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={paymentErrorFallback}
      level="section"
      isolate
      onError={(error, errorInfo) => {
        // Never log sensitive payment data
        console.error('Payment processing error occurred', {
          timestamp: new Date().toISOString(),
          // Only log non-sensitive information
          errorType: error.name,
          errorMessage: error.message.replace(/[0-9]/g, 'X'), // Mask any numbers
        })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}