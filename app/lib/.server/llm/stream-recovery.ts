import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('stream-recovery');

export interface StreamRecoveryOptions {
  maxRetries?: number;
  timeout?: number;
  onTimeout?: () => void;
  onRecovery?: () => void;
  circuitBreakerThreshold?: number; // Number of consecutive failures before circuit opens
  circuitBreakerResetTime?: number; // Time in ms before circuit attempts to close
  onProgress?: (message: string) => void; // Progress callback for user notifications
}

export class StreamRecoveryManager {
  private _retryCount = 0;
  private _timeoutHandle: NodeJS.Timeout | null = null;
  private _lastActivity: number = Date.now();
  private _isActive = true;

  // Circuit breaker state
  private _circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private _failureCount = 0;
  private _lastFailureTime = 0;
  private _circuitResetTimer: NodeJS.Timeout | null = null;

  constructor(private _options: StreamRecoveryOptions = {}) {
    this._options = {
      maxRetries: 3,
      timeout: 30000, // 30 seconds default
      circuitBreakerThreshold: 5, // Open circuit after 5 consecutive failures
      circuitBreakerResetTime: 60000, // Try to close circuit after 1 minute
      ..._options,
    };
  }

  startMonitoring() {
    this._resetTimeout();
  }

  updateActivity() {
    this._lastActivity = Date.now();
    this._resetTimeout();

    // Reset failure count on successful activity
    if (this._circuitState === 'half-open' || this._circuitState === 'closed') {
      this._failureCount = 0;
      this._closeCircuit();
    }
  }

  private _resetTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }

    if (!this._isActive) {
      return;
    }

    this._timeoutHandle = setTimeout(() => {
      if (this._isActive) {
        logger.warn('Stream timeout detected');
        this._handleTimeout();
      }
    }, this._options.timeout);
  }

  private _handleTimeout() {
    // Check circuit breaker state first
    if (this._circuitState === 'open') {
      logger.warn('Circuit breaker is open, stopping stream recovery');
      this._options.onProgress?.('Stream recovery stopped - circuit breaker open');
      this.stop();

      return;
    }

    if (this._retryCount >= (this._options.maxRetries || 3)) {
      logger.error('Max retries reached for stream recovery');
      this._options.onProgress?.('Stream recovery failed - max retries reached');
      this._recordFailure();
      this.stop();

      return;
    }

    this._retryCount++;
    logger.info(`Attempting stream recovery (attempt ${this._retryCount})`);
    this._options.onProgress?.(
      `Stream timeout detected - attempting recovery (${this._retryCount}/${this._options.maxRetries || 3})`,
    );

    if (this._options.onTimeout) {
      this._options.onTimeout();
    }

    // Reset monitoring after recovery attempt
    this._resetTimeout();

    if (this._options.onRecovery) {
      this._options.onRecovery();
    }
  }

  stop() {
    this._isActive = false;

    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }

    if (this._circuitResetTimer) {
      clearTimeout(this._circuitResetTimer);
      this._circuitResetTimer = null;
    }
  }

  getStatus() {
    return {
      isActive: this._isActive,
      retryCount: this._retryCount,
      lastActivity: this._lastActivity,
      timeSinceLastActivity: Date.now() - this._lastActivity,
      circuitState: this._circuitState,
      failureCount: this._failureCount,
    };
  }

  private _recordFailure() {
    this._failureCount++;
    this._lastFailureTime = Date.now();

    const threshold = this._options.circuitBreakerThreshold || 5;

    if (this._failureCount >= threshold && this._circuitState === 'closed') {
      this._openCircuit();
    } else if (this._circuitState === 'half-open') {
      // Failed during half-open state, go back to open
      this._openCircuit();
    }
  }

  private _openCircuit() {
    this._circuitState = 'open';
    logger.warn(`Circuit breaker opened after ${this._failureCount} failures`);

    // Schedule circuit reset attempt
    const resetTime = this._options.circuitBreakerResetTime || 60000;
    this._circuitResetTimer = setTimeout(() => {
      this._circuitState = 'half-open';
      logger.info('Circuit breaker moved to half-open state');
    }, resetTime);
  }

  private _closeCircuit() {
    if (this._circuitState !== 'closed') {
      this._circuitState = 'closed';
      this._failureCount = 0;
      logger.info('Circuit breaker closed');

      if (this._circuitResetTimer) {
        clearTimeout(this._circuitResetTimer);
        this._circuitResetTimer = null;
      }
    }
  }
}
