import { createScopedLogger } from '~/utils/logger';
import type { ActionRunner } from './action-runner';
import type { OptimizedMessageParser } from './optimized-message-parser';

const logger = createScopedLogger('PerformanceMonitor');

export interface PerformanceMetrics {
  timestamp: number;

  // Memory metrics
  memoryUsage: {
    fileOptimizer: {
      cacheEntries: number;
      currentMemoryMB: string;
      memoryUtilization: string;
    };
    parser: {
      cacheSize: number;
      messagesTracked: number;
    };
  };

  // File operation metrics
  fileOperations: {
    batchStats: {
      pendingFileWrites: number;
      pendingDirCreates: number;
      pendingBulkOperations: number;
      batchingEfficiency: number;
      averageOperationTime: number;
    };
    optimizationStats: {
      totalFilesAnalyzed: number;
      filesSkipped: number;
      filesModified: number;
      optimizationRate: number;
    };
    predictiveStats: {
      totalPredictions: number;
      successfulPredictions: number;
      accuracy: number;
      detectedPatterns: string[];
    };
  };

  // Parser performance
  parserPerformance: {
    totalParseTime: number;
    averageParseTime: number;
    cacheHitRate: number;
    adaptiveChunkSize: number;
    largeContentProcessed: number;
    binaryContentSkipped: number;
  };

  // System performance
  systemPerformance: {
    cpuUsage?: number;
    memoryPressure: 'low' | 'medium' | 'high';
    responseTime: number;
    throughput: number; // operations per second
  };
}

export interface PerformanceAlert {
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  suggestions: string[];
}

export interface PerformanceTrend {
  metric: string;
  values: number[];
  timestamps: number[];
  trend: 'improving' | 'degrading' | 'stable';
  changePercentage: number;
}

/**
 * Real-time performance monitoring system that tracks and analyzes
 * performance across all WebContainer pipeline components.
 */
export class PerformanceMonitor {
  private _actionRunner: ActionRunner | null = null;
  private _parser: OptimizedMessageParser | null = null;
  private _isMonitoring = false;
  private _monitoringInterval: number | null = null;
  private _metricsHistory: PerformanceMetrics[] = [];
  private _alerts: PerformanceAlert[] = [];
  private _maxHistorySize = 100; // Keep last 100 measurements
  private _maxAlertsSize = 50; // Keep last 50 alerts

  // Performance thresholds
  private _thresholds = {
    memoryUtilization: 80, // 80% memory usage
    batchingEfficiency: 50, // 50% batching efficiency
    optimizationRate: 20, // 20% optimization rate
    cacheHitRate: 70, // 70% cache hit rate
    averageParseTime: 100, // 100ms average parse time
    responseTime: 2000, // 2 second response time
  };

  constructor() {
    logger.debug('PerformanceMonitor initialized');
  }

  /**
   * Register components for monitoring
   */
  registerActionRunner(actionRunner: ActionRunner): void {
    this._actionRunner = actionRunner;
    logger.debug('ActionRunner registered for monitoring');
  }

  registerParser(parser: OptimizedMessageParser): void {
    this._parser = parser;
    logger.debug('OptimizedMessageParser registered for monitoring');
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this._isMonitoring) {
      logger.warn('Monitoring already started');
      return;
    }

    this._isMonitoring = true;
    this._monitoringInterval = setInterval(() => {
      this._collectMetrics();
    }, intervalMs) as unknown as number;

    logger.info(`Performance monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this._isMonitoring) {
      return;
    }

    this._isMonitoring = false;

    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }

    logger.info('Performance monitoring stopped');
  }

  /**
   * Collect current performance metrics
   */
  private async _collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      const responseTimeStart = performance.now();

      // Collect metrics from all registered components
      const metrics: PerformanceMetrics = {
        timestamp,
        memoryUsage: this._collectMemoryMetrics(),
        fileOperations: this._collectFileOperationMetrics(),
        parserPerformance: this._collectParserMetrics(),
        systemPerformance: await this._collectSystemMetrics(responseTimeStart),
      };

      // Store metrics
      this._metricsHistory.push(metrics);

      if (this._metricsHistory.length > this._maxHistorySize) {
        this._metricsHistory.shift();
      }

      // Analyze for alerts
      this._analyzeMetricsForAlerts(metrics);

      logger.debug('Metrics collected:', {
        memoryUtilization: metrics.memoryUsage.fileOptimizer.memoryUtilization,
        batchingEfficiency: metrics.fileOperations.batchStats.batchingEfficiency,
        cacheHitRate: metrics.parserPerformance.cacheHitRate,
        responseTime: metrics.systemPerformance.responseTime,
      });
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Collect memory usage metrics
   */
  private _collectMemoryMetrics() {
    // Try to get memory stats from file optimizer if available
    let fileOptimizerStats: any = { cacheEntries: 0, currentMemoryMB: '0.00', memoryUtilization: '0%' };

    try {
      if (this._actionRunner && typeof (this._actionRunner as any).getMemoryStats === 'function') {
        fileOptimizerStats = (this._actionRunner as any).getMemoryStats() || fileOptimizerStats;
      }
    } catch {
      // Fallback to default stats
    }

    const parserStats = this._parser?.getPerformanceStats() || {
      cacheSize: 0,
      messagesTracked: 0,
    };

    return {
      fileOptimizer: {
        cacheEntries: fileOptimizerStats.cacheEntries || 0,
        currentMemoryMB: fileOptimizerStats.currentMemoryMB || '0.00',
        memoryUtilization: fileOptimizerStats.memoryUtilization || '0%',
      },
      parser: {
        cacheSize: parserStats.cacheSize || 0,
        messagesTracked: parserStats.messagesTracked || 0,
      },
    };
  }

  /**
   * Collect file operation metrics
   */
  private _collectFileOperationMetrics() {
    const batchStats = this._actionRunner?.getBatchFileStats() || {
      pendingFileWrites: 0,
      pendingDirCreates: 0,
      pendingBulkOperations: 0,
      batchingEfficiency: 0,
      averageOperationTime: 0,
    };

    const optimizationStats = this._actionRunner?.getOptimizationStats() || {
      totalFilesAnalyzed: 0,
      filesSkipped: 0,
      filesModified: 0,
      optimizationRate: 0,
    };

    const predictiveStats = this._actionRunner?.getPredictiveDirectoryStats() || {
      totalPredictions: 0,
      successfulPredictions: 0,
      accuracy: 0,
      detectedPatterns: [],
    };

    return {
      batchStats,
      optimizationStats,
      predictiveStats,
    };
  }

  /**
   * Collect parser performance metrics
   */
  private _collectParserMetrics() {
    const parserStats = this._parser?.getPerformanceStats() || {
      totalParseTime: 0,
      averageParseTime: 0,
      cacheHitRate: 0,
      adaptiveChunkSize: 1024,
      largeContentProcessed: 0,
      binaryContentSkipped: 0,
    };

    return parserStats;
  }

  /**
   * Collect system performance metrics
   */
  private async _collectSystemMetrics(responseTimeStart: number) {
    const responseTime = performance.now() - responseTimeStart;

    // Estimate memory pressure based on available metrics
    const memoryPressure = this._estimateMemoryPressure();

    // Calculate throughput based on recent operations
    const throughput = this._calculateThroughput();

    return {
      memoryPressure,
      responseTime,
      throughput,
    };
  }

  /**
   * Estimate memory pressure from available metrics
   */
  private _estimateMemoryPressure(): 'low' | 'medium' | 'high' {
    if (!this._actionRunner) {
      return 'low';
    }

    try {
      // Try to get memory stats safely
      let memoryStats: any = null;

      if (typeof (this._actionRunner as any).getMemoryStats === 'function') {
        memoryStats = (this._actionRunner as any).getMemoryStats();
      }

      if (!memoryStats) {
        return 'low';
      }

      const utilizationStr = memoryStats.memoryUtilization as string;
      const utilization = parseFloat(utilizationStr?.replace('%', '') || '0');

      if (utilization > 80) {
        return 'high';
      }

      if (utilization > 60) {
        return 'medium';
      }

      return 'low';
    } catch {
      return 'low';
    }
  }

  /**
   * Calculate operations throughput
   */
  private _calculateThroughput(): number {
    if (this._metricsHistory.length < 2) {
      return 0;
    }

    const recent = this._metricsHistory[this._metricsHistory.length - 1];
    const previous = this._metricsHistory[this._metricsHistory.length - 2];

    const timeDiff = (recent.timestamp - previous.timestamp) / 1000; // seconds
    const opsDiff =
      recent.fileOperations.batchStats.pendingFileWrites -
      previous.fileOperations.batchStats.pendingFileWrites +
      (recent.fileOperations.optimizationStats.totalFilesAnalyzed -
        previous.fileOperations.optimizationStats.totalFilesAnalyzed);

    return timeDiff > 0 ? Math.abs(opsDiff / timeDiff) : 0;
  }

  /**
   * Analyze metrics for performance alerts
   */
  private _analyzeMetricsForAlerts(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Memory utilization alert
    const memoryUtilization = parseFloat(metrics.memoryUsage.fileOptimizer.memoryUtilization.replace('%', ''));

    if (memoryUtilization > this._thresholds.memoryUtilization) {
      alerts.push({
        type: 'warning',
        title: 'High Memory Usage',
        description: `File optimizer memory usage is at ${memoryUtilization}%`,
        metric: 'memoryUtilization',
        value: memoryUtilization,
        threshold: this._thresholds.memoryUtilization,
        timestamp: metrics.timestamp,
        suggestions: ['Clear file optimizer cache', 'Reduce cache size limits', 'Process files in smaller batches'],
      });
    }

    // Batching efficiency alert
    if (metrics.fileOperations.batchStats.batchingEfficiency < this._thresholds.batchingEfficiency) {
      alerts.push({
        type: 'warning',
        title: 'Low Batching Efficiency',
        description: `Batching efficiency is only ${metrics.fileOperations.batchStats.batchingEfficiency.toFixed(1)}%`,
        metric: 'batchingEfficiency',
        value: metrics.fileOperations.batchStats.batchingEfficiency,
        threshold: this._thresholds.batchingEfficiency,
        timestamp: metrics.timestamp,
        suggestions: [
          'Increase batch delay to collect more operations',
          'Check for file conflicts causing serialization',
          'Review file operation patterns',
        ],
      });
    }

    // Cache hit rate alert
    if (metrics.parserPerformance.cacheHitRate < this._thresholds.cacheHitRate / 100) {
      alerts.push({
        type: 'info',
        title: 'Low Parser Cache Hit Rate',
        description: `Parser cache hit rate is ${(metrics.parserPerformance.cacheHitRate * 100).toFixed(1)}%`,
        metric: 'cacheHitRate',
        value: metrics.parserPerformance.cacheHitRate * 100,
        threshold: this._thresholds.cacheHitRate,
        timestamp: metrics.timestamp,
        suggestions: [
          'Increase parser cache size',
          'Review content patterns for better caching',
          'Consider cache warming strategies',
        ],
      });
    }

    // Response time alert
    if (metrics.systemPerformance.responseTime > this._thresholds.responseTime) {
      alerts.push({
        type: 'error',
        title: 'High Response Time',
        description: `System response time is ${metrics.systemPerformance.responseTime.toFixed(1)}ms`,
        metric: 'responseTime',
        value: metrics.systemPerformance.responseTime,
        threshold: this._thresholds.responseTime,
        timestamp: metrics.timestamp,
        suggestions: [
          'Check system load and resource usage',
          'Optimize batch sizes and intervals',
          'Review file operation complexity',
        ],
      });
    }

    // Store new alerts
    this._alerts.push(...alerts);

    if (this._alerts.length > this._maxAlertsSize) {
      this._alerts = this._alerts.slice(-this._maxAlertsSize);
    }

    if (alerts.length > 0) {
      logger.warn(`Generated ${alerts.length} performance alerts`);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this._metricsHistory.length > 0 ? this._metricsHistory[this._metricsHistory.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    const history = this._metricsHistory;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number): PerformanceAlert[] {
    const alerts = this._alerts;
    return limit ? alerts.slice(-limit) : alerts;
  }

  /**
   * Get performance trends for a specific metric
   */
  getPerformanceTrend(metricPath: string, lookbackPeriods: number = 10): PerformanceTrend | null {
    const recentMetrics = this._metricsHistory.slice(-lookbackPeriods);

    if (recentMetrics.length < 2) {
      return null;
    }

    const values: number[] = [];
    const timestamps: number[] = [];

    // Extract metric values using dot notation path
    recentMetrics.forEach((metric) => {
      const value = this._getNestedValue(metric, metricPath);

      if (typeof value === 'number') {
        values.push(value);
        timestamps.push(metric.timestamp);
      }
    });

    if (values.length < 2) {
      return null;
    }

    // Calculate trend
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercentage = ((lastValue - firstValue) / firstValue) * 100;

    let trend: 'improving' | 'degrading' | 'stable';

    if (Math.abs(changePercentage) < 5) {
      trend = 'stable';
    } else if (this._isImprovingMetric(metricPath)) {
      trend = changePercentage > 0 ? 'improving' : 'degrading';
    } else {
      trend = changePercentage < 0 ? 'improving' : 'degrading';
    }

    return {
      metric: metricPath,
      values,
      timestamps,
      trend,
      changePercentage,
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  private _getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Determine if a metric is "improving" when it increases
   */
  private _isImprovingMetric(metricPath: string): boolean {
    const improvingMetrics = [
      'fileOperations.batchStats.batchingEfficiency',
      'fileOperations.optimizationStats.optimizationRate',
      'parserPerformance.cacheHitRate',
      'systemPerformance.throughput',
    ];

    return improvingMetrics.includes(metricPath);
  }

  /**
   * Clear all metrics and alerts
   */
  clearHistory(): void {
    this._metricsHistory = [];
    this._alerts = [];
    logger.info('Performance monitoring history cleared');
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this._isMonitoring,
      metricsCount: this._metricsHistory.length,
      alertsCount: this._alerts.length,
      registeredComponents: {
        actionRunner: !!this._actionRunner,
        parser: !!this._parser,
      },
      thresholds: this._thresholds,
    };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this._thresholds>): void {
    this._thresholds = { ...this._thresholds, ...newThresholds };
    logger.info('Performance thresholds updated:', newThresholds);
  }

  /**
   * Get performance summary for dashboard
   */
  getPerformanceSummary() {
    const current = this.getCurrentMetrics();

    if (!current) {
      return null;
    }

    const activeAlerts = this._alerts.filter(
      (alert) => current.timestamp - alert.timestamp < 60000, // Last minute
    );

    return {
      timestamp: current.timestamp,
      overallHealth: this._calculateOverallHealth(current),
      keyMetrics: {
        memoryUtilization: current.memoryUsage.fileOptimizer.memoryUtilization,
        batchingEfficiency: `${current.fileOperations.batchStats.batchingEfficiency.toFixed(1)}%`,
        cacheHitRate: `${(current.parserPerformance.cacheHitRate * 100).toFixed(1)}%`,
        responseTime: `${current.systemPerformance.responseTime.toFixed(1)}ms`,
        throughput: `${current.systemPerformance.throughput.toFixed(1)} ops/sec`,
      },
      activeAlerts: activeAlerts.length,
      recommendations: this._generateRecommendations(current),
    };
  }

  /**
   * Calculate overall system health score
   */
  private _calculateOverallHealth(metrics: PerformanceMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
    let score = 100;

    // Deduct points for various issues
    const memoryUtilization = parseFloat(metrics.memoryUsage.fileOptimizer.memoryUtilization.replace('%', ''));

    if (memoryUtilization > 80) {
      score -= 20;
    } else if (memoryUtilization > 60) {
      score -= 10;
    }

    if (metrics.fileOperations.batchStats.batchingEfficiency < 50) {
      score -= 15;
    }

    if (metrics.parserPerformance.cacheHitRate < 0.7) {
      score -= 10;
    }

    if (metrics.systemPerformance.responseTime > 1000) {
      score -= 20;
    }

    if (metrics.systemPerformance.memoryPressure === 'high') {
      score -= 15;
    }

    if (score >= 85) {
      return 'excellent';
    }

    if (score >= 70) {
      return 'good';
    }

    if (score >= 50) {
      return 'fair';
    }

    return 'poor';
  }

  /**
   * Generate performance recommendations
   */
  private _generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    const memoryUtilization = parseFloat(metrics.memoryUsage.fileOptimizer.memoryUtilization.replace('%', ''));

    if (memoryUtilization > 70) {
      recommendations.push('Consider clearing file optimizer cache to reduce memory usage');
    }

    if (metrics.fileOperations.batchStats.batchingEfficiency < 60) {
      recommendations.push('Increase batch delay to improve batching efficiency');
    }

    if (metrics.parserPerformance.cacheHitRate < 0.6) {
      recommendations.push('Parser cache hit rate is low - consider increasing cache size');
    }

    if (
      metrics.fileOperations.predictiveStats.accuracy < 0.5 &&
      metrics.fileOperations.predictiveStats.totalPredictions > 10
    ) {
      recommendations.push('Predictive directory creation accuracy is low - review project patterns');
    }

    if (metrics.systemPerformance.responseTime > 500) {
      recommendations.push('System response time is elevated - check for performance bottlenecks');
    }

    return recommendations;
  }
}
