"use client"

import { useTheme as useNextTheme } from "next-themes"
import { useEffect, useState } from "react"
import { themeTelemetry } from "@/lib/theme/telemetry-client"

export type Theme = "light" | "dark" | "system"

interface UseThemeReturn {
  theme: Theme | undefined
  setTheme: (theme: Theme) => void
  systemTheme: "light" | "dark" | undefined
  resolvedTheme: "light" | "dark" | undefined
  isLoading: boolean
  themes: Theme[]
}

/**
 * Enhanced theme hook with telemetry and performance tracking
 */
export function useTheme(): UseThemeReturn {
  const { theme, setTheme: setNextTheme, systemTheme, resolvedTheme, themes } = useNextTheme()

  const [isLoading, setIsLoading] = useState(true)
  const [performanceStart, setPerformanceStart] = useState<number | null>(null)

  // Track theme switches with performance metrics
  const setTheme = (newTheme: Theme) => {
    const oldTheme = theme
    const startTime = performance.now()
    setPerformanceStart(startTime)

    try {
      setNextTheme(newTheme)

      // Track theme switch
      if (oldTheme && oldTheme !== newTheme) {
        themeTelemetry.trackThemeSwitch(oldTheme, newTheme, "user")
      }
    } catch (error) {
      // Track storage errors
      if (error instanceof Error) {
        themeTelemetry.trackStorageError(error)
      }
    }
  }

  // Track performance when theme changes
  useEffect(() => {
    if (performanceStart && theme) {
      const duration = performance.now() - performanceStart
      themeTelemetry.trackPerformance("theme_switch", duration)
      setPerformanceStart(null)
    }
  }, [theme, performanceStart])

  // Track initial load
  useEffect(() => {
    setIsLoading(false)
    themeTelemetry.track("theme_loaded", {
      initialTheme: theme,
      systemTheme,
    })
  }, [theme, systemTheme])

  return {
    theme: theme as Theme | undefined,
    setTheme,
    systemTheme: systemTheme as "light" | "dark" | undefined,
    resolvedTheme: resolvedTheme as "light" | "dark" | undefined,
    isLoading,
    themes: themes as Theme[],
  }
}

/**
 * Hook to check if localStorage is available
 */
export function useLocalStorageAvailable(): boolean {
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    try {
      const testKey = "__localStorage_test__"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      setAvailable(true)
    } catch {
      setAvailable(false)
    }
  }, [])

  return available
}
