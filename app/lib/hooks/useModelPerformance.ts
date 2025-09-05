import { useState, useEffect, useCallback } from 'react';
import { modelPerformanceMonitor, type PerformanceMetrics, type AggregatedMetrics } from '~/lib/services/modelPerformanceMonitor';

export interface UseModelPerformanceOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseModelPerformanceReturn {
  allMetrics: AggregatedMetrics[];
  getModelMetrics: (provider: string, model: string, baseUrl: string) => AggregatedMetrics | undefined;
  getRecentMetrics: (provider: string, model: string, baseUrl: string, limit?: number) => PerformanceMetrics[];
  recordMetrics: (metrics: Omit<PerformanceMetrics, 'timestamp' | 'requestId'>) => void;
  clearMetrics: (provider: string, model: string, baseUrl: string) => void;
  clearAllMetrics: () => void;
  getPerformanceComparison: () => Array<{
    provider: string;
    model: string;
    baseUrl: string;
    score: number;
    metrics: AggregatedMetrics;
  }>;
  exportMetrics: () => string;
  importMetrics: (jsonData: string) => void;
  isLoading: boolean;
}

/**
 * React hook for monitoring model performance
 */
export function useModelPerformance(options: UseModelPerformanceOptions = {}): UseModelPerformanceReturn {
  const { autoRefresh = true, refreshInterval = 5000 } = options;
  const [allMetrics, setAllMetrics] = useState<AggregatedMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Update metrics when they change
  useEffect(() => {
    const updateMetrics = () => {
      setAllMetrics(modelPerformanceMonitor.getAllAggregatedMetrics());
    };

    const handleMetricsRecorded = () => {
      updateMetrics();
    };

    const handleAggregatedMetricsUpdated = () => {
      updateMetrics();
    };

    const handleMetricsCleared = () => {
      updateMetrics();
    };

    const handleAllMetricsCleared = () => {
      updateMetrics();
    };

    const handleMetricsImported = () => {
      updateMetrics();
    };

    modelPerformanceMonitor.on('metricsRecorded', handleMetricsRecorded);
    modelPerformanceMonitor.on('aggregatedMetricsUpdated', handleAggregatedMetricsUpdated);
    modelPerformanceMonitor.on('metricsCleared', handleMetricsCleared);
    modelPerformanceMonitor.on('allMetricsCleared', handleAllMetricsCleared);
    modelPerformanceMonitor.on('metricsImported', handleMetricsImported);

    // Initialize with current metrics
    updateMetrics();

    return () => {
      modelPerformanceMonitor.off('metricsRecorded', handleMetricsRecorded);
      modelPerformanceMonitor.off('aggregatedMetricsUpdated', handleAggregatedMetricsUpdated);
      modelPerformanceMonitor.off('metricsCleared', handleMetricsCleared);
      modelPerformanceMonitor.off('allMetricsCleared', handleAllMetricsCleared);
      modelPerformanceMonitor.off('metricsImported', handleMetricsImported);
    };
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setAllMetrics(modelPerformanceMonitor.getAllAggregatedMetrics());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Get metrics for a specific model
  const getModelMetrics = useCallback((provider: string, model: string, baseUrl: string) => {
    return modelPerformanceMonitor.getAggregatedMetrics(provider, model, baseUrl);
  }, []);

  // Get recent metrics for a specific model
  const getRecentMetrics = useCallback((provider: string, model: string, baseUrl: string, limit = 10) => {
    return modelPerformanceMonitor.getRecentMetrics(provider, model, baseUrl, limit);
  }, []);

  // Record new metrics
  const recordMetrics = useCallback((metrics: Omit<PerformanceMetrics, 'timestamp' | 'requestId'>) => {
    modelPerformanceMonitor.recordMetrics(metrics);
  }, []);

  // Clear metrics for a specific model
  const clearMetrics = useCallback((provider: string, model: string, baseUrl: string) => {
    modelPerformanceMonitor.clearMetrics(provider, model, baseUrl);
  }, []);

  // Clear all metrics
  const clearAllMetrics = useCallback(() => {
    modelPerformanceMonitor.clearAllMetrics();
  }, []);

  // Get performance comparison
  const getPerformanceComparison = useCallback(() => {
    return modelPerformanceMonitor.getPerformanceComparison();
  }, []);

  // Export metrics
  const exportMetrics = useCallback(() => {
    return modelPerformanceMonitor.exportMetrics();
  }, []);

  // Import metrics
  const importMetrics = useCallback((jsonData: string) => {
    setIsLoading(true);
    try {
      modelPerformanceMonitor.importMetrics(jsonData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    allMetrics,
    getModelMetrics,
    getRecentMetrics,
    recordMetrics,
    clearMetrics,
    clearAllMetrics,
    getPerformanceComparison,
    exportMetrics,
    importMetrics,
    isLoading,
  };
}

/**
 * Hook for monitoring performance of a specific model
 */
export function useModelSpecificPerformance(
  provider: string,
  model: string,
  baseUrl: string,
  options: UseModelPerformanceOptions = {}
) {
  const {
    getModelMetrics,
    getRecentMetrics,
    recordMetrics,
    clearMetrics,
  } = useModelPerformance(options);

  const [metrics, setMetrics] = useState<AggregatedMetrics | undefined>();
  const [recentMetrics, setRecentMetrics] = useState<PerformanceMetrics[]>([]);

  // Update metrics when they change
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getModelMetrics(provider, model, baseUrl));
      setRecentMetrics(getRecentMetrics(provider, model, baseUrl));
    };

    const handleMetricsUpdated = (updatedMetrics: AggregatedMetrics) => {
      if (updatedMetrics.provider === provider && 
          updatedMetrics.model === model && 
          updatedMetrics.baseUrl === baseUrl) {
        setMetrics(updatedMetrics);
        setRecentMetrics(getRecentMetrics(provider, model, baseUrl));
      }
    };

    modelPerformanceMonitor.on('aggregatedMetricsUpdated', handleMetricsUpdated);
    updateMetrics();

    return () => {
      modelPerformanceMonitor.off('aggregatedMetricsUpdated', handleMetricsUpdated);
    };
  }, [provider, model, baseUrl, getModelMetrics, getRecentMetrics]);

  return {
    metrics,
    recentMetrics,
    recordMetrics: (metricsData: Omit<PerformanceMetrics, 'timestamp' | 'requestId' | 'provider' | 'model' | 'baseUrl'>) => 
      recordMetrics({ ...metricsData, provider, model, baseUrl }),
    clearMetrics: () => clearMetrics(provider, model, baseUrl),
  };
}

/**
 * Utility function to measure and record model performance
 */
export function withPerformanceTracking<T extends any[], R>(
  provider: string,
  model: string,
  baseUrl: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let totalTokens: number | undefined;

    try {
      const result = await fn(...args);
      success = true;
      
      // Try to extract token information from the result if it's available
      if (typeof result === 'object' && result !== null) {
        const resultObj = result as any;
        if (resultObj.usage) {
          inputTokens = resultObj.usage.prompt_tokens;
          outputTokens = resultObj.usage.completion_tokens;
          totalTokens = resultObj.usage.total_tokens;
        }
      }
      
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const responseTime = Date.now() - startTime;
      const tokensPerSecond = outputTokens && responseTime > 0 ? 
        (outputTokens / (responseTime / 1000)) : undefined;

      modelPerformanceMonitor.recordMetrics({
        provider,
        model,
        baseUrl,
        responseTime,
        tokensPerSecond,
        inputTokens,
        outputTokens,
        totalTokens,
        success,
        error,
      });
    }
  };
}
