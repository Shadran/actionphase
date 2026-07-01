import { AxiosError } from 'axios';
import type {
  ApiError,
  AppError,
  ErrorContext
} from '../types/errors';
import {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  ERROR_MESSAGES,
  STATUS_CODE_TO_ERROR_TYPE
} from '../types/errors';
import { logger } from '@/services/LoggingService';

/**
 * Creates a standardized AppError from various error sources
 */
export function createAppError(
  error: unknown,
  context?: Partial<ErrorContext>
): AppError {
  const baseContext: ErrorContext = {
    type: ErrorType.UNKNOWN_ERROR,
    category: ErrorCategory.NON_RECOVERABLE,
    severity: ErrorSeverity.MEDIUM,
    userMessage: ERROR_MESSAGES.UNKNOWN_ERROR,
    timestamp: new Date(),
    ...context,
  };

  if (isAxiosError(error)) {
    return handleAxiosError(error, baseContext);
  }

  if (error instanceof Error) {
    return handleGenericError(error, baseContext);
  }

  // Unknown error type
  const appError = new Error(baseContext.userMessage) as AppError;
  appError.type = baseContext.type;
  appError.context = baseContext;
  return appError;
}

/**
 * Handles Axios HTTP errors with structured backend responses
 */
function handleAxiosError(error: AxiosError, baseContext: ErrorContext): AppError {
  const statusCode = error.response?.status;
  const apiError = error.response?.data as ApiError;

  const errorType = statusCode && statusCode in STATUS_CODE_TO_ERROR_TYPE
    ? STATUS_CODE_TO_ERROR_TYPE[statusCode as keyof typeof STATUS_CODE_TO_ERROR_TYPE]
    : ErrorType.NETWORK_ERROR;

  let userMessage: string = ERROR_MESSAGES.UNKNOWN_ERROR;
  let category: ErrorCategory = ErrorCategory.NON_RECOVERABLE;
  let severity: ErrorSeverity = ErrorSeverity.MEDIUM;

  // Extract user-friendly message from API response
  if (apiError?.error) {
    userMessage = apiError.error;
  } else if (apiError?.status) {
    userMessage = apiError.status;
  }

  // Categorize by status code
  switch (statusCode) {
    case 400:
    case 422:
      category = ErrorCategory.RECOVERABLE;
      severity = ErrorSeverity.LOW;
      break;
    case 401:
      // Use API error message if available, otherwise use default session expired message
      if (!apiError?.error && !apiError?.status) {
        userMessage = ERROR_MESSAGES.SESSION_EXPIRED;
      }
      category = ErrorCategory.RECOVERABLE;
      severity = ErrorSeverity.HIGH;
      break;
    case 403:
      // Use API error message if available, otherwise use default unauthorized message
      if (!apiError?.error && !apiError?.status) {
        userMessage = ERROR_MESSAGES.UNAUTHORIZED;
      }
      category = ErrorCategory.NON_RECOVERABLE;
      severity = ErrorSeverity.MEDIUM;
      break;
    case 404:
      category = ErrorCategory.NON_RECOVERABLE;
      severity = ErrorSeverity.LOW;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      userMessage = ERROR_MESSAGES.SERVER_ERROR;
      category = ErrorCategory.RECOVERABLE;
      severity = ErrorSeverity.HIGH;
      break;
    default:
      if (!statusCode) {
        userMessage = ERROR_MESSAGES.NETWORK_UNAVAILABLE;
        category = ErrorCategory.RECOVERABLE;
        severity = ErrorSeverity.HIGH;
      }
      break;
  }

  const context: ErrorContext = {
    ...baseContext,
    type: errorType,
    category,
    severity,
    userMessage,
    technicalMessage: error.message,
  };

  const appError = new Error(userMessage) as AppError;
  appError.type = errorType;
  appError.statusCode = statusCode;
  appError.apiError = apiError;
  appError.context = context;

  return appError;
}

/**
 * Handles generic JavaScript errors
 */
function handleGenericError(error: Error, baseContext: ErrorContext): AppError {
  const context: ErrorContext = {
    ...baseContext,
    type: ErrorType.COMPONENT_ERROR,
    category: ErrorCategory.NON_RECOVERABLE,
    severity: ErrorSeverity.MEDIUM,
    userMessage: ERROR_MESSAGES.UNKNOWN_ERROR,
    technicalMessage: error.message,
  };

  const appError = error as AppError;
  appError.type = context.type;
  appError.context = context;

  return appError;
}

/**
 * Type guard to check if an error is an AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return error !== null &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true;
}

/**
 * Extracts a user-friendly error message from an AppError
 */
export function getErrorMessage(error: AppError): string {
  return error.context?.userMessage || error.message || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Determines if an error is recoverable (user can retry)
 */
export function isRecoverable(error: AppError): boolean {
  return error.context?.category === ErrorCategory.RECOVERABLE;
}

/**
 * Determines if an error should be displayed to the user
 */
export function shouldDisplayError(error: AppError): boolean {
  return error.context?.category !== ErrorCategory.SILENT;
}

/**
 * Gets recovery actions for an error
 */
export function getRecoveryActions(error: AppError): string[] {
  const actions: string[] = error.context?.recoveryActions || [];

  // Add default recovery actions based on error type
  switch (error.type) {
    case ErrorType.AUTHENTICATION_ERROR:
      actions.push('Log in again');
      break;
    case ErrorType.NETWORK_ERROR:
      actions.push('Check your internet connection', 'Try again later');
      break;
    case ErrorType.VALIDATION_ERROR:
      actions.push('Check your input and try again');
      break;
    case ErrorType.API_ERROR:
      if (error.statusCode && error.statusCode >= 500) {
        actions.push('Try again in a few minutes');
      }
      break;
  }

  return actions;
}

/**
 * Logs an error with appropriate level and context
 * Uses LoggingService for structured logging with correlation ID tracking
 */
export function logError(error: AppError, additionalContext?: Record<string, unknown>): void {
  const logData = {
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    context: error.context,
    stack: error.stack,
    ...additionalContext,
  };

  const severity = error.context?.severity || ErrorSeverity.MEDIUM;

  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      logger.error('Application error', logData);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn('Application warning', logData);
      break;
    case ErrorSeverity.LOW:
      logger.info('Application info', logData);
      break;
    default:
      logger.debug('Application debug', logData);
  }
}

