/**
 * Centralized Logging Service
 * Industry-standard structured logging for production environments
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogContext {
  userId?: string
  sessionId?: string
  endpoint?: string
  duration?: number
  [key: string]: any
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO

  private constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.logLevel = envLevel
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const timestamp = new Date().toISOString()
    const logEntry: any = {
      timestamp,
      level,
      message,
      environment: process.env.NODE_ENV || "development",
    }

    if (context) {
      logEntry.context = context
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }
    }

    return logEntry
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const logEntry = this.formatMessage(LogLevel.DEBUG, message, context)
      console.debug(JSON.stringify(logEntry))
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.INFO)) {
      const logEntry = this.formatMessage(LogLevel.INFO, message, context)
      console.info(JSON.stringify(logEntry))
    }
  }

  warn(message: string, context?: LogContext, error?: Error) {
    if (this.shouldLog(LogLevel.WARN)) {
      const logEntry = this.formatMessage(LogLevel.WARN, message, context, error)
      console.warn(JSON.stringify(logEntry))
    }
  }

  error(message: string, context?: LogContext, error?: Error) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logEntry = this.formatMessage(LogLevel.ERROR, message, context, error)
      console.error(JSON.stringify(logEntry))
    }
  }

  /**
   * Log API request/response
   */
  logRequest(method: string, endpoint: string, context?: LogContext) {
    this.info(`${method} ${endpoint}`, {
      ...context,
      endpoint,
      method,
    })
  }

  /**
   * Log API response with duration
   */
  logResponse(method: string, endpoint: string, statusCode: number, duration: number, context?: LogContext) {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO
    const message = `${method} ${endpoint} - ${statusCode} (${duration}ms)`

    if (level === LogLevel.WARN) {
      this.warn(message, { ...context, endpoint, method, statusCode, duration })
    } else {
      this.info(message, { ...context, endpoint, method, statusCode, duration })
    }
  }

  /**
   * Log database operations
   */
  logDbOperation(operation: string, collection: string, duration: number, context?: LogContext) {
    this.debug(`DB ${operation} on ${collection}`, {
      ...context,
      operation,
      collection,
      duration,
    })
  }

  /**
   * Log cache operations
   */
  logCache(operation: "HIT" | "MISS" | "SET" | "DELETE", key: string, context?: LogContext) {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      cacheOperation: operation,
      cacheKey: key,
    })
  }
}

// Export singleton instance
export const logger = Logger.getInstance()
