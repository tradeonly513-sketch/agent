// Simple EventEmitter implementation for browser compatibility
class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((l) => l !== listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach((listener) => listener(...args));
  }

  removeAllListeners(): void {
    this.events = {};
  }
}

export interface PerformanceMetrics {
  provider: string;
  model: string;
  baseUrl: string;
  responseTime: number;
  tokensPerSecond?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  timestamp: Date;
  requestId: string;
  success: boolean;
  error?: string;
}

export interface AggregatedMetrics {
  provider: string;
  model: string;
  baseUrl: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  averageTokensPerSecond: number;
  totalTokensProcessed: number;
  lastUpdated: Date;
  recentMetrics: PerformanceMetrics[];
}

export class ModelPerformanceMonitor extends SimpleEventEmitter {
  private metrics = new Map<string, PerformanceMetrics[]>();
  private readonly maxMetricsPerModel = 100; // Keep last 100 metrics per model
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.startCleanup();
  }

  /**
   * Record performance metrics for a model request
   */
  recordMetrics(metrics: Omit<PerformanceMetrics, 'timestamp' | 'requestId'>): void {
    const fullMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date(),
      requestId: this.generateRequestId(),
    };

    const key = this.getModelKey(metrics.provider, metrics.model, metrics.baseUrl);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const modelMetrics = this.metrics.get(key)!;
    modelMetrics.push(fullMetrics);

    // Keep only the most recent metrics
    if (modelMetrics.length > this.maxMetricsPerModel) {
      modelMetrics.splice(0, modelMetrics.length - this.maxMetricsPerModel);
    }

    this.emit('metricsRecorded', fullMetrics);
    this.emit('aggregatedMetricsUpdated', this.getAggregatedMetrics(metrics.provider, metrics.model, metrics.baseUrl));
  }

  /**
   * Get aggregated metrics for a specific model
   */
  getAggregatedMetrics(provider: string, model: string, baseUrl: string): AggregatedMetrics | undefined {
    const key = this.getModelKey(provider, model, baseUrl);
    const modelMetrics = this.metrics.get(key);

    if (!modelMetrics || modelMetrics.length === 0) {
      return undefined;
    }

    const successfulMetrics = modelMetrics.filter((m) => m.success);
    const failedMetrics = modelMetrics.filter((m) => !m.success);

    const totalResponseTime = successfulMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const totalTokensPerSecond = successfulMetrics
      .filter((m) => m.tokensPerSecond !== undefined)
      .reduce((sum, m) => sum + (m.tokensPerSecond || 0), 0);
    const validTokensPerSecondCount = successfulMetrics.filter((m) => m.tokensPerSecond !== undefined).length;

    const totalTokens = successfulMetrics.reduce((sum, m) => sum + (m.totalTokens || 0), 0);

    return {
      provider,
      model,
      baseUrl,
      totalRequests: modelMetrics.length,
      successfulRequests: successfulMetrics.length,
      failedRequests: failedMetrics.length,
      averageResponseTime: successfulMetrics.length > 0 ? totalResponseTime / successfulMetrics.length : 0,
      averageTokensPerSecond: validTokensPerSecondCount > 0 ? totalTokensPerSecond / validTokensPerSecondCount : 0,
      totalTokensProcessed: totalTokens,
      lastUpdated: new Date(),
      recentMetrics: modelMetrics.slice(-10), // Last 10 metrics
    };
  }

  /**
   * Get all aggregated metrics
   */
  getAllAggregatedMetrics(): AggregatedMetrics[] {
    const results: AggregatedMetrics[] = [];

    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        const [provider, model, baseUrl] = this.parseModelKey(key);
        const aggregated = this.getAggregatedMetrics(provider, model, baseUrl);
        if (aggregated) {
          results.push(aggregated);
        }
      }
    }

    return results.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  /**
   * Get recent metrics for a specific model
   */
  getRecentMetrics(provider: string, model: string, baseUrl: string, limit = 10): PerformanceMetrics[] {
    const key = this.getModelKey(provider, model, baseUrl);
    const modelMetrics = this.metrics.get(key);

    if (!modelMetrics) {
      return [];
    }

    return modelMetrics.slice(-limit);
  }

  /**
   * Clear metrics for a specific model
   */
  clearMetrics(provider: string, model: string, baseUrl: string): void {
    const key = this.getModelKey(provider, model, baseUrl);
    this.metrics.delete(key);
    this.emit('metricsCleared', { provider, model, baseUrl });
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.emit('allMetricsCleared');
  }

  /**
   * Get performance statistics for comparison
   */
  getPerformanceComparison(): Array<{
    provider: string;
    model: string;
    baseUrl: string;
    score: number;
    metrics: AggregatedMetrics;
  }> {
    const allMetrics = this.getAllAggregatedMetrics();

    return allMetrics
      .map((metrics) => {
        // Calculate a performance score based on multiple factors
        const successRate = metrics.totalRequests > 0 ? metrics.successfulRequests / metrics.totalRequests : 0;
        const responseTimeScore = Math.max(0, 1 - metrics.averageResponseTime / 10000); // Normalize to 10s max
        const tokensPerSecondScore = Math.min(1, metrics.averageTokensPerSecond / 100); // Normalize to 100 tokens/s max

        const score = successRate * 0.4 + responseTimeScore * 0.3 + tokensPerSecondScore * 0.3;

        return {
          provider: metrics.provider,
          model: metrics.model,
          baseUrl: metrics.baseUrl,
          score: Math.round(score * 100), // Convert to percentage
          metrics,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics.entries()),
      aggregated: this.getAllAggregatedMetrics(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import metrics from JSON
   */
  importMetrics(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);

      if (data.metrics) {
        this.metrics.clear();
        for (const [key, metrics] of Object.entries(data.metrics)) {
          this.metrics.set(key, metrics as PerformanceMetrics[]);
        }
        this.emit('metricsImported');
      }
    } catch (error) {
      throw new Error(`Failed to import metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start automatic cleanup of old metrics
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.cleanupInterval);
  }

  /**
   * Clean up old metrics (older than 24 hours)
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [key, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter((m) => m.timestamp > cutoffTime);

      if (filteredMetrics.length !== metrics.length) {
        if (filteredMetrics.length === 0) {
          this.metrics.delete(key);
        } else {
          this.metrics.set(key, filteredMetrics);
        }
      }
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique key for a model
   */
  private getModelKey(provider: string, model: string, baseUrl: string): string {
    return `${provider}:${model}:${baseUrl}`;
  }

  /**
   * Parse a model key back to its components
   */
  private parseModelKey(key: string): [string, string, string] {
    const parts = key.split(':');
    return [parts[0], parts[1], parts.slice(2).join(':')];
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.metrics.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
export const modelPerformanceMonitor = new ModelPerformanceMonitor();
