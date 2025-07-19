/**
 * Client-side logger for browser environments
 * Does not use any Node.js-specific modules
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LogContext {
  [key: string]: any
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  error(message: string, error?: Error | null, context?: LogContext) {
    const errorContext = {
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }),
    }
    console.error(this.formatMessage('error', message, errorContext))
    
    // In production, you could send errors to a monitoring service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Send to error monitoring service
      // window.errorReporter?.log(message, errorContext)
    }
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context))
  }

  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, context))
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }
}

// Export a singleton instance
export const log = new ClientLogger()

// For compatibility with the server logger interface
export const logger = {
  error: (msg: string, error?: any, ctx?: any) => {
    if (error instanceof Error) {
      log.error(msg, error, ctx)
    } else {
      log.error(msg, null, { ...ctx, error })
    }
  },
  warn: (msg: string, ctx?: any) => log.warn(msg, ctx),
  info: (msg: string, ctx?: any) => log.info(msg, ctx),
  debug: (msg: string, ctx?: any) => log.debug(msg, ctx),
}