import log from 'loglevel';

/**
 * LoggingService provides structured logging for the frontend application
 *
 * Features:
 * - Environment-based log levels (development: DEBUG, production: ERROR)
 * - Correlation ID tracking from API responses
 * - Structured log metadata
 * - Production build optimization (tree-shaking friendly)
 *
 * Usage:
 * ```ts
 * import { logger } from '@/services/LoggingService';
 *
 * logger.debug('User action', { userId: 123, action: 'click' });
 * logger.info('API request', { endpoint: '/api/games', method: 'GET' });
 * logger.warn('Validation failed', { field: 'email', error: 'invalid' });
 * logger.error('API error', { error: err, correlationId: 'abc-123' });
 * ```
 */

// Log level configuration based on environment
const LOG_LEVELS = {
  development: 'debug',
  test: 'error',
  production: 'error',
} as const;

// Current correlation ID (from most recent API response)
let currentCorrelationId: string | null = null;

/**
 * Initialize the logging service with environment-appropriate log level
 */
function initializeLogging(): void {
  const env = import.meta.env.MODE || 'development';
  const logLevel = LOG_LEVELS[env as keyof typeof LOG_LEVELS] || 'debug';

  log.setLevel(logLevel as log.LogLevelDesc);

  // Log initialization in development only
  if (env === 'development') {
    log.debug(`[LoggingService] Initialized with level: ${logLevel}, environment: ${env}`);
  }
}

/**
 * Set the current correlation ID (typically from API response headers)
 */
export function setCorrelationId(correlationId: string | null): void {
  currentCorrelationId = correlationId;
}

/**
 * Get the current correlation ID
 */
function getCorrelationId(): string | null {
  return currentCorrelationId;
}

/**
 * Add correlation ID to log metadata if available
 */
function enrichMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  const enriched = { ...metadata };

  if (currentCorrelationId) {
    enriched.correlationId = currentCorrelationId;
  }

  // Add timestamp
  enriched.timestamp = new Date().toISOString();

  return enriched;
}

/**
 * Format log message with metadata
 */
function formatLogMessage(message: string, metadata?: Record<string, unknown>): unknown[] {
  if (!metadata || Object.keys(metadata).length === 0) {
    return [message];
  }

  return [message, enrichMetadata(metadata)];
}

/**
 * Structured logger with correlation ID support
 */
export const logger = {
  /**
   * Debug level - for detailed diagnostic information
   * Only visible in development mode
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    log.debug(...formatLogMessage(message, metadata));
  },

  /**
   * Info level - for general informational messages
   * Visible in development mode
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    log.info(...formatLogMessage(message, metadata));
  },

  /**
   * Warn level - for warning messages
   * Visible in development and production
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    log.warn(...formatLogMessage(message, metadata));
  },

  /**
   * Error level - for error messages
   * Always visible (development and production)
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    // If metadata contains an Error object, extract relevant info
    const enrichedMetadata = { ...metadata };

    if (enrichedMetadata.error instanceof Error) {
      const error = enrichedMetadata.error as Error;
      enrichedMetadata.errorMessage = error.message;
      enrichedMetadata.errorStack = error.stack;
      enrichedMetadata.errorName = error.name;
      // Remove the original Error object as it doesn't serialize well
      delete enrichedMetadata.error;
    }

    log.error(...formatLogMessage(message, enrichedMetadata));
  },

  /**
   * Set the log level dynamically (useful for testing)
   */
  setLevel(level: log.LogLevelDesc): void {
    log.setLevel(level);
  },

  /**
   * Get the current log level
   */
  getLevel(): log.LogLevelDesc {
    return log.getLevel() as log.LogLevelDesc;
  },
};

// Initialize logging on module load
initializeLogging();
