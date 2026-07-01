import { useCallback, useState } from 'react';
import type { AppError } from '../types/errors';
import {
  createAppError,
  getErrorMessage,
  isRecoverable,
  shouldDisplayError,
  logError
} from '../lib/errors';

interface UseErrorHandlerOptions {
  onError?: (error: AppError) => void;
  autoDisplay?: boolean;
  autoLog?: boolean;
}

interface UseErrorHandlerReturn {
  error: AppError | null;
  hasError: boolean;
  isRecoverable: boolean;
  errorMessage: string;
  handleError: (error: unknown) => void;
  clearError: () => void;
  retryAction?: () => void;
}

/**
 * Hook for standardized error handling in React components
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const { onError, autoDisplay = true, autoLog = true } = options;

  const [error, setError] = useState<AppError | null>(null);

  const handleError = useCallback((rawError: unknown) => {
    const appError = createAppError(rawError);

    if (autoLog) {
      logError(appError);
    }

    if (shouldDisplayError(appError) && autoDisplay) {
      setError(appError);
    }

    onError?.(appError);
  }, [onError, autoDisplay, autoLog]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    hasError: error !== null,
    isRecoverable: error ? isRecoverable(error) : false,
    errorMessage: error ? getErrorMessage(error) : '',
    handleError,
    clearError,
  };
}

