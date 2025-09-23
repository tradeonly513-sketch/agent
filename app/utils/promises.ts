export function withResolvers<T>(): PromiseWithResolvers<T> {
  if (typeof Promise.withResolvers === 'function') {
    return Promise.withResolvers();
  }

  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  return {
    resolve,
    reject,
    promise,
  };
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public timeout: number,
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage || `Operation timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    // Cleanup timeout if original promise resolves first
    promise.finally(() => clearTimeout(timeoutId));
  });

  return Promise.race([promise, timeoutPromise]);
}

export function withAbortableTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortSignal?: AbortSignal,
  errorMessage?: string,
): Promise<T> {
  if (abortSignal?.aborted) {
    return Promise.reject(new Error('Operation was aborted'));
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage || `Operation timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    const cleanup = () => clearTimeout(timeoutId);

    // Cleanup on abort
    abortSignal?.addEventListener('abort', () => {
      cleanup();
      reject(new Error('Operation was aborted'));
    });

    // Cleanup timeout if original promise resolves first
    promise.finally(cleanup);
  });

  return Promise.race([promise, timeoutPromise]);
}
