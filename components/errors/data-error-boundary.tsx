'use client'

import React, { useState } from 'react'
import { ErrorBoundary } from './error-boundary'
import { Button } from '@/components/ui/button'
import { RefreshCw, WifiOff, AlertCircle } from 'lucide-react'

interface Props {
  children: React.ReactNode
  onRetry?: () => void
  dataSource?: string
}

export function DataErrorBoundary({ children, onRetry, dataSource = 'data' }: Props) {
  const [retryCount, setRetryCount] = useState(0)

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    if (onRetry) {
      onRetry()
    }
  }

  const dataErrorFallback = (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-orange-100 dark:bg-orange-900/20 p-3">
            <WifiOff className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Failed to load {dataSource}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We couldn't fetch the data from our servers. This might be a temporary issue.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            variant="default"
            className="inline-flex items-center"
            disabled={retryCount > 3}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {retryCount > 0 ? `Retry (${retryCount}/3)` : 'Retry'}
          </Button>

          {retryCount > 3 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Multiple retry attempts failed. Please check your connection and try again later.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              Troubleshooting tips
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <li>• Check your internet connection</li>
              <li>• Try refreshing the page</li>
              <li>• Clear your browser cache</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={dataErrorFallback}
      level="component"
      resetKeys={[retryCount]}
      onError={(error) => {
        // Log data fetch errors with context
        console.error(`Data fetch error for ${dataSource}:`, error)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}