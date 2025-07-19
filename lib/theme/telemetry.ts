/**
 * Theme telemetry for monitoring and analytics
 */
import { log } from '@/lib/logger'

interface ThemeEvent {
  event: string
  theme: string | null
  systemPreference: string
  storageAvailable: boolean
  timestamp: number
  metadata?: Record<string, any>
}

interface ThemeData {
  theme: string
  resolved: string
  storageAvailable: boolean
  storageError?: string
  systemPreference: string
}

declare global {
  interface Window {
    __themeData?: ThemeData
  }
}

class ThemeTelemetry {
  private events: ThemeEvent[] = []
  private maxEvents = 100 // Limit memory usage

  /**
   * Get current theme data from window
   */
  private getThemeData(): ThemeData {
    if (typeof window !== "undefined" && window.__themeData) {
      return window.__themeData
    }

    // Fallback data
    return {
      theme: "system",
      resolved: "light",
      storageAvailable: true,
      systemPreference: "light",
    }
  }

  /**
   * Track a theme-related event
   */
  track(event: string, metadata?: Record<string, any>) {
    const themeData = this.getThemeData()

    const eventData: ThemeEvent = {
      event,
      theme: themeData.theme,
      systemPreference: themeData.systemPreference,
      storageAvailable: themeData.storageAvailable,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        resolved: themeData.resolved,
        storageError: themeData.storageError,
      },
    }

    // Store event locally
    this.events.push(eventData)
    if (this.events.length > this.maxEvents) {
      this.events.shift() // Remove oldest event
    }

    // Send to analytics service
    this.sendToAnalytics(eventData)

    // Log in development
    if (process.env.NODE_ENV === "development") {
      log.debug("[Theme Telemetry]", {
        event,
        eventData,
        operation: 'theme_telemetry'
      })
    }
  }

  /**
   * Send event to analytics service
   */
  private sendToAnalytics(event: ThemeEvent) {
    // TODO: Replace with actual analytics service (Segment, Mixpanel, etc.)
    if (typeof window !== "undefined" && (window as any).analytics) {
      ;(window as any).analytics.track("theme_event", event)
    }
  }

  /**
   * Track theme switch event
   */
  trackThemeSwitch(oldTheme: string, newTheme: string, trigger: "user" | "system") {
    this.track("theme_switched", {
      oldTheme,
      newTheme,
      trigger,
      duration: this.getThemeDuration(oldTheme),
    })
  }

  /**
   * Track storage error
   */
  trackStorageError(error: Error) {
    this.track("theme_storage_error", {
      errorMessage: error.message,
      errorType: error.name,
      fallback: "system_preference",
    })
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric: string, duration: number) {
    this.track("theme_performance", {
      metric,
      duration,
      exceedsTarget: duration > 50, // 50ms target
    })
  }

  /**
   * Get how long user has been using current theme
   */
  private getThemeDuration(theme: string): number {
    const lastSwitch = this.events
      .filter((e) => e.event === "theme_switched" && e.metadata?.newTheme === theme)
      .pop()

    return lastSwitch ? Date.now() - lastSwitch.timestamp : 0
  }

  /**
   * Get telemetry summary
   */
  getSummary() {
    const themeData = this.getThemeData()
    const themeSwitches = this.events.filter((e) => e.event === "theme_switched")
    const errors = this.events.filter((e) => e.event === "theme_storage_error")
    const performance = this.events.filter((e) => e.event === "theme_performance")

    return {
      currentTheme: themeData.theme,
      resolvedTheme: themeData.resolved,
      storageAvailable: themeData.storageAvailable,
      totalSwitches: themeSwitches.length,
      totalErrors: errors.length,
      averageSwitchTime:
        performance.length > 0
          ? performance.reduce((acc, e) => acc + (e.metadata?.duration || 0), 0) /
            performance.length
          : 0,
      lastEvents: this.events.slice(-10),
    }
  }

  /**
   * Clear telemetry data
   */
  clear() {
    this.events = []
  }
}

// Export singleton instance
export const themeTelemetry = new ThemeTelemetry()

/**
 * React hook for theme telemetry
 */
export function useThemeTelemetry() {
  return {
    track: (event: string, metadata?: Record<string, any>) => themeTelemetry.track(event, metadata),
    trackThemeSwitch: (oldTheme: string, newTheme: string, trigger: "user" | "system" = "user") =>
      themeTelemetry.trackThemeSwitch(oldTheme, newTheme, trigger),
    trackStorageError: (error: Error) => themeTelemetry.trackStorageError(error),
    trackPerformance: (metric: string, duration: number) =>
      themeTelemetry.trackPerformance(metric, duration),
    getSummary: () => themeTelemetry.getSummary(),
  }
}
