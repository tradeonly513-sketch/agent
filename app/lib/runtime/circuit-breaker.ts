import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CircuitBreaker');

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before attempting recovery (ms)
  monitoringPeriod: number; // Period to track failures (ms)
  successThreshold: number; // Successes needed in half-open to close
  maxConcurrentRequests: number; // Max concurrent requests allowed
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  rejectedRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  concurrentRequests: number;
  uptime: number;
}

export type CircuitBreakerMetrics = {
  operationName: string;
  duration: number;
  success: boolean;
  error?: Error;
  timestamp: number;
};

/**
 * Circuit Breaker pattern implementation to prevent cascading failures
 * and protect system resources during overload conditions.
 */
export class CircuitBreaker {
  private _state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private _failureCount = 0;
  private _successCount = 0;
  private _totalRequests = 0;
  private _rejectedRequests = 0;
  private _lastFailureTime: number | null = null;
  private _lastSuccessTime: number | null = null;
  private _concurrentRequests = 0;
  private _createdAt = Date.now();
  private _recoveryTimer: NodeJS.Timeout | null = null;
  private _metrics: CircuitBreakerMetrics[] = [];
  private _maxMetricsHistory = 100;

  constructor(
    private _name: string,
    private _options: CircuitBreakerOptions,
  ) {
    logger.debug(`CircuitBreaker '${_name}' initialized`, _options);
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>, operationName: string = 'unknown'): Promise<T> {
    const startTime = Date.now();

    // Check if circuit is open
    if (this._state === CircuitBreakerState.OPEN) {
      this._rejectedRequests++;
      this._recordMetric(operationName, Date.now() - startTime, false, new Error('Circuit breaker is OPEN'));
      throw new Error(`Circuit breaker '${this._name}' is OPEN - rejecting request`);
    }

    // Check concurrent request limit
    if (this._concurrentRequests >= this._options.maxConcurrentRequests) {
      this._rejectedRequests++;
      this._recordMetric(operationName, Date.now() - startTime, false, new Error('Too many concurrent requests'));
      throw new Error(
        `Circuit breaker '${this._name}' - too many concurrent requests (${this._concurrentRequests}/${this._options.maxConcurrentRequests})`,
      );
    }

    // If half-open, only allow limited requests
    if (this._state === CircuitBreakerState.HALF_OPEN && this._concurrentRequests > 0) {
      this._rejectedRequests++;
      this._recordMetric(
        operationName,
        Date.now() - startTime,
        false,
        new Error('Circuit breaker is HALF_OPEN - limited requests'),
      );
      throw new Error(`Circuit breaker '${this._name}' is HALF_OPEN - only one request allowed`);
    }

    this._concurrentRequests++;
    this._totalRequests++;

    try {
      const result = await operation();

      // Operation succeeded
      const duration = Date.now() - startTime;
      this._handleSuccess(duration);
      this._recordMetric(operationName, duration, true);

      return result;
    } catch (error) {
      // Operation failed
      const duration = Date.now() - startTime;
      this._handleFailure(error as Error, duration);
      this._recordMetric(operationName, duration, false, error as Error);

      throw error;
    } finally {
      this._concurrentRequests--;
    }
  }

  /**
   * Handle successful operation
   */
  private _handleSuccess(duration: number): void {
    this._successCount++;
    this._lastSuccessTime = Date.now();

    if (this._state === CircuitBreakerState.HALF_OPEN) {
      // Check if we have enough successes to close the circuit
      if (this._successCount >= this._options.successThreshold) {
        this._transitionToClosed();
      }
    }

    logger.debug(`CircuitBreaker '${this._name}' - Success (${duration}ms), state: ${this._state}`);
  }

  /**
   * Handle failed operation
   */
  private _handleFailure(error: Error, duration: number): void {
    this._failureCount++;
    this._lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (this._state === CircuitBreakerState.CLOSED || this._state === CircuitBreakerState.HALF_OPEN) {
      if (this._shouldOpenCircuit()) {
        this._transitionToOpen();
      }
    }

    logger.warn(`CircuitBreaker '${this._name}' - Failure (${duration}ms): ${error.message}, state: ${this._state}`);
  }

  /**
   * Check if circuit should be opened based on failure threshold
   */
  private _shouldOpenCircuit(): boolean {
    // Check failure count threshold
    if (this._failureCount >= this._options.failureThreshold) {
      return true;
    }

    // Check failure rate within monitoring period
    const recentMetrics = this._metrics.filter((m) => Date.now() - m.timestamp <= this._options.monitoringPeriod);

    if (recentMetrics.length >= this._options.failureThreshold) {
      const recentFailures = recentMetrics.filter((m) => !m.success).length;
      const failureRate = recentFailures / recentMetrics.length;

      // Open if failure rate is above 50%
      return failureRate > 0.5;
    }

    return false;
  }

  /**
   * Transition to OPEN state
   */
  private _transitionToOpen(): void {
    this._state = CircuitBreakerState.OPEN;
    this._scheduleRecoveryAttempt();

    logger.warn(`CircuitBreaker '${this._name}' transitioned to OPEN state`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private _transitionToHalfOpen(): void {
    this._state = CircuitBreakerState.HALF_OPEN;
    this._successCount = 0; // Reset success count for recovery attempt

    logger.info(`CircuitBreaker '${this._name}' transitioned to HALF_OPEN state`);
  }

  /**
   * Transition to CLOSED state
   */
  private _transitionToClosed(): void {
    this._state = CircuitBreakerState.CLOSED;
    this._failureCount = 0;
    this._successCount = 0;

    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer);
      this._recoveryTimer = null;
    }

    logger.info(`CircuitBreaker '${this._name}' transitioned to CLOSED state`);
  }

  /**
   * Schedule recovery attempt after timeout
   */
  private _scheduleRecoveryAttempt(): void {
    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer);
    }

    this._recoveryTimer = setTimeout(() => {
      if (this._state === CircuitBreakerState.OPEN) {
        this._transitionToHalfOpen();
      }

      this._recoveryTimer = null;
    }, this._options.recoveryTimeout);
  }

  /**
   * Record operation metrics
   */
  private _recordMetric(operationName: string, duration: number, success: boolean, error?: Error): void {
    const metric: CircuitBreakerMetrics = {
      operationName,
      duration,
      success,
      error,
      timestamp: Date.now(),
    };

    this._metrics.push(metric);

    // Keep only recent metrics
    if (this._metrics.length > this._maxMetricsHistory) {
      this._metrics = this._metrics.slice(-this._maxMetricsHistory);
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this._state,
      failureCount: this._failureCount,
      successCount: this._successCount,
      totalRequests: this._totalRequests,
      rejectedRequests: this._rejectedRequests,
      lastFailureTime: this._lastFailureTime,
      lastSuccessTime: this._lastSuccessTime,
      concurrentRequests: this._concurrentRequests,
      uptime: Date.now() - this._createdAt,
    };
  }

  /**
   * Get recent metrics
   */
  getMetrics(limit?: number): CircuitBreakerMetrics[] {
    const metrics = this._metrics.slice();
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this._state === CircuitBreakerState.CLOSED;
  }

  /**
   * Check if circuit breaker is accepting requests
   */
  isAcceptingRequests(): boolean {
    return this._state !== CircuitBreakerState.OPEN;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this._state;
  }

  /**
   * Force circuit breaker to open (for testing or emergency)
   */
  forceOpen(): void {
    this._transitionToOpen();
    logger.warn(`CircuitBreaker '${this._name}' forced to OPEN state`);
  }

  /**
   * Force circuit breaker to close (for recovery)
   */
  forceClose(): void {
    this._transitionToClosed();
    logger.info(`CircuitBreaker '${this._name}' forced to CLOSED state`);
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this._state = CircuitBreakerState.CLOSED;
    this._failureCount = 0;
    this._successCount = 0;
    this._totalRequests = 0;
    this._rejectedRequests = 0;
    this._lastFailureTime = null;
    this._lastSuccessTime = null;
    this._concurrentRequests = 0;
    this._metrics = [];

    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer);
      this._recoveryTimer = null;
    }

    logger.info(`CircuitBreaker '${this._name}' reset`);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer);
      this._recoveryTimer = null;
    }

    logger.debug(`CircuitBreaker '${this._name}' destroyed`);
  }
}

/**
 * Circuit Breaker Manager to handle multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static _instance: CircuitBreakerManager;
  private _circuitBreakers = new Map<string, CircuitBreaker>();

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager._instance) {
      CircuitBreakerManager._instance = new CircuitBreakerManager();
    }

    return CircuitBreakerManager._instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this._circuitBreakers.has(name)) {
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 seconds
        monitoringPeriod: 60000, // 1 minute
        successThreshold: 3,
        maxConcurrentRequests: 10,
      };

      const circuitBreaker = new CircuitBreaker(name, { ...defaultOptions, ...options });
      this._circuitBreakers.set(name, circuitBreaker);

      logger.info(`Created circuit breaker '${name}'`);
    }

    return this._circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, circuitBreaker] of this._circuitBreakers.entries()) {
      stats[name] = circuitBreaker.getStats();
    }

    return stats;
  }

  /**
   * Check if any circuit breakers are unhealthy
   */
  hasUnhealthyCircuitBreakers(): boolean {
    for (const circuitBreaker of this._circuitBreakers.values()) {
      if (!circuitBreaker.isHealthy()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of unhealthy circuit breaker names
   */
  getUnhealthyCircuitBreakers(): string[] {
    const unhealthy: string[] = [];

    for (const [name, circuitBreaker] of this._circuitBreakers.entries()) {
      if (!circuitBreaker.isHealthy()) {
        unhealthy.push(name);
      }
    }

    return unhealthy;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this._circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Destroy all circuit breakers
   */
  destroyAll(): void {
    for (const circuitBreaker of this._circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this._circuitBreakers.clear();
    logger.info('All circuit breakers destroyed');
  }
}
