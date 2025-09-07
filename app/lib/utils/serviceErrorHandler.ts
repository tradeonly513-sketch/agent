import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';

export interface ServiceError {
  code?: string;
  message: string;
  details?: any;
  service: string;
  operation: string;
}

export class ServiceErrorHandler {
  static handle(error: unknown, context: { service: string; operation: string }): ServiceError {
    let serviceError: ServiceError;

    if (error instanceof Error) {
      serviceError = {
        message: error.message,
        service: context.service,
        operation: context.operation,
      };
    } else if (typeof error === 'string') {
      serviceError = {
        message: error,
        service: context.service,
        operation: context.operation,
      };
    } else if (error && typeof error === 'object' && 'message' in error) {
      serviceError = {
        message: String(error.message),
        code: 'code' in error ? String(error.code) : undefined,
        details: error,
        service: context.service,
        operation: context.operation,
      };
    } else {
      serviceError = {
        message: 'Unknown error occurred',
        service: context.service,
        operation: context.operation,
        details: error,
      };
    }

    // Log the error
    logStore.logError(`${context.service} ${context.operation} failed`, serviceError);

    return serviceError;
  }

  static handleApiError(response: Response, data?: any): ServiceError {
    return {
      message: data?.error || data?.message || `${response.status} ${response.statusText}`,
      code: String(response.status),
      details: data,
      service: 'API',
      operation: 'Request',
    };
  }

  static showToast(error: ServiceError, customMessage?: string) {
    const message = customMessage || `${error.service} ${error.operation}: ${error.message}`;
    toast.error(message);
  }

  static getConnectionErrorMessage(error: ServiceError): string {
    const commonMessages: Record<string, string> = {
      '401': 'Invalid or expired token. Please check your credentials.',
      '403': 'Access forbidden. Please verify your token permissions.',
      '404': 'Service endpoint not found. Please check your configuration.',
      '429': 'Rate limit exceeded. Please wait before trying again.',
      '500': 'Server error. Please try again later.',
      '502': 'Bad gateway. The service may be temporarily unavailable.',
      '503': 'Service unavailable. Please try again later.',
      '504': 'Gateway timeout. The service is taking too long to respond.',
    };

    if (error.code && commonMessages[error.code]) {
      return commonMessages[error.code];
    }

    return error.message;
  }

  static createRetryHandler(operation: () => Promise<void>, maxRetries = 3, delay = 1000) {
    return async (service: string, operationName: string) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await operation();
          return;
        } catch (error) {
          const serviceError = this.handle(error, { service, operation: operationName });

          if (attempt === maxRetries) {
            this.showToast(serviceError);
            throw serviceError;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    };
  }
}

export const handleServiceError = ServiceErrorHandler.handle;
export const showServiceError = ServiceErrorHandler.showToast;
