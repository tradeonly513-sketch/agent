import type { DetectedIntent } from './intent-detection';
import type { VerbosityLevel } from './schema-loader';
import { generateOptimizedPrompt } from './dynamic-rule-injector';
import { createUnifiedPrompt } from './unified-prompt';
import { createProviderOptimizedPrompt } from './provider-optimized-prompt';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PerformanceBenchmarks');

export interface BenchmarkOptions {
  cwd?: string;
  allowedHtmlElements?: string[];
  designScheme?: any;
  chatMode?: 'discuss' | 'build';
  contextOptimization?: boolean;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: { anonKey?: string; supabaseUrl?: string };
  };
  projectType?: 'web' | 'mobile' | 'node' | 'auto';
  detectedIntent?: DetectedIntent;
}

export interface BenchmarkResult {
  algorithm: string;
  providerName: string;
  verbosity?: VerbosityLevel;
  tokenCount: number;
  generationTime: number;
  memoryUsage?: number;
  compressionRatio: number; // Compared to baseline
  timestamp: number;
  metadata: {
    intentCategory?: string;
    intentConfidence?: string;
    optimizationsApplied: string[];
    sectionsIncluded: number;
    validationPassed: boolean;
  };
}

export interface BenchmarkComparison {
  baseline: BenchmarkResult;
  optimized: BenchmarkResult;
  improvement: {
    tokenReduction: number; // Percentage
    speedImprovement: number; // Percentage
    memoryReduction: number; // Percentage
    qualityScore: number; // 0-1 based on validation and intent accuracy
  };
  recommendation: string;
}

export interface PerformanceMetrics {
  averageTokenReduction: number;
  averageSpeedImprovement: number;
  averageCompressionRatio: number;
  successRate: number; // Percentage of successful optimizations
  providerEfficiency: Record<
    string,
    {
      averageReduction: number;
      averageSpeed: number;
      reliability: number;
    }
  >;
  trendAnalysis: {
    improvingMetrics: string[];
    decliningMetrics: string[];
    recommendations: string[];
  };
}

/**
 * Main performance benchmarking class
 */
export class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private baselineCache = new Map<string, BenchmarkResult>();

  /**
   * Runs a comprehensive benchmark comparing all prompt generation methods
   */
  async runComprehensiveBenchmark(
    options: BenchmarkOptions,
    providers: string[] = ['OpenAI', 'Anthropic', 'Groq', 'Ollama', 'Deepseek'],
  ): Promise<BenchmarkComparison[]> {
    logger.info('Starting comprehensive benchmark', { providers: providers.length });

    const comparisons: BenchmarkComparison[] = [];

    for (const providerName of providers) {
      // Benchmark original unified prompt
      const baselineResult = await this.benchmarkUnifiedPrompt(options, providerName);

      // Benchmark provider-optimized prompt
      const providerOptimizedResult = await this.benchmarkProviderOptimizedPrompt(options, providerName);

      // Benchmark new dynamic system
      const dynamicOptimizedResult = await this.benchmarkDynamicPrompt(options, providerName);

      // Compare provider-optimized vs baseline
      const providerComparison = this.compareResults(baselineResult, providerOptimizedResult);
      providerComparison.baseline = baselineResult;
      providerComparison.optimized = providerOptimizedResult;

      // Compare dynamic vs baseline
      const dynamicComparison = this.compareResults(baselineResult, dynamicOptimizedResult);
      dynamicComparison.baseline = baselineResult;
      dynamicComparison.optimized = dynamicOptimizedResult;

      comparisons.push(providerComparison, dynamicComparison);

      this.results.push(baselineResult, providerOptimizedResult, dynamicOptimizedResult);
    }

    logger.info('Comprehensive benchmark completed', {
      totalComparisons: comparisons.length,
      averageTokenReduction: this.calculateAverageTokenReduction(comparisons),
    });

    return comparisons;
  }

  /**
   * Benchmarks the original unified prompt system
   */
  private async benchmarkUnifiedPrompt(options: BenchmarkOptions, providerName: string): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      const prompt = createUnifiedPrompt({
        cwd: options.cwd || '/home/project',
        allowedHtmlElements: options.allowedHtmlElements || [],
        modificationTagName: 'boltArtifact',
        designScheme: options.designScheme,
        chatMode: options.chatMode,
        contextOptimization: options.contextOptimization,
        supabase: options.supabase,
        projectType: options.projectType,
      });

      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();

      return {
        algorithm: 'unified-prompt',
        providerName,
        tokenCount: this.estimateTokens(prompt),
        generationTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        compressionRatio: 1.0, // Baseline
        timestamp: Date.now(),
        metadata: {
          intentCategory: options.detectedIntent?.category,
          intentConfidence: options.detectedIntent?.confidence,
          optimizationsApplied: [],
          sectionsIncluded: this.countSections(prompt),
          validationPassed: true,
        },
      };
    } catch (error) {
      logger.error('Unified prompt benchmark failed', { providerName, error });
      return this.createErrorResult('unified-prompt', providerName);
    }
  }

  /**
   * Benchmarks the provider-optimized prompt system
   */
  private async benchmarkProviderOptimizedPrompt(
    options: BenchmarkOptions,
    providerName: string,
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      const prompt = createProviderOptimizedPrompt({
        cwd: options.cwd || '/home/project',
        allowedHtmlElements: options.allowedHtmlElements || [],
        modificationTagName: 'boltArtifact',
        designScheme: options.designScheme,
        chatMode: options.chatMode,
        contextOptimization: options.contextOptimization,
        supabase: options.supabase,
        projectType: options.projectType,
        providerName,
      });

      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();

      const baseline = this.getBaselineResult(providerName, options);
      const compressionRatio = baseline ? this.estimateTokens(prompt) / baseline.tokenCount : 1.0;

      return {
        algorithm: 'provider-optimized',
        providerName,
        tokenCount: this.estimateTokens(prompt),
        generationTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        compressionRatio,
        timestamp: Date.now(),
        metadata: {
          intentCategory: options.detectedIntent?.category,
          intentConfidence: options.detectedIntent?.confidence,
          optimizationsApplied: ['provider-specific'],
          sectionsIncluded: this.countSections(prompt),
          validationPassed: true,
        },
      };
    } catch (error) {
      logger.error('Provider-optimized prompt benchmark failed', { providerName, error });
      return this.createErrorResult('provider-optimized', providerName);
    }
  }

  /**
   * Benchmarks the new dynamic prompt system
   */
  private async benchmarkDynamicPrompt(options: BenchmarkOptions, providerName: string): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = generateOptimizedPrompt({
        providerName,
        chatMode: options.chatMode,
        contextOptimization: options.contextOptimization,
        supabase: options.supabase,
        projectType: options.projectType,
        detectedIntent: options.detectedIntent,
        cwd: options.cwd,
        allowedHtmlElements: options.allowedHtmlElements,
        designScheme: options.designScheme,
      });

      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();

      const baseline = this.getBaselineResult(providerName, options);
      const compressionRatio = baseline ? result.metadata.estimatedTokens / baseline.tokenCount : 1.0;

      return {
        algorithm: 'dynamic-optimized',
        providerName,
        verbosity: result.metadata.verbosityLevel,
        tokenCount: result.metadata.estimatedTokens,
        generationTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        compressionRatio,
        timestamp: Date.now(),
        metadata: {
          intentCategory: result.metadata.intentCategory,
          intentConfidence: options.detectedIntent?.confidence,
          optimizationsApplied: result.metadata.optimizationApplied
            ? [result.metadata.providerCategory, 'intent-based', 'verbosity-optimized']
            : ['verbosity-optimized'],
          sectionsIncluded: result.metadata.rulesIncluded.length,
          validationPassed: result.metadata.validationResults?.valid ?? true,
        },
      };
    } catch (error) {
      logger.error('Dynamic prompt benchmark failed', { providerName, error });
      return this.createErrorResult('dynamic-optimized', providerName);
    }
  }

  /**
   * Compares two benchmark results
   */
  private compareResults(baseline: BenchmarkResult, optimized: BenchmarkResult): BenchmarkComparison {
    const tokenReduction = ((baseline.tokenCount - optimized.tokenCount) / baseline.tokenCount) * 100;
    const speedImprovement = ((baseline.generationTime - optimized.generationTime) / baseline.generationTime) * 100;
    const memoryReduction =
      baseline.memoryUsage && optimized.memoryUsage
        ? ((baseline.memoryUsage - optimized.memoryUsage) / baseline.memoryUsage) * 100
        : 0;

    // Calculate quality score based on validation and intent accuracy
    let qualityScore = 0.5; // Base score

    if (optimized.metadata.validationPassed) {
      qualityScore += 0.3;
    }

    if (baseline.metadata.intentCategory === optimized.metadata.intentCategory) {
      qualityScore += 0.2;
    }

    let recommendation = '';

    if (tokenReduction > 50) {
      recommendation = 'Excellent optimization - significant token reduction achieved';
    } else if (tokenReduction > 25) {
      recommendation = 'Good optimization - moderate token reduction';
    } else if (tokenReduction > 0) {
      recommendation = 'Minor optimization - small token reduction';
    } else {
      recommendation = 'Optimization ineffective - consider alternative approach';
    }

    if (speedImprovement < 0) {
      recommendation += '. Warning: Generation time increased';
    }

    return {
      baseline,
      optimized,
      improvement: {
        tokenReduction,
        speedImprovement,
        memoryReduction,
        qualityScore,
      },
      recommendation,
    };
  }

  /**
   * Analyzes performance trends over time
   */
  analyzePerformanceTrends(): PerformanceMetrics {
    if (this.results.length === 0) {
      return this.createEmptyMetrics();
    }

    const optimizedResults = this.results.filter((r) => r.algorithm !== 'unified-prompt');
    const baselineResults = this.results.filter((r) => r.algorithm === 'unified-prompt');

    // Calculate average metrics
    const averageTokenReduction = this.calculateAverageTokenReduction(
      optimizedResults
        .map((opt) => {
          const baseline = baselineResults.find((base) => base.providerName === opt.providerName);
          return baseline ? this.compareResults(baseline, opt) : null;
        })
        .filter(Boolean) as BenchmarkComparison[],
    );

    const averageSpeedImprovement = this.calculateAverageSpeedImprovement(optimizedResults);
    const averageCompressionRatio = this.calculateAverageCompressionRatio(optimizedResults);
    const successRate = this.calculateSuccessRate(optimizedResults);

    // Provider-specific analysis
    const providerEfficiency = this.analyzeProviderEfficiency();

    // Trend analysis
    const trendAnalysis = this.analyzeTrends();

    return {
      averageTokenReduction,
      averageSpeedImprovement,
      averageCompressionRatio,
      successRate,
      providerEfficiency,
      trendAnalysis,
    };
  }

  /**
   * Utility methods
   */
  private estimateTokens(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  private countSections(content: string): number {
    return (content.match(/<[^>]+>/g) || []).length;
  }

  private getMemoryUsage(): number {
    // Simple memory usage estimation
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }

    return 0;
  }

  private getBaselineResult(providerName: string, options: BenchmarkOptions): BenchmarkResult | null {
    const cacheKey = `${providerName}-${JSON.stringify(options)}`;
    return this.baselineCache.get(cacheKey) || null;
  }

  private createErrorResult(algorithm: string, providerName: string): BenchmarkResult {
    return {
      algorithm,
      providerName,
      tokenCount: 0,
      generationTime: 0,
      compressionRatio: 0,
      timestamp: Date.now(),
      metadata: {
        optimizationsApplied: [],
        sectionsIncluded: 0,
        validationPassed: false,
      },
    };
  }

  private calculateAverageTokenReduction(comparisons: BenchmarkComparison[]): number {
    if (comparisons.length === 0) {
      return 0;
    }

    return comparisons.reduce((sum, comp) => sum + comp.improvement.tokenReduction, 0) / comparisons.length;
  }

  private calculateAverageSpeedImprovement(results: BenchmarkResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    return results.reduce((sum, result) => sum + (result.generationTime || 0), 0) / results.length;
  }

  private calculateAverageCompressionRatio(results: BenchmarkResult[]): number {
    if (results.length === 0) {
      return 1;
    }

    return results.reduce((sum, result) => sum + result.compressionRatio, 0) / results.length;
  }

  private calculateSuccessRate(results: BenchmarkResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    const successfulResults = results.filter((r) => r.metadata.validationPassed && r.tokenCount > 0);

    return (successfulResults.length / results.length) * 100;
  }

  private analyzeProviderEfficiency(): Record<
    string,
    { averageReduction: number; averageSpeed: number; reliability: number }
  > {
    const providerStats: Record<string, any> = {};

    for (const result of this.results) {
      if (!providerStats[result.providerName]) {
        providerStats[result.providerName] = {
          results: [],
          successCount: 0,
        };
      }

      providerStats[result.providerName].results.push(result);

      if (result.metadata.validationPassed) {
        providerStats[result.providerName].successCount++;
      }
    }

    const efficiency: Record<string, { averageReduction: number; averageSpeed: number; reliability: number }> = {};

    for (const [provider, stats] of Object.entries(providerStats)) {
      const results = stats.results as BenchmarkResult[];
      const optimizedResults = results.filter((r) => r.algorithm !== 'unified-prompt');

      const averageReduction =
        optimizedResults.reduce((sum, r) => sum + (1 - r.compressionRatio) * 100, 0) / optimizedResults.length || 0;
      const averageSpeed = results.reduce((sum, r) => sum + (r.generationTime || 0), 0) / results.length || 0;
      const reliability = (stats.successCount / results.length) * 100;

      efficiency[provider] = {
        averageReduction,
        averageSpeed,
        reliability,
      };
    }

    return efficiency;
  }

  private analyzeTrends(): { improvingMetrics: string[]; decliningMetrics: string[]; recommendations: string[] } {
    const improvingMetrics: string[] = [];
    const decliningMetrics: string[] = [];
    const recommendations: string[] = [];

    // Simple trend analysis based on recent results
    const recentResults = this.results.slice(-10); // Last 10 results
    const earlierResults = this.results.slice(0, -10);

    if (earlierResults.length > 0) {
      const recentAvgTokens = recentResults.reduce((sum, r) => sum + r.tokenCount, 0) / recentResults.length;
      const earlierAvgTokens = earlierResults.reduce((sum, r) => sum + r.tokenCount, 0) / earlierResults.length;

      if (recentAvgTokens < earlierAvgTokens) {
        improvingMetrics.push('Token efficiency');
      } else if (recentAvgTokens > earlierAvgTokens) {
        decliningMetrics.push('Token efficiency');
        recommendations.push('Review token optimization strategies');
      }

      const recentAvgSpeed = recentResults.reduce((sum, r) => sum + (r.generationTime || 0), 0) / recentResults.length;
      const earlierAvgSpeed =
        earlierResults.reduce((sum, r) => sum + (r.generationTime || 0), 0) / earlierResults.length;

      if (recentAvgSpeed < earlierAvgSpeed) {
        improvingMetrics.push('Generation speed');
      } else if (recentAvgSpeed > earlierAvgSpeed) {
        decliningMetrics.push('Generation speed');
        recommendations.push('Optimize prompt generation algorithms');
      }
    }

    return {
      improvingMetrics,
      decliningMetrics,
      recommendations,
    };
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      averageTokenReduction: 0,
      averageSpeedImprovement: 0,
      averageCompressionRatio: 1,
      successRate: 0,
      providerEfficiency: {},
      trendAnalysis: {
        improvingMetrics: [],
        decliningMetrics: [],
        recommendations: ['No data available for trend analysis'],
      },
    };
  }

  /**
   * Export results for analysis
   */
  exportResults(): {
    results: BenchmarkResult[];
    summary: PerformanceMetrics;
    timestamp: number;
  } {
    return {
      results: this.results,
      summary: this.analyzePerformanceTrends(),
      timestamp: Date.now(),
    };
  }

  /**
   * Clear stored results
   */
  clearResults(): void {
    this.results = [];
    this.baselineCache.clear();
    logger.info('Benchmark results cleared');
  }
}

/**
 * Factory function for creating and running benchmarks
 */
export async function runPerformanceBenchmark(
  options: BenchmarkOptions,
  providers?: string[],
): Promise<{
  comparisons: BenchmarkComparison[];
  metrics: PerformanceMetrics;
  recommendations: string[];
}> {
  const benchmark = new PerformanceBenchmark();
  const comparisons = await benchmark.runComprehensiveBenchmark(options, providers);
  const metrics = benchmark.analyzePerformanceTrends();

  // Generate consolidated recommendations
  const recommendations: string[] = [];
  const avgTokenReduction = metrics.averageTokenReduction;

  if (avgTokenReduction > 50) {
    recommendations.push('Excellent optimization performance - consider this as the standard approach');
  } else if (avgTokenReduction > 25) {
    recommendations.push('Good optimization - monitor for further improvements');
  } else {
    recommendations.push('Optimization needs improvement - review algorithms and thresholds');
  }

  if (metrics.successRate < 90) {
    recommendations.push('Success rate below 90% - investigate failure causes');
  }

  recommendations.push(...metrics.trendAnalysis.recommendations);

  return {
    comparisons,
    metrics,
    recommendations,
  };
}
