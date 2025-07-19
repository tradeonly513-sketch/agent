/**
 * Context Engine Manager
 *
 * Integrates the Bolt Context Engine with the existing chat system,
 * providing intelligent context management that prevents token overflow
 * and improves code generation quality.
 */

import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { BoltContextEngine, type ContextEngineOptions } from './core';

const logger = createScopedLogger('context-engine-manager');

// Client-safe types and interfaces
export interface FileMap {
  [path: string]: File | Folder;
}

export interface File {
  type: 'file';
  content: string;
}

export interface Folder {
  type: 'folder';
}

export interface ContextOptimizationResult {
  optimizedContext: string;
  originalTokens: number;
  optimizedTokens: number;
  compressionRatio: number;
  strategy: 'none' | 'semantic-retrieval' | 'compression' | 'hybrid';
  metadata: {
    intent: any;
    nodesRetrieved: number;
    indexedFiles: number;
    processingTime: number;
  };
  error?: string;
}

export interface ContextEngineManagerOptions {
  enableSmartRetrieval: boolean;
  enableCompression: boolean;
  maxContextRatio: number; // Percentage of context window to use
  compressionThreshold: number; // Token count to trigger compression
  semanticThreshold: number;
  maxRetrievedNodes: number;
}

export class ContextEngineManager {
  private engine: BoltContextEngine;
  private options: ContextEngineManagerOptions;
  private lastIndexTime: number = 0;
  private indexCache: Map<string, number> = new Map(); // File path -> last modified time

  constructor(options: Partial<ContextEngineManagerOptions> = {}) {
    this.options = {
      enableSmartRetrieval: true,
      enableCompression: true,
      maxContextRatio: 0.7, // Use 70% of context window
      compressionThreshold: 8000, // Start compression above 8k tokens
      semanticThreshold: 0.7,
      maxRetrievedNodes: 30,
      ...options,
    };

    const engineOptions: Partial<ContextEngineOptions> = {
      semanticThreshold: this.options.semanticThreshold,
      maxRetrievedNodes: this.options.maxRetrievedNodes,
      compressionTarget: 0.6, // Compress to 60% of original
      enableMemory: true,
    };

    this.engine = new BoltContextEngine(engineOptions);
  }

  /**
   * Main entry point for context optimization
   * Called from the chat API to optimize context before sending to LLM
   */
  async optimizeContext(
    messages: Message[],
    files: FileMap,
    model: string,
    systemPrompt?: string,
  ): Promise<ContextOptimizationResult> {
    const startTime = Date.now();

    try {
      // Calculate available context window (client-safe fallback)
      const maxContextTokens = this.getModelContextWindow(model);
      const maxUsableTokens = Math.floor(maxContextTokens * this.options.maxContextRatio);

      // Calculate current token usage
      const systemTokens = systemPrompt ? this.estimateTokens(systemPrompt) : 0;
      const messageTokens = this.countMessagesTokens(messages);
      const currentTotal = systemTokens + messageTokens;

      logger.info(`Context optimization: ${currentTotal}/${maxUsableTokens} tokens (${model})`);

      // If we're under the threshold, no optimization needed
      if (currentTotal <= maxUsableTokens && !this.shouldOptimizeForQuality(messages, files)) {
        return {
          optimizedContext: '',
          originalTokens: currentTotal,
          optimizedTokens: currentTotal,
          compressionRatio: 1.0,
          strategy: 'none',
          metadata: {
            intent: null,
            nodesRetrieved: 0,
            indexedFiles: 0,
            processingTime: Date.now() - startTime,
          },
        };
      }

      // Check if we need to reindex files
      await this.ensureIndexUpToDate(files);

      // Determine optimization strategy
      const strategy = this.determineOptimizationStrategy(currentTotal, maxUsableTokens, files);

      let optimizedContext = '';
      let metadata: any = {};

      switch (strategy) {
        case 'semantic-retrieval':
          const retrievalResult = await this.performSemanticRetrieval(messages, files, maxUsableTokens);
          optimizedContext = retrievalResult.context;
          metadata = retrievalResult.metadata;
          break;

        case 'compression':
          const compressionResult = await this.performCompression(messages, files, maxUsableTokens);
          optimizedContext = compressionResult.context;
          metadata = compressionResult.metadata;
          break;

        case 'hybrid':
          const hybridResult = await this.performHybridOptimization(messages, files, maxUsableTokens);
          optimizedContext = hybridResult.context;
          metadata = hybridResult.metadata;
          break;

        default:
          throw new Error(`Unknown optimization strategy: ${strategy}`);
      }

      const optimizedTokens = this.estimateTokens(optimizedContext);
      const compressionRatio = optimizedTokens / currentTotal;

      const result: ContextOptimizationResult = {
        optimizedContext,
        originalTokens: currentTotal,
        optimizedTokens,
        compressionRatio,
        strategy,
        metadata: {
          ...metadata,
          processingTime: Date.now() - startTime,
        },
      };

      logger.info(
        `Context optimization completed: ${strategy}, ${currentTotal} -> ${optimizedTokens} tokens (${(compressionRatio * 100).toFixed(1)}%)`,
      );

      return result;
    } catch (error) {
      logger.error('Context optimization failed:', error);

      // Fallback: return empty context to proceed with original messages
      return {
        optimizedContext: '',
        originalTokens: 0,
        optimizedTokens: 0,
        compressionRatio: 1.0,
        strategy: 'none',
        metadata: {
          intent: null,
          nodesRetrieved: 0,
          indexedFiles: 0,
          processingTime: Date.now() - startTime,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if we should optimize for quality even if under token limit
   */
  private shouldOptimizeForQuality(messages: Message[], files: FileMap): boolean {
    // Optimize if we have a large codebase that could benefit from semantic retrieval
    const fileCount = Object.keys(files).length;
    return fileCount > 20 && this.options.enableSmartRetrieval;
  }

  /**
   * Ensure the file index is up to date
   */
  private async ensureIndexUpToDate(files: FileMap): Promise<void> {
    let needsReindex = false;
    const now = Date.now();

    // Check if any files have been modified since last index
    for (const [filePath, fileInfo] of Object.entries(files)) {
      if (!fileInfo || fileInfo.type !== 'file') {
        continue;
      }

      const fileContent = fileInfo as File;
      const lastModified = now; // File interface doesn't have lastModified
      const cachedTime = this.indexCache.get(filePath);

      if (!cachedTime || lastModified > cachedTime) {
        needsReindex = true;
        this.indexCache.set(filePath, lastModified);
      }
    }

    // Also reindex if it's been more than 10 minutes
    if (now - this.lastIndexTime > 10 * 60 * 1000) {
      needsReindex = true;
    }

    if (needsReindex) {
      logger.info('Reindexing codebase...');
      await this.engine.indexCodebase(files);
      this.lastIndexTime = now;
    }
  }

  /**
   * Determine the best optimization strategy
   */
  private determineOptimizationStrategy(
    currentTokens: number,
    maxTokens: number,
    files: FileMap,
  ): ContextOptimizationResult['strategy'] {
    const fileCount = Object.keys(files).length;
    const overageRatio = currentTokens / maxTokens;

    // If we have many files and are only slightly over, use semantic retrieval
    if (fileCount > 10 && overageRatio < 1.5 && this.options.enableSmartRetrieval) {
      return 'semantic-retrieval';
    }

    // If we're significantly over and compression is enabled, use compression
    if (overageRatio > 1.5 && this.options.enableCompression) {
      return 'compression';
    }

    // For complex cases, use hybrid approach
    if (fileCount > 20 && overageRatio > 1.2) {
      return 'hybrid';
    }

    // Default to semantic retrieval if available
    return this.options.enableSmartRetrieval ? 'semantic-retrieval' : 'compression';
  }

  /**
   * Perform semantic retrieval optimization
   */
  private async performSemanticRetrieval(
    messages: Message[],
    files: FileMap,
    maxTokens: number,
  ): Promise<{ context: string; metadata: any }> {
    const result = await this.engine.optimizeContext(messages, files, maxTokens);
    return result;
  }

  /**
   * Perform compression optimization
   */
  private async performCompression(
    messages: Message[],
    files: FileMap,
    maxTokens: number,
  ): Promise<{ context: string; metadata: any }> {
    // For compression-only strategy, we'll compress the entire codebase
    const allFiles = Object.entries(files)
      .filter(([_, fileInfo]) => fileInfo && fileInfo.type === 'file')
      .map(([path, fileInfo]) => {
        const fileContent = fileInfo as File;
        return {
          id: `file:${path}`,
          type: 'file' as const,
          path,
          name: path.split('/').pop() || path,
          content: fileContent.content || '',
          dependencies: [],
          dependents: [],
          relevanceScore: 1.0,
          lastAccessed: Date.now(),
          accessCount: 1,
        };
      });

    const compressionResult = await this.engine.compressContext(allFiles, maxTokens);

    return {
      context: compressionResult.compressed,
      metadata: {
        intent: null,
        nodesRetrieved: allFiles.length,
        compression: compressionResult,
        indexedFiles: allFiles.length,
      },
    };
  }

  /**
   * Perform hybrid optimization (semantic retrieval + compression)
   */
  private async performHybridOptimization(
    messages: Message[],
    files: FileMap,
    maxTokens: number,
  ): Promise<{ context: string; metadata: any }> {
    // First, perform semantic retrieval with a higher token budget
    const retrievalBudget = Math.floor(maxTokens * 1.5); // 150% of target
    const retrievalResult = await this.engine.optimizeContext(messages, files, retrievalBudget);

    // Then compress the retrieved context to fit the actual budget
    const retrievalTokens = this.estimateTokens(retrievalResult.context);

    if (retrievalTokens <= maxTokens) {
      return retrievalResult;
    }

    // Need to compress further
    const nodes: any[] = []; // This would contain the retrieved nodes
    const compressionResult = await this.engine.compressContext(nodes, maxTokens);

    return {
      context: compressionResult.compressed,
      metadata: {
        ...retrievalResult.metadata,
        compression: compressionResult,
        strategy: 'hybrid',
      },
    };
  }

  /**
   * Estimate token count for text (client-safe)
   */
  private estimateTokens(text: string): number {
    if (!text) {
      return 0;
    }

    /*
     * Simple estimation: roughly 4 characters per token for most models
     * This is a conservative estimate that works across different tokenizers
     */
    return Math.ceil(text.length / 4);
  }

  /**
   * Client-safe model context window lookup
   */
  private getModelContextWindow(model: string): number {
    // Common model context windows (fallback values)
    const contextWindows: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-5-haiku-20241022': 200000,
      'claude-3-opus-20240229': 200000,
      'gemini-1.5-pro-latest': 2000000,
      'gemini-1.5-flash-latest': 1000000,
    };

    // Extract base model name for matching
    const baseModel = model.toLowerCase().split('-').slice(0, 3).join('-');

    return contextWindows[model] || contextWindows[baseModel] || 4096; // Default fallback
  }

  /**
   * Client-safe message token counting
   */
  private countMessagesTokens(messages: Message[]): number {
    return messages.reduce((total, message) => {
      const content =
        typeof message.content === 'string'
          ? message.content
          : Array.isArray(message.content)
            ? message.content.map((part) => (typeof part === 'string' ? part : part.text || '')).join(' ')
            : '';
      return total + this.estimateTokens(content);
    }, 0);
  }

  /**
   * Get context engine statistics
   */
  getStatistics(): {
    indexedNodes: number;
    lastIndexTime: number;
    cacheSize: number;
  } {
    return {
      indexedNodes: this.engine.nodes?.size || 0,
      lastIndexTime: this.lastIndexTime,
      cacheSize: this.indexCache.size,
    };
  }

  /**
   * Clear the context engine cache and index
   */
  clearCache(): void {
    this.indexCache.clear();
    this.lastIndexTime = 0;

    // Note: We don't clear the engine's internal state as it may be expensive to rebuild
  }

  /**
   * Update configuration
   */
  updateOptions(newOptions: Partial<ContextEngineManagerOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}
