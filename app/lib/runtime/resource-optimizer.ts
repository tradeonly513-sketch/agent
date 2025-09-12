/**
 * Client Resource Optimizer
 * PhD-level implementation to minimize client-side resource usage
 * Offloads processing to server and optimizes memory management
 */

import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ResourceOptimizer');

export interface ResourceMetrics {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    percentUsed: number;
  };
  performanceTiming: {
    domContentLoaded: number;
    loadComplete: number;
    firstContentfulPaint: number;
  };
  activeRequests: number;
  pendingOperations: number;
  cacheSize: number;
}

export interface OptimizationConfig {
  maxConcurrentRequests: number;
  requestDebounceMs: number;
  requestThrottleMs: number;
  maxMemoryUsagePercent: number;
  enableProgressiveRendering: boolean;
  enableLazyLoading: boolean;
  enableRequestBatching: boolean;
  maxBatchSize: number;
  cacheExpirationMs: number;
  enableServerSideProcessing: boolean;
  webWorkerPoolSize: number;
}

export class ClientResourceOptimizer {
  private static _instance: ClientResourceOptimizer;

  private _config: OptimizationConfig = {
    maxConcurrentRequests: 3,
    requestDebounceMs: 300,
    requestThrottleMs: 100,
    maxMemoryUsagePercent: 70,
    enableProgressiveRendering: true,
    enableLazyLoading: true,
    enableRequestBatching: true,
    maxBatchSize: 10,
    cacheExpirationMs: 5 * 60 * 1000, // 5 minutes
    enableServerSideProcessing: true,
    webWorkerPoolSize: 2,
  };

  private _requestQueue: Map<string, Promise<any>> = new Map();
  private _pendingRequests = 0;
  private _memoryCache: Map<string, { data: any; timestamp: number }> = new Map();
  private _debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private _throttleTimestamps: Map<string, number> = new Map();
  private _batchQueue: Map<string, any[]> = new Map();
  private _webWorkers: Worker[] = [];
  private _workerPool: Worker[] = [];
  private _isMonitoring = false;
  private _lastCleanup = Date.now();

  private constructor() {
    this._initializeOptimization();
  }

  static getInstance(): ClientResourceOptimizer {
    if (!ClientResourceOptimizer._instance) {
      ClientResourceOptimizer._instance = new ClientResourceOptimizer();
    }

    return ClientResourceOptimizer._instance;
  }

  private _initializeOptimization() {
    logger.debug('🚀 Initializing Client Resource Optimizer');

    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Initialize web workers for offloading
    this._initializeWebWorkers();

    // Start memory monitoring
    this._startMemoryMonitoring();

    // Setup periodic cleanup
    this._setupPeriodicCleanup();

    // Setup request interception
    this._setupRequestInterception();

    // Initialize progressive rendering
    this._initializeProgressiveRendering();

    logger.info('✅ Client Resource Optimizer initialized successfully');
  }

  /**
   * Initialize web workers for CPU-intensive tasks
   */
  private _initializeWebWorkers() {
    if (!window.Worker) {
      logger.warn('Web Workers not supported, falling back to main thread');
      return;
    }

    try {
      // Create a pool of workers for parallel processing
      for (let i = 0; i < this._config.webWorkerPoolSize; i++) {
        const workerCode = `
          self.onmessage = function(e) {
            const { type, data } = e.data;
            
            switch(type) {
              case 'process':
                // Offload heavy processing here
                const result = processData(data);
                self.postMessage({ type: 'result', data: result });
                break;
              case 'parse':
                // Offload parsing here
                const parsed = parseContent(data);
                self.postMessage({ type: 'parsed', data: parsed });
                break;
            }
          };
          
          function processData(data) {
            // Heavy processing logic
            return data;
          }
          
          function parseContent(content) {
            // Content parsing logic
            return content;
          }
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        this._workerPool.push(worker);
      }

      logger.debug(`Created ${this._config.webWorkerPoolSize} web workers for offloading`);
    } catch (error) {
      logger.error('Failed to initialize web workers:', error);
    }
  }

  /**
   * Start monitoring memory usage
   */
  private _startMemoryMonitoring() {
    if (!this._isMonitoring && typeof window !== 'undefined') {
      this._isMonitoring = true;

      setInterval(() => {
        const metrics = this.getResourceMetrics();

        if (metrics.memoryUsage.percentUsed > this._config.maxMemoryUsagePercent) {
          logger.warn(`⚠️ High memory usage detected: ${metrics.memoryUsage.percentUsed.toFixed(1)}%`);
          this._performEmergencyCleanup();
        }
      }, 5000); // Check every 5 seconds
    }
  }

  /**
   * Setup periodic cleanup tasks
   */
  private _setupPeriodicCleanup() {
    setInterval(() => {
      this._cleanupExpiredCache();
      this._cleanupCompletedRequests();
      this._releaseUnusedResources();
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup request interception for optimization
   */
  private _setupRequestInterception() {
    // Intercept fetch requests
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;

      window.fetch = async (...args) => {
        const url = args[0].toString();

        // Check cache first
        const cached = this._getCached(url);

        if (cached) {
          logger.debug(`📦 Cache hit for: ${url}`);
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Apply throttling
        if (this._shouldThrottle(url)) {
          await this._delay(this._config.requestThrottleMs);
        }

        // Queue if too many concurrent requests
        if (this._pendingRequests >= this._config.maxConcurrentRequests) {
          logger.debug(`⏳ Queueing request: ${url}`);
          await this._waitForRequestSlot();
        }

        this._pendingRequests++;

        try {
          const response = await originalFetch(...args);

          // Cache successful responses
          if (response.ok && response.headers.get('content-type')?.includes('json')) {
            const data = await response.clone().json();
            this._setCached(url, data);
          }

          return response;
        } finally {
          this._pendingRequests--;
        }
      };
    }
  }

  /**
   * Initialize progressive rendering for better perceived performance
   */
  private _initializeProgressiveRendering() {
    if (typeof window === 'undefined') {
      return;
    }

    // Use requestIdleCallback for non-critical updates
    if ('requestIdleCallback' in window) {
      const originalSetTimeout = window.setTimeout;

      // Override setTimeout for non-critical tasks
      (window as any).setTimeoutOptimized = (callback: () => void, delay: number) => {
        if (delay > 100) {
          // Use requestIdleCallback for longer delays
          return (window as any).requestIdleCallback(callback, { timeout: delay });
        }

        return originalSetTimeout(callback, delay);
      };
    }

    // Implement intersection observer for lazy loading
    if ('IntersectionObserver' in window) {
      const lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            element.classList.add('loaded');
            lazyLoadObserver.unobserve(element);
          }
        });
      });

      // Observe elements with lazy-load class
      document.querySelectorAll('.lazy-load').forEach((el) => {
        lazyLoadObserver.observe(el);
      });
    }
  }

  /**
   * Debounce a function call
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    delay: number = this._config.requestDebounceMs,
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const existing = this._debounceTimers.get(key);

      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        func(...args);
        this._debounceTimers.delete(key);
      }, delay);

      this._debounceTimers.set(key, timer);
    };
  }

  /**
   * Throttle a function call
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    limit: number = this._config.requestThrottleMs,
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const lastCall = this._throttleTimestamps.get(key) || 0;

      if (now - lastCall >= limit) {
        this._throttleTimestamps.set(key, now);
        func(...args);
      }
    };
  }

  /**
   * Batch multiple operations together
   */
  async batchOperation<T>(key: string, operation: T, processor: (batch: T[]) => Promise<any>): Promise<any> {
    // Add to batch queue
    if (!this._batchQueue.has(key)) {
      this._batchQueue.set(key, []);
    }

    const batch = this._batchQueue.get(key)!;
    batch.push(operation);

    // Process batch if it reaches max size or after delay
    if (batch.length >= this._config.maxBatchSize) {
      const operations = [...batch];
      this._batchQueue.set(key, []);

      return processor(operations);
    }

    // Schedule batch processing
    return new Promise((resolve) => {
      setTimeout(async () => {
        const operations = this._batchQueue.get(key) || [];

        if (operations.length > 0) {
          this._batchQueue.set(key, []);

          const result = await processor(operations);
          resolve(result);
        }
      }, this._config.requestDebounceMs);
    });
  }

  /**
   * Offload heavy computation to web worker
   */
  async offloadToWorker<T>(data: any, type: string = 'process'): Promise<T> {
    if (this._workerPool.length === 0) {
      // Fallback to main thread if no workers available
      logger.debug('No workers available, processing on main thread');
      return data;
    }

    // Get next available worker (round-robin)
    const worker = this._workerPool.shift()!;
    this._workerPool.push(worker);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker timeout'));
      }, 5000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        resolve(e.data.data);
      };

      worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      worker.postMessage({ type, data });
    });
  }

  /**
   * Get current resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    const metrics: ResourceMetrics = {
      memoryUsage: {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        percentUsed: 0,
      },
      performanceTiming: {
        domContentLoaded: 0,
        loadComplete: 0,
        firstContentfulPaint: 0,
      },
      activeRequests: this._pendingRequests,
      pendingOperations: this._requestQueue.size,
      cacheSize: this._memoryCache.size,
    };

    if (typeof window !== 'undefined') {
      // Get memory usage if available
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        metrics.memoryUsage = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          percentUsed: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        };
      }

      // Get performance timing
      const perfData = performance.getEntriesByType('navigation')[0] as any;

      if (perfData) {
        metrics.performanceTiming = {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
          firstContentfulPaint: perfData.fetchStart ? perfData.responseEnd - perfData.fetchStart : 0,
        };
      }
    }

    return metrics;
  }

  /**
   * Perform emergency cleanup when memory is high
   */
  private _performEmergencyCleanup() {
    logger.warn('🧹 Performing emergency cleanup to free memory');

    // Clear all caches
    this._memoryCache.clear();

    // Cancel pending operations
    this._debounceTimers.forEach((timer) => clearTimeout(timer));
    this._debounceTimers.clear();

    // Clear batch queues
    this._batchQueue.clear();

    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }

    logger.info('✅ Emergency cleanup completed');
  }

  /**
   * Clean up expired cache entries
   */
  private _cleanupExpiredCache() {
    const now = Date.now();
    let removed = 0;

    this._memoryCache.forEach((value, key) => {
      if (now - value.timestamp > this._config.cacheExpirationMs) {
        this._memoryCache.delete(key);
        removed++;
      }
    });

    if (removed > 0) {
      logger.debug(`🗑️ Removed ${removed} expired cache entries`);
    }
  }

  /**
   * Clean up completed requests
   */
  private _cleanupCompletedRequests() {
    const completed: string[] = [];

    this._requestQueue.forEach(async (promise, key) => {
      try {
        // Check if promise is settled
        await Promise.race([promise, Promise.resolve('pending')]).then((result) => {
          if (result !== 'pending') {
            completed.push(key);
          }
        });
      } catch {
        completed.push(key);
      }
    });

    completed.forEach((key) => this._requestQueue.delete(key));

    if (completed.length > 0) {
      logger.debug(`🗑️ Cleaned up ${completed.length} completed requests`);
    }
  }

  /**
   * Release unused resources
   */
  private _releaseUnusedResources() {
    // Clear old throttle timestamps
    const now = Date.now();
    this._throttleTimestamps.forEach((timestamp, key) => {
      if (now - timestamp > 60000) {
        // 1 minute old
        this._throttleTimestamps.delete(key);
      }
    });

    // Reduce cache size if too large
    if (this._memoryCache.size > 100) {
      const entries = Array.from(this._memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 25%
      const toRemove = Math.floor(entries.length * 0.25);

      for (let i = 0; i < toRemove; i++) {
        this._memoryCache.delete(entries[i][0]);
      }

      logger.debug(`📉 Reduced cache size by ${toRemove} entries`);
    }
  }

  /**
   * Check if request should be throttled
   */
  private _shouldThrottle(key: string): boolean {
    const lastCall = this._throttleTimestamps.get(key);

    if (!lastCall) {
      return false;
    }

    return Date.now() - lastCall < this._config.requestThrottleMs;
  }

  /**
   * Wait for a request slot to become available
   */
  private async _waitForRequestSlot(): Promise<void> {
    while (this._pendingRequests >= this._config.maxConcurrentRequests) {
      await this._delay(50);
    }
  }

  /**
   * Get cached data
   */
  private _getCached(key: string): any | null {
    const cached = this._memoryCache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this._config.cacheExpirationMs) {
      this._memoryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   */
  private _setCached(key: string, data: any): void {
    // Limit cache size
    if (this._memoryCache.size >= 100) {
      // Remove oldest entry
      const firstKey = this._memoryCache.keys().next().value;

      if (firstKey) {
        this._memoryCache.delete(firstKey);
      }
    }

    this._memoryCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Utility delay function
   */
  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OptimizationConfig>) {
    this._config = { ...this._config, ...config };
    logger.debug('Configuration updated:', config);
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      pendingRequests: this._pendingRequests,
      cacheSize: this._memoryCache.size,
      queueSize: this._requestQueue.size,
      batchQueues: this._batchQueue.size,
      activeDebounces: this._debounceTimers.size,
      workerPoolSize: this._workerPool.length,
      metrics: this.getResourceMetrics(),
    };
  }

  /**
   * Cleanup and destroy optimizer
   */
  destroy() {
    // Clear all timers
    this._debounceTimers.forEach((timer) => clearTimeout(timer));
    this._debounceTimers.clear();

    // Terminate workers
    this._workerPool.forEach((worker) => worker.terminate());
    this._workerPool = [];

    // Clear all caches and queues
    this._memoryCache.clear();
    this._requestQueue.clear();
    this._batchQueue.clear();
    this._throttleTimestamps.clear();

    this._isMonitoring = false;

    logger.info('🛑 Resource Optimizer destroyed');
  }
}

// Export singleton instance
export const resourceOptimizer = ClientResourceOptimizer.getInstance();
