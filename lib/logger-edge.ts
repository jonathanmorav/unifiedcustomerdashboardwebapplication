/**
 * Edge-compatible logger for Next.js middleware
 * Uses console methods instead of Winston to avoid Node.js APIs
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LogContext {
  [key: string]: any
}

class EdgeLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatMessage('error', message, context))
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context))
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('info', message, context))
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }
}

// Export a singleton instance
export const log = new EdgeLogger()

// For compatibility with the main logger interface
export const logger = {
  error: (msg: string, ctx?: any) => log.error(msg, ctx),
  warn: (msg: string, ctx?: any) => log.warn(msg, ctx),
  info: (msg: string, ctx?: any) => log.info(msg, ctx),
  debug: (msg: string, ctx?: any) => log.debug(msg, ctx),
}