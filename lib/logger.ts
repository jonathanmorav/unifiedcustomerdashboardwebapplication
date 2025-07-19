import winston from 'winston'
import { getEnv } from '@/lib/env'

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
}

// Add colors to winston
winston.addColors(colors)

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.stack || ''}`
  ),
)

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels,
  format,
  defaultMeta: { service: 'unified-dashboard' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development' ? consoleFormat : format,
    }),
    // File transport for errors
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
})

// Create a stream object for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

// Redact sensitive information
const redactSensitiveInfo = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj
  
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'authorization',
    'cookie',
    'api_key',
    'apiKey',
    'access_token',
    'refresh_token',
    'ssn',
    'accountNumber',
    'email',
    'dwolla_customer_id',
  ]
  
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj }
  
  for (const key in redacted) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      redacted[key] = '[REDACTED]'
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveInfo(redacted[key])
    }
  }
  
  return redacted
}

// Helper functions for logging with context
export const logWithContext = (
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context?: Record<string, any>
) => {
  const safeContext = context ? redactSensitiveInfo(context) : {}
  logger[level](message, safeContext)
}

// Structured logging helpers
export const log = {
  error: (message: string, error?: Error, context?: Record<string, any>) => {
    logWithContext('error', message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    })
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    logWithContext('warn', message, context)
  },
  
  info: (message: string, context?: Record<string, any>) => {
    logWithContext('info', message, context)
  },
  
  debug: (message: string, context?: Record<string, any>) => {
    logWithContext('debug', message, context)
  },
  
  // Special logger for API requests
  api: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: Record<string, any>
  ) => {
    logWithContext('info', 'API Request', {
      method,
      path,
      statusCode,
      duration,
      ...context,
    })
  },
  
  // Special logger for security events
  security: (
    event: string,
    userId?: string,
    context?: Record<string, any>
  ) => {
    logWithContext('warn', `Security Event: ${event}`, {
      userId,
      event,
      ...context,
    })
  },
  
  // Special logger for performance metrics
  performance: (
    operation: string,
    duration: number,
    context?: Record<string, any>
  ) => {
    logWithContext('info', `Performance: ${operation}`, {
      operation,
      duration,
      ...context,
    })
  },
}

// Export default logger for backward compatibility
export default logger