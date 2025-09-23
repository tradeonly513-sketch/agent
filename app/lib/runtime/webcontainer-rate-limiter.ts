import { CircuitBreaker, CircuitBreakerManager } from './circuit-breaker';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('WebContainerRateLimiter');

export interface RateLimiterOptions {
  maxOperationsPerSecond: number;
  maxConcurrentOperations: number;
  queueLimit: number;
  operationTimeout: number;
  burstSize?: number; // Allow short bursts of operations
}

export interface QueuedOperation<T> {
  operation: () => Promise<T>;
  operationType: WebContainerOperationType;
  priority: OperationPriority;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  timestamp: number;
  timeoutId?: NodeJS.Timeout;
}

export enum WebContainerOperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MKDIR = 'mkdir',
  WATCH = 'watch',
  SPAWN = 'spawn',
  KILL = 'kill',
}

export enum OperationPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface RateLimiterStats {
  activeOperations: number;
  queuedOperations: number;
  totalOperations: number;
  rejectedOperations: number;
  averageWaitTime: number;
  operationsPerSecond: number;
  lastOperationTime: number;
  operationCounts: Record<WebContainerOperationType, number>;
}

/**
 * Rate limiter for WebContainer file system operations
 * Prevents system overload and ensures responsive performance
 */
export class WebContainerRateLimiter {
  private _options: RateLimiterOptions;
  private _operationQueue: QueuedOperation<unknown>[] = [];
  private _activeOperations = 0;
  private _totalOperations = 0;
  private _rejectedOperations = 0;
  private _operationTimestamps: number[] = [];
  private _waitTimes: number[] = [];
  private _operationCounts: Record<WebContainerOperationType, number> = {
    [WebContainerOperationType.READ]: 0,
    [WebContainerOperationType.WRITE]: 0,
    [WebContainerOperationType.DELETE]: 0,
    [WebContainerOperationType.MKDIR]: 0,
    [WebContainerOperationType.WATCH]: 0,
    [WebContainerOperationType.SPAWN]: 0,
    [WebContainerOperationType.KILL]: 0,
  };
  private _lastOperationTime = 0;
  private _tokenBucket: number;
  private _lastTokenRefill = Date.now();
  private _circuitBreaker: CircuitBreaker;
  private _processingQueue = false;

  constructor(options: RateLimiterOptions) {
    this._options = {
      burstSize: options.maxOperationsPerSecond * 2, // Default burst is 2x rate
      ...options,
    };

    this._tokenBucket = this._options.burstSize!;

    // Initialize circuit breaker for rate limiter
    const circuitBreakerManager = CircuitBreakerManager.getInstance();
    this._circuitBreaker = circuitBreakerManager.getCircuitBreaker('webcontainer-rate-limiter', {
      failureThreshold: 10,
      recoveryTimeout: 5000,
      monitoringPeriod: 30000,
      successThreshold: 5,
      maxConcurrentRequests: this._options.maxConcurrentOperations,
    });

    // Set up token bucket refill
    setInterval(() => {
      this._refillTokens();
    }, 100); // Refill every 100ms

    logger.info('WebContainer rate limiter initialized', this._options);
  }

  /**
   * Execute an operation through the rate limiter
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationType: WebContainerOperationType,
    priority: OperationPriority = OperationPriority.NORMAL,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedOperation: QueuedOperation<T> = {
        operation,
        operationType,
        priority,
        resolve: resolve as (value: T | PromiseLike<T>) => void,
        reject,
        timestamp: Date.now(),
      };

      // Check if we should reject immediately
      if (this._operationQueue.length >= this._options.queueLimit) {
        this._rejectedOperations++;
        logger.warn(`Operation rejected - queue limit exceeded (${this._options.queueLimit})`);
        reject(new Error('WebContainer rate limiter: Queue limit exceeded'));

        return;
      }

      // Check circuit breaker
      if (!this._circuitBreaker.isAcceptingRequests()) {
        this._rejectedOperations++;
        logger.warn('Operation rejected - circuit breaker is open');
        reject(new Error('WebContainer rate limiter: Circuit breaker is open'));

        return;
      }

      // Set operation timeout
      queuedOperation.timeoutId = setTimeout(() => {
        this._removeFromQueue(queuedOperation as QueuedOperation<unknown>);
        this._rejectedOperations++;
        reject(new Error(`WebContainer operation timeout (${this._options.operationTimeout}ms)`));
      }, this._options.operationTimeout);

      // Add to queue with priority sorting
      this._addToQueue(queuedOperation as QueuedOperation<unknown>);

      // Process queue
      this._processQueue();
    });
  }

  /**
   * Add operation to queue with priority handling
   */
  private _addToQueue(operation: QueuedOperation<unknown>): void {
    // Insert operation based on priority (higher priority first)
    let insertIndex = this._operationQueue.length;

    for (let i = 0; i < this._operationQueue.length; i++) {
      if (this._operationQueue[i].priority < operation.priority) {
        insertIndex = i;
        break;
      }
    }

    this._operationQueue.splice(insertIndex, 0, operation);
    logger.debug(
      `Operation queued (${operation.operationType}, priority: ${operation.priority}), queue size: ${this._operationQueue.length}`,
    );
  }

  /**
   * Remove operation from queue
   */
  private _removeFromQueue(operation: QueuedOperation<unknown>): void {
    const index = this._operationQueue.indexOf(operation);

    if (index > -1) {
      this._operationQueue.splice(index, 1);

      if (operation.timeoutId) {
        clearTimeout(operation.timeoutId);
      }
    }
  }

  /**
   * Process the operation queue
   */
  private async _processQueue(): Promise<void> {
    if (this._processingQueue) {
      return;
    }

    this._processingQueue = true;

    try {
      while (this._operationQueue.length > 0 && this._canExecuteOperation()) {
        const operation = this._operationQueue.shift();

        if (!operation) {
          continue;
        }

        // Clear timeout since we're executing
        if (operation.timeoutId) {
          clearTimeout(operation.timeoutId);
        }

        // Check if operation has been waiting too long
        const waitTime = Date.now() - operation.timestamp;
        this._waitTimes.push(waitTime);

        // Keep only recent wait times for average calculation
        if (this._waitTimes.length > 100) {
          this._waitTimes = this._waitTimes.slice(-100);
        }

        this._executeOperation(operation);
      }
    } finally {
      this._processingQueue = false;
    }
  }

  /**
   * Check if we can execute more operations
   */
  private _canExecuteOperation(): boolean {
    // Check concurrent operation limit
    if (this._activeOperations >= this._options.maxConcurrentOperations) {
      return false;
    }

    // Check rate limit using token bucket
    if (this._tokenBucket < 1) {
      return false;
    }

    return true;
  }

  /**
   * Execute a single operation
   */
  private async _executeOperation(queuedOperation: QueuedOperation<unknown>): Promise<void> {
    this._activeOperations++;
    this._totalOperations++;
    this._operationCounts[queuedOperation.operationType]++;
    this._lastOperationTime = Date.now();

    // Consume a token
    this._tokenBucket = Math.max(0, this._tokenBucket - 1);

    // Track operation timing
    this._operationTimestamps.push(this._lastOperationTime);

    // Keep only recent timestamps for rate calculation (last 10 seconds)
    const cutoff = this._lastOperationTime - 10000;
    this._operationTimestamps = this._operationTimestamps.filter((t) => t > cutoff);

    try {
      // Execute through circuit breaker
      const result = await this._circuitBreaker.execute(
        queuedOperation.operation,
        `${queuedOperation.operationType}-operation`,
      );

      queuedOperation.resolve(result);

      logger.debug(`Operation completed (${queuedOperation.operationType}), active: ${this._activeOperations}`);
    } catch (error) {
      logger.warn(`Operation failed (${queuedOperation.operationType}):`, error);
      queuedOperation.reject(error);
    } finally {
      this._activeOperations--;

      // Continue processing queue if there are more operations
      if (this._operationQueue.length > 0) {
        // Small delay to prevent tight loop
        setTimeout(() => this._processQueue(), 10);
      }
    }
  }

  /**
   * Refill token bucket based on rate limit
   */
  private _refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this._lastTokenRefill;

    if (timePassed > 0) {
      const tokensToAdd = (timePassed / 1000) * this._options.maxOperationsPerSecond;
      this._tokenBucket = Math.min(this._options.burstSize!, this._tokenBucket + tokensToAdd);
      this._lastTokenRefill = now;
    }
  }

  /**
   * Get current rate limiter statistics
   */
  getStats(): RateLimiterStats {
    const now = Date.now();
    const recentTimestamps = this._operationTimestamps.filter((t) => t > now - 1000);

    return {
      activeOperations: this._activeOperations,
      queuedOperations: this._operationQueue.length,
      totalOperations: this._totalOperations,
      rejectedOperations: this._rejectedOperations,
      averageWaitTime:
        this._waitTimes.length > 0 ? this._waitTimes.reduce((a, b) => a + b, 0) / this._waitTimes.length : 0,
      operationsPerSecond: recentTimestamps.length,
      lastOperationTime: this._lastOperationTime,
      operationCounts: { ...this._operationCounts },
    };
  }

  /**
   * Check if rate limiter is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();

    // Consider unhealthy if queue is backing up significantly
    if (stats.queuedOperations > this._options.queueLimit * 0.8) {
      return false;
    }

    // Consider unhealthy if average wait time is too high
    if (stats.averageWaitTime > this._options.operationTimeout * 0.5) {
      return false;
    }

    // Check circuit breaker health
    if (!this._circuitBreaker.isHealthy()) {
      return false;
    }

    return true;
  }

  /**
   * Reset rate limiter statistics
   */
  reset(): void {
    this._operationQueue.length = 0;
    this._activeOperations = 0;
    this._totalOperations = 0;
    this._rejectedOperations = 0;
    this._operationTimestamps.length = 0;
    this._waitTimes.length = 0;
    this._lastOperationTime = 0;
    this._tokenBucket = this._options.burstSize!;
    this._lastTokenRefill = Date.now();

    // Reset operation counts
    Object.keys(this._operationCounts).forEach((key) => {
      this._operationCounts[key as WebContainerOperationType] = 0;
    });

    this._circuitBreaker.reset();

    logger.info('WebContainer rate limiter reset');
  }

  /**
   * Update rate limiter options
   */
  updateOptions(newOptions: Partial<RateLimiterOptions>): void {
    this._options = { ...this._options, ...newOptions };

    if (newOptions.burstSize) {
      this._tokenBucket = Math.min(this._tokenBucket, newOptions.burstSize);
    }

    logger.info('WebContainer rate limiter options updated', this._options);
  }

  /**
   * Get current configuration
   */
  getOptions(): RateLimiterOptions {
    return { ...this._options };
  }

  /**
   * Force-clear the operation queue (emergency use)
   */
  clearQueue(): void {
    const clearedCount = this._operationQueue.length;

    // Reject all pending operations
    this._operationQueue.forEach((operation) => {
      if (operation.timeoutId) {
        clearTimeout(operation.timeoutId);
      }

      operation.reject(new Error('Operation cancelled - queue cleared'));
    });

    this._operationQueue.length = 0;
    this._rejectedOperations += clearedCount;

    logger.warn(`Cleared ${clearedCount} operations from queue`);
  }
}

/**
 * Global rate limiter manager for WebContainer operations
 */
export class WebContainerRateLimiterManager {
  private static _instance: WebContainerRateLimiterManager;
  private _rateLimiters = new Map<string, WebContainerRateLimiter>();
  private _defaultOptions: RateLimiterOptions = {
    maxOperationsPerSecond: 50, // Conservative limit for file operations
    maxConcurrentOperations: 10, // Prevent WebContainer API overload
    queueLimit: 200, // Large queue for burst handling
    operationTimeout: 30000, // 30 second timeout
    burstSize: 100, // Allow short bursts
  };

  static getInstance(): WebContainerRateLimiterManager {
    if (!WebContainerRateLimiterManager._instance) {
      WebContainerRateLimiterManager._instance = new WebContainerRateLimiterManager();
    }

    return WebContainerRateLimiterManager._instance;
  }

  /**
   * Get or create a rate limiter for a specific context
   */
  getRateLimiter(name: string = 'default', options?: Partial<RateLimiterOptions>): WebContainerRateLimiter {
    if (!this._rateLimiters.has(name)) {
      const rateLimiter = new WebContainerRateLimiter({
        ...this._defaultOptions,
        ...options,
      });

      this._rateLimiters.set(name, rateLimiter);
      logger.info(`Created WebContainer rate limiter '${name}'`);
    }

    return this._rateLimiters.get(name)!;
  }

  /**
   * Get all rate limiter statistics
   */
  getAllStats(): Record<string, RateLimiterStats> {
    const stats: Record<string, RateLimiterStats> = {};

    for (const [name, rateLimiter] of this._rateLimiters.entries()) {
      stats[name] = rateLimiter.getStats();
    }

    return stats;
  }

  /**
   * Check if any rate limiters are unhealthy
   */
  hasUnhealthyRateLimiters(): boolean {
    for (const rateLimiter of this._rateLimiters.values()) {
      if (!rateLimiter.isHealthy()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of unhealthy rate limiter names
   */
  getUnhealthyRateLimiters(): string[] {
    const unhealthy: string[] = [];

    for (const [name, rateLimiter] of this._rateLimiters.entries()) {
      if (!rateLimiter.isHealthy()) {
        unhealthy.push(name);
      }
    }

    return unhealthy;
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const rateLimiter of this._rateLimiters.values()) {
      rateLimiter.reset();
    }
    logger.info('All WebContainer rate limiters reset');
  }

  /**
   * Update default options for new rate limiters
   */
  updateDefaultOptions(options: Partial<RateLimiterOptions>): void {
    this._defaultOptions = { ...this._defaultOptions, ...options };
    logger.info('Default WebContainer rate limiter options updated', this._defaultOptions);
  }

  /**
   * Get default options
   */
  getDefaultOptions(): RateLimiterOptions {
    return { ...this._defaultOptions };
  }
}
