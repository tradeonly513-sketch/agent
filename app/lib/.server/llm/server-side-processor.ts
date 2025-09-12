/**
 * Server-Side Processing Enhancement
 * Offloads heavy processing from client to server
 * PhD-level implementation for optimal resource distribution
 */

import { createScopedLogger } from '~/utils/logger';
import type { Message } from 'ai';

const logger = createScopedLogger('ServerSideProcessor');

export interface ProcessingConfig {
  enableServerSideOptimization: boolean;
  maxChunkSize: number;
  streamingChunkDelay: number;
  enableCompression: boolean;
  enableCaching: boolean;
  cacheTimeout: number;
  maxConcurrentProcessing: number;
}

export class ServerSideProcessor {
  private static _instance: ServerSideProcessor;

  private _config: ProcessingConfig = {
    enableServerSideOptimization: true,
    maxChunkSize: 1024, // 1KB chunks for streaming
    streamingChunkDelay: 50, // 50ms between chunks
    enableCompression: true,
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes
    maxConcurrentProcessing: 3,
  };

  private _processingQueue: Map<string, Promise<any>> = new Map();
  private _responseCache: Map<string, { data: any; timestamp: number }> = new Map();
  private _activeProcessing = 0;

  private _constructor() {
    this._initializeProcessor();
  }

  static getInstance(): ServerSideProcessor {
    if (!ServerSideProcessor._instance) {
      ServerSideProcessor._instance = new ServerSideProcessor();
    }

    return ServerSideProcessor._instance;
  }

  private _initializeProcessor() {
    logger.info('🚀 Server-Side Processor initialized');

    // Setup periodic cache cleanup
    setInterval(() => {
      this._cleanupCache();
    }, 60000); // Every minute
  }

  /**
   * Pre-process messages on server before sending to LLM
   */
  async preprocessMessages(messages: Message[]): Promise<Message[]> {
    logger.debug(`Pre-processing ${messages.length} messages on server`);

    // Batch process messages for efficiency
    const processed = await Promise.all(
      messages.map(async (msg) => {
        // Remove unnecessary data
        const optimized = this._optimizeMessage(msg);

        // Compress large content
        if (this._config.enableCompression && optimized.content.length > 5000) {
          optimized.content = await this._compressContent(optimized.content);
        }

        return optimized;
      }),
    );

    logger.debug(`Processed messages, reduced size by ${this._calculateSizeReduction(messages, processed)}%`);

    return processed;
  }

  /**
   * Post-process LLM response on server before sending to client
   */
  async postprocessResponse(response: string, messageId: string): Promise<string> {
    // Check cache first
    const cached = this._getCachedResponse(messageId);

    if (cached) {
      logger.debug(`Cache hit for message ${messageId}`);
      return cached;
    }

    // Process response
    let processed = response;

    // Extract and process code blocks separately
    processed = await this._processCodeBlocks(processed);

    // Optimize for streaming
    processed = this._optimizeForStreaming(processed);

    // Cache the processed response
    if (this._config.enableCaching) {
      this._cacheResponse(messageId, processed);
    }

    return processed;
  }

  /**
   * Stream response in optimized chunks
   */
  async *streamOptimizedResponse(
    response: string,
    onProgress?: (progress: number) => void,
  ): AsyncGenerator<string, void, unknown> {
    const chunks = this._createOptimizedChunks(response);
    const totalChunks = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      // Yield chunk
      yield chunks[i];

      // Report progress
      if (onProgress) {
        onProgress((i + 1) / totalChunks);
      }

      // Add delay to prevent client overload
      if (this._config.streamingChunkDelay > 0) {
        await this._delay(this._config.streamingChunkDelay);
      }
    }
  }

  /**
   * Optimize message by removing unnecessary data
   */
  private _optimizeMessage(message: Message): Message {
    const optimized = { ...message };

    // Remove redundant whitespace
    if (typeof optimized.content === 'string') {
      optimized.content = optimized.content
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // Remove large base64 images if present
    if (optimized.content.includes('data:image')) {
      optimized.content = optimized.content.replace(
        /data:image\/[^;]+;base64,[^\s"]+/g,
        '[IMAGE_REMOVED_FOR_OPTIMIZATION]',
      );
    }

    return optimized;
  }

  /**
   * Compress content for reduced bandwidth
   */
  private async _compressContent(content: string): Promise<string> {
    try {
      // Use simple compression for now (remove redundancy)
      const compressed = content
        .replace(/(\r\n|\n|\r)/gm, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n');

      logger.debug(`Compressed content from ${content.length} to ${compressed.length} bytes`);

      return compressed;
    } catch (error) {
      logger.error('Compression failed:', error);
      return content;
    }
  }

  /**
   * Process code blocks separately for optimization
   */
  private async _processCodeBlocks(content: string): Promise<string> {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks = content.match(codeBlockRegex) || [];

    if (codeBlocks.length === 0) {
      return content;
    }

    let processed = content;

    for (const block of codeBlocks) {
      // Extract language and code
      const lines = block.split('\n');
      const language = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');

      // Optimize code block
      const optimized = this._optimizeCodeBlock(code, language);

      // Replace in content
      processed = processed.replace(block, `\`\`\`${language}\n${optimized}\n\`\`\``);
    }

    return processed;
  }

  /**
   * Optimize code block content
   */
  private _optimizeCodeBlock(code: string, language: string): string {
    // Remove trailing whitespace
    let optimized = code
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n');

    // Remove excessive blank lines
    optimized = optimized.replace(/\n{3,}/g, '\n\n');

    // Language-specific optimizations
    if (language === 'json') {
      try {
        // Minify JSON
        const parsed = JSON.parse(optimized);
        optimized = JSON.stringify(parsed, null, 2);
      } catch {
        // Keep original if parsing fails
      }
    }

    return optimized;
  }

  /**
   * Optimize content for streaming delivery
   */
  private _optimizeForStreaming(content: string): string {
    // Split into logical segments for better streaming
    const segments = content.split(/(?<=\.\s)|(?<=\n)/);

    // Rejoin with markers for optimal chunk boundaries
    return segments.join('');
  }

  /**
   * Create optimized chunks for streaming
   */
  private _createOptimizedChunks(content: string): string[] {
    const chunks: string[] = [];
    const maxChunkSize = this._config.maxChunkSize;

    // Split by natural boundaries
    const sentences = content.split(/(?<=\.\s)|(?<=\n)|(?<=\?)|(?<=!)/);

    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxChunkSize) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Calculate size reduction percentage
   */
  private _calculateSizeReduction(original: Message[], processed: Message[]): number {
    const originalSize = JSON.stringify(original).length;
    const processedSize = JSON.stringify(processed).length;

    if (originalSize === 0) {
      return 0;
    }

    const reduction = ((originalSize - processedSize) / originalSize) * 100;

    return Math.max(0, Math.round(reduction));
  }

  /**
   * Get cached response
   */
  private _getCachedResponse(messageId: string): string | null {
    const cached = this._responseCache.get(messageId);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this._config.cacheTimeout) {
      this._responseCache.delete(messageId);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache response
   */
  private _cacheResponse(messageId: string, response: string): void {
    // Limit cache size
    if (this._responseCache.size >= 50) {
      // Remove oldest entry
      const firstKey = this._responseCache.keys().next().value;

      if (firstKey) {
        this._responseCache.delete(firstKey);
      }
    }

    this._responseCache.set(messageId, {
      data: response,
      timestamp: Date.now(),
    });
  }

  /**
   * Cleanup expired cache entries
   */
  private _cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    this._responseCache.forEach((value, key) => {
      if (now - value.timestamp > this._config.cacheTimeout) {
        this._responseCache.delete(key);
        removed++;
      }
    });

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Queue processing to avoid overload
   */
  async queueProcessing<T>(key: string, processor: () => Promise<T>): Promise<T> {
    // Check if already processing
    const existing = this._processingQueue.get(key);

    if (existing) {
      logger.debug(`Reusing existing processing for ${key}`);
      return existing;
    }

    // Wait if at max concurrent processing
    while (this._activeProcessing >= this._config.maxConcurrentProcessing) {
      await this._delay(100);
    }

    this._activeProcessing++;

    const promise = processor().finally(() => {
      this._activeProcessing--;
      this._processingQueue.delete(key);
    });

    this._processingQueue.set(key, promise);

    return promise;
  }

  /**
   * Utility delay function
   */
  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      activeProcessing: this._activeProcessing,
      queueSize: this._processingQueue.size,
      cacheSize: this._responseCache.size,
      config: this._config,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProcessingConfig>) {
    this._config = { ...this._config, ...config };
    logger.debug('Configuration updated:', config);
  }
}

// Export singleton instance
export const serverSideProcessor = ServerSideProcessor.getInstance();
