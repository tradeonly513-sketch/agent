import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ContentAwareSampler');

interface SamplingStats {
  totalCalls: number;
  bypassedCalls: number;
  sampledCalls: number;
  averageInterval: number;
  lastAdaptation: number;
}

type ContentPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Content-aware sampler that adapts sampling intervals based on content type,
 * file importance, and system performance.
 */
export class ContentAwareSampler<T extends (data: ActionCallbackData, ...args: any[]) => any> {
  private _fn: T;
  private _lastArgs: Parameters<T> | null = null;
  private _lastTime = 0;
  private _timeout: NodeJS.Timeout | null = null;
  private _baseInterval: number;
  private _stats: SamplingStats;
  private _performanceHistory: number[] = [];

  constructor(fn: T, baseInterval: number = 50) {
    this._fn = fn;
    this._baseInterval = baseInterval;
    this._stats = {
      totalCalls: 0,
      bypassedCalls: 0,
      sampledCalls: 0,
      averageInterval: baseInterval,
      lastAdaptation: Date.now(),
    };

    logger.debug(`ContentAwareSampler initialized with ${baseInterval}ms base interval`);
  }

  /**
   * Sample function calls with content-aware logic
   */
  sample = ((...args: Parameters<T>): ReturnType<T> | void => {
    const now = Date.now();
    this._stats.totalCalls++;

    const [data] = args;
    const priority = this._analyzeContentPriority(data);
    const adaptiveInterval = this._calculateAdaptiveInterval(priority, data);

    // Critical operations bypass sampling entirely
    if (priority === 'critical') {
      logger.debug(`Bypassing sampling for critical operation: ${data.action.type}`);
      this._stats.bypassedCalls++;
      this._updatePerformanceHistory(now);

      return (this._fn as any).apply(this, args);
    }

    this._lastArgs = args;

    // If we're within the adaptive interval, defer execution
    if (now - this._lastTime < adaptiveInterval) {
      if (!this._timeout) {
        this._timeout = setTimeout(
          () => {
            this._timeout = null;
            this._lastTime = Date.now();

            if (this._lastArgs) {
              const executionStart = Date.now();
              (this._fn as any).apply(this, this._lastArgs);
              this._updatePerformanceHistory(Date.now() - executionStart);
              this._lastArgs = null;
              this._stats.sampledCalls++;
            }
          },
          adaptiveInterval - (now - this._lastTime),
        );
      }

      return undefined;
    }

    // Execute immediately if outside interval
    this._lastTime = now;

    const executionStart = now;
    const result = (this._fn as any).apply(this, args);
    this._updatePerformanceHistory(Date.now() - executionStart);
    this._lastArgs = null;
    this._stats.sampledCalls++;

    return result;
  }) as T;

  /**
   * Analyze content to determine priority level
   */
  private _analyzeContentPriority(data: ActionCallbackData): ContentPriority {
    const { action } = data;

    // Shell and build operations are critical
    if (action.type === 'shell' || action.type === 'start' || action.type === 'build') {
      return 'critical';
    }

    // Supabase operations are high priority
    if (action.type === 'supabase') {
      return 'high';
    }

    // File operations depend on file characteristics
    if (action.type === 'file') {
      return this._analyzeFilePriority(action.filePath, action.content);
    }

    return 'normal';
  }

  /**
   * Analyze file characteristics to determine priority
   */
  private _analyzeFilePriority(filePath: string, content: string): ContentPriority {
    // Entry point files are high priority
    if (/(^|\/)index\.(html?|[jt]sx?)$|main\.[jt]sx?$/.test(filePath)) {
      return 'high';
    }

    // Configuration files are high priority
    if (/(package\.json|tsconfig\.json|\.config\.|\.env)/.test(filePath)) {
      return 'high';
    }

    // Large files are high priority to avoid memory issues
    if (content.length > 50000) {
      // 50KB+
      return 'high';
    }

    // Binary files are low priority
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|pdf|zip|tar|gz)$/i.test(filePath)) {
      return 'low';
    }

    // Small files are low priority
    if (content.length < 1000) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Calculate adaptive sampling interval based on priority and performance
   */
  private _calculateAdaptiveInterval(priority: ContentPriority, data: ActionCallbackData): number {
    let multiplier = 1;

    // Priority-based multipliers
    switch (priority) {
      case 'critical':
        return 0; // No sampling delay
      case 'high':
        multiplier = 0.5; // 50% of base interval
        break;
      case 'normal':
        multiplier = 1.0; // Base interval
        break;
      case 'low':
        multiplier = 1.5; // 150% of base interval
        break;
    }

    // Performance-based adaptation
    const avgPerformance = this._getAveragePerformance();

    if (avgPerformance > 100) {
      // Slow performance
      multiplier *= 1.5;
    } else if (avgPerformance < 20) {
      // Fast performance
      multiplier *= 0.8;
    }

    // Content size adaptation for file operations
    if (data.action.type === 'file') {
      const contentSize = data.action.content.length;

      if (contentSize > 100000) {
        // 100KB+
        multiplier *= 0.7; // Faster for large files
      } else if (contentSize < 500) {
        multiplier *= 1.3; // Slower for tiny files
      }
    }

    const adaptiveInterval = Math.max(5, Math.min(200, this._baseInterval * multiplier));

    // Update average interval for monitoring
    this._updateAverageInterval(adaptiveInterval);

    return adaptiveInterval;
  }

  /**
   * Update performance history for adaptive behavior
   */
  private _updatePerformanceHistory(executionTime: number): void {
    this._performanceHistory.push(executionTime);

    // Keep only last 20 measurements
    if (this._performanceHistory.length > 20) {
      this._performanceHistory.shift();
    }
  }

  /**
   * Get average performance over recent history
   */
  private _getAveragePerformance(): number {
    if (this._performanceHistory.length === 0) {
      return 50; // Default assumption
    }

    const sum = this._performanceHistory.reduce((acc, time) => acc + time, 0);

    return sum / this._performanceHistory.length;
  }

  /**
   * Update rolling average interval
   */
  private _updateAverageInterval(currentInterval: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this._stats.averageInterval = this._stats.averageInterval * (1 - alpha) + currentInterval * alpha;
  }

  /**
   * Get sampling statistics
   */
  getStats() {
    return {
      ...this._stats,
      samplingEfficiency: this._stats.totalCalls > 0 ? this._stats.sampledCalls / this._stats.totalCalls : 0,
      bypassRate: this._stats.totalCalls > 0 ? this._stats.bypassedCalls / this._stats.totalCalls : 0,
      averagePerformance: this._getAveragePerformance(),
      currentBaseInterval: this._baseInterval,
    };
  }

  /**
   * Adjust base interval for performance tuning
   */
  adjustBaseInterval(newInterval: number): void {
    if (newInterval >= 5 && newInterval <= 200) {
      this._baseInterval = newInterval;
      logger.debug(`Base interval adjusted to ${newInterval}ms`);
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = {
      totalCalls: 0,
      bypassedCalls: 0,
      sampledCalls: 0,
      averageInterval: this._baseInterval,
      lastAdaptation: Date.now(),
    };
    this._performanceHistory = [];
  }

  /**
   * Force immediate execution of any pending call
   */
  flush(): void {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    if (this._lastArgs) {
      (this._fn as any).apply(this, this._lastArgs);
      this._lastArgs = null;
      this._stats.sampledCalls++;
    }
  }
}
