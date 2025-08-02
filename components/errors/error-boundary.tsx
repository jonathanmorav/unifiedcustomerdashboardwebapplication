"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { log } from "@/lib/logger-client"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
  level?: "page" | "section" | "component"
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null
  private previousResetKeys: Array<string | number> = []

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    }
    this.previousResetKeys = props.resetKeys || []
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = "component" } = this.props
    const { errorCount } = this.state

    // Log error with context
    log.error(`React Error Boundary: ${error.message}`, error, {
      componentStack: errorInfo.componentStack,
      level,
      errorCount: errorCount + 1,
      operation: "react_error_boundary",
    })

    // Update state with error details
    this.setState({
      errorInfo,
      errorCount: errorCount + 1,
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Auto-retry after 5 seconds for first error
    if (errorCount === 0 && !this.props.isolate) {
      this.resetTimeoutId = setTimeout(() => {
        this.resetError()
      }, 5000)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, index) => key !== this.previousResetKeys[index])) {
        this.resetError()
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetError()
    }

    this.previousResetKeys = resetKeys || []
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    const { hasError, error, errorCount } = this.state
    const { children, fallback, level = "component" } = this.props

    if (hasError && error) {
      if (fallback) {
        return <>{fallback}</>
      }

      return (
        <div
          className={`flex flex-col items-center justify-center p-8 ${level === "page" ? "min-h-screen" : level === "section" ? "min-h-[400px]" : "min-h-[200px]"} rounded-lg bg-gray-50 dark:bg-gray-900`}
        >
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {level === "page" ? "Something went wrong" : "Component error"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {level === "page"
                  ? "We encountered an unexpected error. The issue has been logged and we'll look into it."
                  : "This component encountered an error but the rest of the page should still work."}
              </p>
            </div>

            {process.env.NODE_ENV === "development" && (
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  Error details (development only)
                </summary>
                <div className="mt-2 overflow-auto rounded bg-gray-100 p-4 font-mono text-xs dark:bg-gray-800">
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {error.name}: {error.message}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {error.stack}
                  </pre>
                </div>
              </details>
            )}

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                onClick={this.resetError}
                variant="default"
                className="inline-flex items-center"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>

              {level === "page" && (
                <Button onClick={() => (window.location.href = "/")} variant="outline">
                  Go to home
                </Button>
              )}
            </div>

            {errorCount > 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This error has occurred {errorCount} times
              </p>
            )}
          </div>
        </div>
      )
    }

    return children
  }
}
