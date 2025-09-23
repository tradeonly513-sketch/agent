import type { Message } from 'ai';
import type { FileMap } from './constants';
import { createSummary } from './create-summary';
import { selectContext } from './select-context';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { withTimeout } from '~/utils/promises';

const logger = createScopedLogger('ProgressiveContextLoader');

interface ProgressiveLoadingOptions {
  maxConcurrentOperations: number;
  baseTimeoutMs: number;
  maxTimeoutMs: number;
  fallbackThresholdMs: number;
  chunkSize: number;
}

interface LoadingProgress {
  stage: 'summary' | 'context' | 'complete' | 'failed';
  progress: number; // 0-100
  timeElapsed: number;
  error?: Error;
  partialResults?: {
    summary?: string;
    contextFiles?: FileMap;
  };
}

interface AdaptiveTimeout {
  summary: number;
  context: number;
  calculated: boolean;
  factors: {
    conversationLength: number;
    fileCount: number;
    totalSize: number;
    complexity: number;
  };
}

/**
 * Progressive context loader that handles large conversations and codebases
 * by loading content incrementally with adaptive timeouts and fallback strategies.
 */
export class ProgressiveContextLoader {
  private _options: ProgressiveLoadingOptions;
  private _abortController?: AbortController;
  private _progressCallback?: (progress: LoadingProgress) => void;

  constructor(options: Partial<ProgressiveLoadingOptions> = {}) {
    this._options = {
      maxConcurrentOperations: 3,
      baseTimeoutMs: 30000, // 30 seconds base
      maxTimeoutMs: 180000, // 3 minutes max
      fallbackThresholdMs: 90000, // 1.5 minutes fallback threshold
      chunkSize: 50, // Process 50 files at a time
      ...options,
    };

    logger.debug('ProgressiveContextLoader initialized', this._options);
  }

  /**
   * Load context and summary progressively with intelligent timeout handling
   */
  async loadContextProgressive({
    messages,
    env,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    onProgress,
    onFinish,
  }: {
    messages: Message[];
    env?: Env;
    apiKeys?: Record<string, string>;
    files: FileMap;
    providerSettings?: Record<string, IProviderSetting>;
    promptId?: string;
    contextOptimization?: boolean;
    onProgress?: (progress: LoadingProgress) => void;
    onFinish?: (results: { summary?: string; contextFiles?: FileMap }) => void;
  }): Promise<{ summary?: string; contextFiles?: FileMap }> {
    this._abortController = new AbortController();
    this._progressCallback = onProgress;

    const startTime = Date.now();

    let summary: string | undefined;
    let contextFiles: FileMap | undefined;

    try {
      // Calculate adaptive timeouts based on content size and complexity
      const adaptiveTimeouts = this._calculateAdaptiveTimeouts(messages, files);

      // Stage 1: Create summary with progressive loading
      this._reportProgress({
        stage: 'summary',
        progress: 10,
        timeElapsed: Date.now() - startTime,
        partialResults: {},
      });

      try {
        summary = await this._loadSummaryProgressive({
          messages,
          env,
          apiKeys,
          providerSettings,
          promptId,
          contextOptimization,
          timeout: adaptiveTimeouts.summary,
          onFinish,
        });

        this._reportProgress({
          stage: 'summary',
          progress: 50,
          timeElapsed: Date.now() - startTime,
          partialResults: { summary },
        });
      } catch (error) {
        logger.warn('Summary generation failed, using fallback', error);
        summary = this._generateFallbackSummary(messages);

        this._reportProgress({
          stage: 'summary',
          progress: 50,
          timeElapsed: Date.now() - startTime,
          partialResults: { summary },
          error: error as Error,
        });
      }

      // Stage 2: Select context with progressive loading
      this._reportProgress({
        stage: 'context',
        progress: 60,
        timeElapsed: Date.now() - startTime,
        partialResults: { summary },
      });

      try {
        contextFiles = await this._loadContextProgressive({
          messages,
          env,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          summary: summary || '',
          timeout: adaptiveTimeouts.context,
          onFinish,
        });

        this._reportProgress({
          stage: 'context',
          progress: 90,
          timeElapsed: Date.now() - startTime,
          partialResults: { summary, contextFiles },
        });
      } catch (error) {
        logger.warn('Context selection failed, using fallback', error);
        contextFiles = this._generateFallbackContext(messages, files);

        this._reportProgress({
          stage: 'context',
          progress: 90,
          timeElapsed: Date.now() - startTime,
          partialResults: { summary, contextFiles },
          error: error as Error,
        });
      }

      // Complete
      this._reportProgress({
        stage: 'complete',
        progress: 100,
        timeElapsed: Date.now() - startTime,
        partialResults: { summary, contextFiles },
      });

      const results = { summary, contextFiles };
      onFinish?.(results);

      return results;
    } catch (error) {
      this._reportProgress({
        stage: 'failed',
        progress: 0,
        timeElapsed: Date.now() - startTime,
        error: error as Error,
        partialResults: { summary, contextFiles },
      });

      // Even on failure, return partial results if available
      const fallbackResults = {
        summary: summary || this._generateFallbackSummary(messages),
        contextFiles: contextFiles || this._generateFallbackContext(messages, files),
      };

      onFinish?.(fallbackResults);

      return fallbackResults;
    }
  }

  /**
   * Load summary with progressive timeout handling
   */
  private async _loadSummaryProgressive({
    messages,
    env,
    apiKeys,
    providerSettings,
    promptId,
    contextOptimization,
    timeout,
    onFinish,
  }: {
    messages: Message[];
    env?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    promptId?: string;
    contextOptimization?: boolean;
    timeout: number;
    onFinish?: (resp: any) => void;
  }): Promise<string> {
    // For very large conversations, process in chunks
    if (messages.length > 50) {
      return this._processMessageChunks(messages, {
        env,
        apiKeys,
        providerSettings,
        promptId,
        contextOptimization,
        timeout,
        onFinish,
      });
    }

    // Regular processing with adaptive timeout
    return withTimeout(
      createSummary({
        messages,
        env,
        apiKeys,
        providerSettings,
        promptId,
        contextOptimization,
        onFinish,
      }),
      timeout,
      'Summary generation timed out',
    );
  }

  /**
   * Load context with progressive file selection
   */
  private async _loadContextProgressive({
    messages,
    env,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    summary,
    timeout,
    onFinish,
  }: {
    messages: Message[];
    env?: Env;
    apiKeys?: Record<string, string>;
    files: FileMap;
    providerSettings?: Record<string, IProviderSetting>;
    promptId?: string;
    contextOptimization?: boolean;
    summary: string;
    timeout: number;
    onFinish?: (resp: any) => void;
  }): Promise<FileMap> {
    const fileCount = Object.keys(files).length;

    // For large codebases, process files in chunks
    if (fileCount > this._options.chunkSize) {
      return this._processFileChunks(files, {
        messages,
        env,
        apiKeys,
        providerSettings,
        promptId,
        contextOptimization,
        summary,
        timeout,
        onFinish,
      });
    }

    // Regular processing with adaptive timeout
    return withTimeout(
      selectContext({
        messages,
        env,
        apiKeys,
        files,
        providerSettings,
        promptId,
        contextOptimization,
        summary,
        onFinish,
      }),
      timeout,
      'Context selection timed out',
    );
  }

  /**
   * Process large conversations in chunks
   */
  private async _processMessageChunks(
    messages: Message[],
    options: {
      env?: Env;
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      promptId?: string;
      contextOptimization?: boolean;
      timeout: number;
      onFinish?: (resp: any) => void;
    },
  ): Promise<string> {
    const chunkSize = 25; // Process 25 messages at a time
    const chunks: Message[][] = [];

    // Split messages into chunks, keeping conversation coherence
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    const summaries: string[] = [];

    // Process chunks sequentially to maintain coherence
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkTimeout = Math.max(options.timeout / chunks.length, 15000); // Min 15s per chunk

      try {
        const chunkSummary = await withTimeout(
          createSummary({
            messages: chunk,
            env: options.env,
            apiKeys: options.apiKeys,
            providerSettings: options.providerSettings,
            promptId: options.promptId,
            contextOptimization: options.contextOptimization,
            onFinish: options.onFinish,
          }),
          chunkTimeout,
          `Chunk ${i + 1} summary timed out`,
        );

        summaries.push(chunkSummary);

        // Update progress
        const progress = ((i + 1) / chunks.length) * 40 + 10; // 10-50% for summary
        this._reportProgress({
          stage: 'summary',
          progress,
          timeElapsed: Date.now(),
          partialResults: { summary: summaries.join('\n\n') },
        });
      } catch (error) {
        logger.warn(`Chunk ${i + 1} failed, using fallback`, error);
        summaries.push(this._generateFallbackSummary(chunk));
      }
    }

    return summaries.join('\n\n---\n\n');
  }

  /**
   * Process large file sets in chunks
   */
  private async _processFileChunks(
    files: FileMap,
    options: {
      messages: Message[];
      env?: Env;
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      promptId?: string;
      contextOptimization?: boolean;
      summary: string;
      timeout: number;
      onFinish?: (resp: any) => void;
    },
  ): Promise<FileMap> {
    const fileEntries = Object.entries(files);
    const chunkSize = this._options.chunkSize;
    const chunks: Array<[string, any][]> = [];

    // Split files into chunks
    for (let i = 0; i < fileEntries.length; i += chunkSize) {
      const chunk = fileEntries.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    let contextFiles: FileMap = {};

    // Process chunks with priority-based ordering
    const priorityChunks = this._prioritizeFileChunks(chunks, options.messages);

    for (let i = 0; i < priorityChunks.length; i++) {
      const chunk = priorityChunks[i];
      const chunkFiles = Object.fromEntries(chunk);
      const chunkTimeout = Math.max(options.timeout / priorityChunks.length, 20000); // Min 20s per chunk

      try {
        const chunkContext = await withTimeout(
          selectContext({
            messages: options.messages,
            env: options.env,
            apiKeys: options.apiKeys,
            files: chunkFiles,
            providerSettings: options.providerSettings,
            promptId: options.promptId,
            contextOptimization: options.contextOptimization,
            summary: options.summary,
            onFinish: options.onFinish,
          }),
          chunkTimeout,
          `File chunk ${i + 1} context selection timed out`,
        );

        contextFiles = { ...contextFiles, ...chunkContext };

        // Update progress
        const progress = ((i + 1) / priorityChunks.length) * 30 + 60; // 60-90% for context
        this._reportProgress({
          stage: 'context',
          progress,
          timeElapsed: Date.now(),
          partialResults: { contextFiles },
        });

        // If we have enough context files, stop early
        if (Object.keys(contextFiles).length >= 5) {
          logger.debug(`Early termination: Got ${Object.keys(contextFiles).length} context files`);
          break;
        }
      } catch (error) {
        logger.warn(`File chunk ${i + 1} failed, continuing with next chunk`, error);

        // Continue with next chunk instead of failing completely
      }
    }

    return contextFiles;
  }

  /**
   * Prioritize file chunks based on conversation context
   */
  private _prioritizeFileChunks(chunks: Array<[string, any][]>, messages: Message[]): Array<[string, any][]> {
    // Extract mentioned files from recent messages
    const recentMessages = messages.slice(-10); // Last 10 messages
    const mentionedFiles = new Set<string>();

    for (const message of recentMessages) {
      const content = typeof message.content === 'string' ? message.content : '';

      // Look for file paths and names
      const fileMatches = content.match(/[\w\/.-]+\.(js|ts|jsx|tsx|py|java|cpp|c|h|css|html|md|json|xml|yaml|yml)/gi);

      if (fileMatches) {
        fileMatches.forEach((file) => mentionedFiles.add(file.toLowerCase()));
      }
    }

    // Sort chunks by relevance
    return chunks.sort((a, b) => {
      const scoreA = this._calculateChunkRelevance(a, mentionedFiles);
      const scoreB = this._calculateChunkRelevance(b, mentionedFiles);

      return scoreB - scoreA; // Higher score first
    });
  }

  /**
   * Calculate relevance score for a file chunk
   */
  private _calculateChunkRelevance(chunk: [string, any][], mentionedFiles: Set<string>): number {
    let score = 0;

    for (const [filePath] of chunk) {
      const fileName = filePath.split('/').pop()?.toLowerCase() || '';
      const pathLower = filePath.toLowerCase();

      // High priority for mentioned files
      if (mentionedFiles.has(fileName) || Array.from(mentionedFiles).some((f) => pathLower.includes(f))) {
        score += 10;
      }

      // Medium priority for important file types
      if (/(package\.json|tsconfig\.json|index\.|main\.|app\.)/.test(fileName)) {
        score += 5;
      }

      // Lower priority for config and test files
      if (/(config|test|spec)/.test(fileName)) {
        score += 2;
      }
    }

    return score;
  }

  /**
   * Calculate adaptive timeouts based on content complexity
   */
  private _calculateAdaptiveTimeouts(messages: Message[], files: FileMap): AdaptiveTimeout {
    const conversationLength = messages.length;
    const fileCount = Object.keys(files).length;

    const totalSize = Object.values(files).reduce((total, file) => {
      if (file?.type === 'file' && typeof file.content === 'string') {
        return total + file.content.length;
      }

      return total;
    }, 0);

    // Calculate complexity score
    const complexity = this._calculateComplexityScore(messages, totalSize);

    // Base timeouts
    let summaryTimeout = this._options.baseTimeoutMs;
    let contextTimeout = this._options.baseTimeoutMs;

    // Adjust based on conversation length
    if (conversationLength > 20) {
      summaryTimeout += Math.min(conversationLength * 1000, 60000); // Max 60s additional
    }

    // Adjust based on file count
    if (fileCount > 10) {
      contextTimeout += Math.min(fileCount * 2000, 90000); // Max 90s additional
    }

    // Adjust based on total size
    if (totalSize > 100000) {
      // 100KB
      const sizeMultiplier = Math.min(totalSize / 100000, 3); // Max 3x multiplier
      contextTimeout *= sizeMultiplier;
      summaryTimeout *= Math.min(sizeMultiplier, 2); // Max 2x for summary
    }

    // Complexity adjustment
    summaryTimeout *= 1 + complexity * 0.5;
    contextTimeout *= 1 + complexity * 0.3;

    // Enforce limits
    summaryTimeout = Math.min(summaryTimeout, this._options.maxTimeoutMs);
    contextTimeout = Math.min(contextTimeout, this._options.maxTimeoutMs);

    return {
      summary: summaryTimeout,
      context: contextTimeout,
      calculated: true,
      factors: {
        conversationLength,
        fileCount,
        totalSize,
        complexity,
      },
    };
  }

  /**
   * Calculate complexity score based on content analysis
   */
  private _calculateComplexityScore(messages: Message[], totalSize: number): number {
    let complexity = 0;

    // Analyze message complexity
    for (const message of messages) {
      const content = typeof message.content === 'string' ? message.content : '';

      // Technical keywords indicate complexity
      const technicalKeywords = ['error', 'bug', 'fail', 'issue', 'fix', 'debug', 'implement', 'refactor'];

      const keywordMatches = technicalKeywords.filter((keyword) => content.toLowerCase().includes(keyword)).length;

      complexity += keywordMatches * 0.1;

      // Code blocks indicate complexity
      const codeBlockMatches = (content.match(/```/g) || []).length / 2;
      complexity += codeBlockMatches * 0.2;
    }

    // File size complexity
    if (totalSize > 500000) {
      // 500KB
      complexity += 0.5;
    }

    return Math.min(complexity, 2); // Cap at 2.0
  }

  /**
   * Generate fallback summary when AI generation fails
   */
  private _generateFallbackSummary(messages: Message[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];

    return `# Conversation Summary (Fallback)

## Current Context
- Total messages: ${messages.length}
- User messages: ${userMessages.length}
- Assistant messages: ${assistantMessages.length}

## Last User Request
${lastUserMessage ? (typeof lastUserMessage.content === 'string' ? lastUserMessage.content.slice(0, 200) + '...' : '[Complex message]') : 'No user message found'}

## Last Assistant Response
${lastAssistantMessage ? (typeof lastAssistantMessage.content === 'string' ? lastAssistantMessage.content.slice(0, 200) + '...' : '[Complex response]') : 'No assistant response found'}

## Status
This is a fallback summary generated due to processing constraints.`;
  }

  /**
   * Generate fallback context when AI selection fails
   */
  private _generateFallbackContext(messages: Message[], files: FileMap): FileMap {
    const fileEntries = Object.entries(files);
    const fallbackFiles: FileMap = {};

    // Prioritize important files
    const importantFiles = fileEntries.filter(([path]) => {
      const fileName = path.split('/').pop()?.toLowerCase() || '';
      return /(package\.json|index\.|main\.|app\.|readme)/i.test(fileName);
    });

    // Take first 3 important files
    for (let i = 0; i < Math.min(3, importantFiles.length); i++) {
      const [path, file] = importantFiles[i];
      const relativePath = path.replace('/home/project/', '');
      fallbackFiles[relativePath] = file;
    }

    return fallbackFiles;
  }

  /**
   * Report progress to callback
   */
  private _reportProgress(progress: LoadingProgress): void {
    this._progressCallback?.(progress);
    logger.debug('Progress update:', progress);
  }

  /**
   * Abort current loading operation
   */
  abort(): void {
    this._abortController?.abort();
    logger.debug('Progressive loading aborted');
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      options: this._options,
      isActive: !!this._abortController && !this._abortController.signal.aborted,
    };
  }
}
