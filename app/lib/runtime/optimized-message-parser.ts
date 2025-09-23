import type { ActionType, BoltAction, BoltActionData, FileAction } from '~/types/actions';
import type { BoltArtifactData } from '~/types/artifact';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { StreamingMessageParserOptions } from './message-parser';

const logger = createScopedLogger('OptimizedMessageParser');

// Pre-compiled regex patterns for better performance
const TAG_PATTERNS = {
  quickActionsOpen: /<bolt-quick-actions>/g,
  quickActionsClose: /<\/bolt-quick-actions>/g,
  quickAction: /<bolt-quick-action([^>]*)>([\s\S]*?)<\/bolt-quick-action>/g,
  artifactOpen: /<boltArtifact([^>]*)>/g,
  artifactClose: /<\/boltArtifact>/g,
  actionOpen: /<boltAction([^>]*)>/g,
  actionClose: /<\/boltAction>/g,
  attribute: /(\w+)="([^"]*)"/g,
} as const;

// Enhanced performance constants
const PERFORMANCE_CONSTANTS = {
  MAX_CHUNK_SIZE: 2048, // Increased from 1024 for better throughput
  MIN_CHUNK_SIZE: 512, // Minimum chunk size for small content
  LARGE_CONTENT_THRESHOLD: 100000, // 100KB - use different strategy for large content
  BINARY_CONTENT_PATTERNS: /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|pdf|zip|tar|gz|mp4|mp3|wav)$/i,
  TAG_SEARCH_BUFFER: 200, // Buffer size for tag boundary detection
} as const;

// Constants for tag matching
const CONSTANTS = {
  ARTIFACT_TAG_OPEN: '<boltArtifact',
  ARTIFACT_TAG_CLOSE: '</boltArtifact>',
  ARTIFACT_ACTION_TAG_OPEN: '<boltAction',
  ARTIFACT_ACTION_TAG_CLOSE: '</boltAction>',
  BOLT_QUICK_ACTIONS_OPEN: '<bolt-quick-actions>',
  BOLT_QUICK_ACTIONS_CLOSE: '</bolt-quick-actions>',
  CHUNK_SIZE: 1024, // Process in 1KB chunks
} as const;

interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  artifactCounter: number;
  currentArtifact?: BoltArtifactData;
  currentAction: BoltActionData;
  actionId: number;
}

interface ParsedChunk {
  output: string;
  newPosition: number;
  shouldBreak: boolean;
}

/**
 * Optimized message parser that uses chunk-based processing and pre-compiled regex patterns
 * for better performance when parsing large streaming responses.
 */
export class OptimizedMessageParser {
  #messages = new Map<string, MessageState>();
  #artifactCounter = 0;
  #options: StreamingMessageParserOptions;

  // Pattern cache for attribute extraction
  #attributeCache = new Map<string, Map<string, string>>();

  // Performance monitoring
  #performanceStats = {
    totalParseTime: 0,
    totalChunksProcessed: 0,
    averageChunkTime: 0,
    cacheHitRate: 0,
    cacheHits: 0,
    cacheMisses: 0,
    largeContentProcessed: 0,
    binaryContentSkipped: 0,
  };

  // Adaptive chunk sizing
  #adaptiveChunkSize: number = PERFORMANCE_CONSTANTS.MAX_CHUNK_SIZE;
  #recentParsingTimes: number[] = [];
  #maxPerformanceHistory = 10;

  constructor(options: StreamingMessageParserOptions = {}) {
    this.#options = options;
    logger.debug('OptimizedMessageParser initialized with adaptive chunk sizing');
  }

  parse(messageId: string, input: string): string {
    const parseStart = performance.now();

    let state = this.#messages.get(messageId);

    if (!state) {
      state = {
        position: 0,
        insideAction: false,
        insideArtifact: false,
        artifactCounter: 0,
        currentAction: { content: '' },
        actionId: 0,
      };
      this.#messages.set(messageId, state);
    }

    // Early exit for binary content or very large content
    if (this.#shouldSkipParsing(input)) {
      this.#performanceStats.binaryContentSkipped++;
      return input;
    }

    let result: string;

    // Use different strategies based on content size
    if (input.length > PERFORMANCE_CONSTANTS.LARGE_CONTENT_THRESHOLD) {
      this.#performanceStats.largeContentProcessed++;
      result = this.#processLargeContent(messageId, input, state);
    } else {
      result = this.#processInChunks(messageId, input, state);
    }

    // Update performance statistics
    const parseTime = performance.now() - parseStart;
    this.#updatePerformanceStats(parseTime);

    return result;
  }

  /**
   * Process input in chunks rather than character by character
   */
  #processInChunks(messageId: string, input: string, state: MessageState): string {
    let output = '';
    let position = state.position;

    while (position < input.length) {
      const chunkStart = performance.now();

      // Calculate adaptive chunk size
      const remainingInput = input.length - position;
      const chunkSize = Math.min(this.#adaptiveChunkSize, remainingInput);
      const chunkEnd = position + chunkSize;

      // Extract chunk with some overlap to handle tags that span chunk boundaries
      const chunk = this.#extractChunkWithOverlap(input, position, chunkEnd);

      // Process the chunk
      const result = this.#processChunk(messageId, chunk, state, position);

      output += result.output;
      position = result.newPosition;

      // Update chunk processing statistics
      const chunkTime = performance.now() - chunkStart;
      this.#updateChunkPerformance(chunkTime);
      this.#performanceStats.totalChunksProcessed++;

      if (result.shouldBreak) {
        break;
      }

      // Update state position
      state.position = position;
    }

    return output;
  }

  /**
   * Extract chunk with overlap to handle tags spanning boundaries
   */
  #extractChunkWithOverlap(input: string, start: number, end: number): string {
    // Add overlap to catch tags that might span chunk boundaries
    const overlapSize = 100; // Should be larger than any expected tag
    const actualEnd = Math.min(input.length, end + overlapSize);

    return input.slice(start, actualEnd);
  }

  /**
   * Process a single chunk of input
   */
  #processChunk(messageId: string, chunk: string, state: MessageState, _globalOffset: number): ParsedChunk {
    let output = '';
    let localPosition = 0;
    let shouldBreak = false;

    // Fast path: if chunk has no tags, process it quickly
    if (!this.#containsAnyTags(chunk)) {
      return {
        output: chunk,
        newPosition: _globalOffset + chunk.length,
        shouldBreak: false,
      };
    }

    // Process tags in the chunk
    while (localPosition < chunk.length) {
      const result = this.#processTagsAtPosition(messageId, chunk, state, localPosition, _globalOffset);

      if (result.found) {
        output += result.output;
        localPosition = result.newPosition;

        if (result.shouldBreak) {
          shouldBreak = true;
          break;
        }
      } else {
        // No tag found, add character and continue
        output += chunk[localPosition];
        localPosition++;
      }
    }

    return {
      output,
      newPosition: _globalOffset + localPosition,
      shouldBreak,
    };
  }

  /**
   * Quick check if chunk contains any tags we care about
   */
  #containsAnyTags(chunk: string): boolean {
    return chunk.includes('<bolt') || chunk.includes('</bolt');
  }

  /**
   * Process tags at current position
   */
  #processTagsAtPosition(
    messageId: string,
    chunk: string,
    state: MessageState,
    position: number,
    _globalOffset: number,
  ): { found: boolean; output: string; newPosition: number; shouldBreak: boolean } {
    // Quick Actions processing
    if (chunk.startsWith(CONSTANTS.BOLT_QUICK_ACTIONS_OPEN, position)) {
      return this.#processQuickActions(chunk, position);
    }

    // Artifact processing
    if (state.insideArtifact) {
      return this.#processInsideArtifact(messageId, chunk, state, position, _globalOffset);
    }

    // Artifact tag detection
    if (chunk.startsWith(CONSTANTS.ARTIFACT_TAG_OPEN, position)) {
      return this.#processArtifactOpen(messageId, chunk, state, position, _globalOffset);
    }

    return { found: false, output: '', newPosition: position, shouldBreak: false };
  }

  /**
   * Process quick actions block
   */
  #processQuickActions(
    chunk: string,
    position: number,
  ): { found: boolean; output: string; newPosition: number; shouldBreak: boolean } {
    const actionsBlockEnd = chunk.indexOf(CONSTANTS.BOLT_QUICK_ACTIONS_CLOSE, position);

    if (actionsBlockEnd === -1) {
      return { found: false, output: '', newPosition: position, shouldBreak: false };
    }

    const actionsBlockContent = chunk.slice(position + CONSTANTS.BOLT_QUICK_ACTIONS_OPEN.length, actionsBlockEnd);

    // Use pre-compiled regex for better performance
    TAG_PATTERNS.quickAction.lastIndex = 0; // Reset regex state

    const buttons: string[] = [];
    let match;

    while ((match = TAG_PATTERNS.quickAction.exec(actionsBlockContent)) !== null) {
      const tagAttrs = match[1];
      const label = match[2];
      const attributes = this.#extractAttributes(tagAttrs);

      buttons.push(
        this.#createQuickActionElement(
          {
            type: attributes.type || '',
            message: attributes.message || '',
            path: attributes.path || '',
            href: attributes.href || '',
          },
          label,
        ),
      );
    }

    const output = this.#createQuickActionGroup(buttons);
    const newPosition = actionsBlockEnd + CONSTANTS.BOLT_QUICK_ACTIONS_CLOSE.length;

    return { found: true, output, newPosition, shouldBreak: false };
  }

  /**
   * Process content inside an artifact
   */
  #processInsideArtifact(
    messageId: string,
    chunk: string,
    state: MessageState,
    position: number,
    _globalOffset: number,
  ): { found: boolean; output: string; newPosition: number; shouldBreak: boolean } {
    const currentArtifact = state.currentArtifact;

    if (!currentArtifact) {
      unreachable('Artifact not initialized');
    }

    if (state.insideAction) {
      return this.#processInsideAction(messageId, chunk, state, position, currentArtifact);
    } else {
      return this.#processArtifactContent(messageId, chunk, state, position, currentArtifact);
    }
  }

  /**
   * Process content inside an action
   */
  #processInsideAction(
    messageId: string,
    chunk: string,
    state: MessageState,
    position: number,
    currentArtifact: BoltArtifactData,
  ): { found: boolean; output: string; newPosition: number; shouldBreak: boolean } {
    const closeIndex = chunk.indexOf(CONSTANTS.ARTIFACT_ACTION_TAG_CLOSE, position);
    const currentAction = state.currentAction;

    if (closeIndex !== -1) {
      // Action closing tag found
      currentAction.content += chunk.slice(position, closeIndex);

      let content = currentAction.content.trim();

      if ('type' in currentAction && currentAction.type === 'file') {
        if (!currentAction.filePath.endsWith('.md')) {
          content = this.#cleanoutMarkdownSyntax(content);
          content = this.#cleanEscapedTags(content);
        }

        content += '\n';
      }

      currentAction.content = content;

      this.#options.callbacks?.onActionClose?.({
        artifactId: currentArtifact.id,
        messageId,
        actionId: String(state.actionId - 1),
        action: currentAction as BoltAction,
      });

      state.insideAction = false;
      state.currentAction = { content: '' };

      return {
        found: true,
        output: '',
        newPosition: closeIndex + CONSTANTS.ARTIFACT_ACTION_TAG_CLOSE.length,
        shouldBreak: false,
      };
    } else {
      // Stream action content
      if ('type' in currentAction && currentAction.type === 'file') {
        let content = chunk.slice(position);

        if (!currentAction.filePath.endsWith('.md')) {
          content = this.#cleanoutMarkdownSyntax(content);
          content = this.#cleanEscapedTags(content);
        }

        this.#options.callbacks?.onActionStream?.({
          artifactId: currentArtifact.id,
          messageId,
          actionId: String(state.actionId - 1),
          action: {
            ...(currentAction as FileAction),
            content,
            filePath: currentAction.filePath,
          },
        });
      }

      return { found: true, output: '', newPosition: chunk.length, shouldBreak: true };
    }
  }

  /**
   * Process artifact content (looking for actions or artifact close)
   */
  #processArtifactContent(
    messageId: string,
    chunk: string,
    state: MessageState,
    position: number,
    currentArtifact: BoltArtifactData,
  ): { found: boolean; output: string; newPosition: number; shouldBreak: boolean } {
    const actionOpenIndex = chunk.indexOf(CONSTANTS.ARTIFACT_ACTION_TAG_OPEN, position);
    const artifactCloseIndex = chunk.indexOf(CONSTANTS.ARTIFACT_TAG_CLOSE, position);

    if (actionOpenIndex !== -1 && (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)) {
      // Action opening tag found
      const actionEndIndex = chunk.indexOf('>', actionOpenIndex);

      if (actionEndIndex !== -1) {
        state.insideAction = true;
        state.currentAction = this.#parseActionTag(chunk, actionOpenIndex, actionEndIndex);

        this.#options.callbacks?.onActionOpen?.({
          artifactId: currentArtifact.id,
          messageId,
          actionId: String(state.actionId++),
          action: state.currentAction as BoltAction,
        });

        return {
          found: true,
          output: '',
          newPosition: actionEndIndex + 1,
          shouldBreak: false,
        };
      } else {
        return { found: true, output: '', newPosition: position, shouldBreak: true };
      }
    } else if (artifactCloseIndex !== -1) {
      // Artifact closing tag found
      this.#options.callbacks?.onArtifactClose?.({
        messageId,
        artifactId: currentArtifact.id,
        ...currentArtifact,
      });

      state.insideArtifact = false;
      state.currentArtifact = undefined;

      return {
        found: true,
        output: '',
        newPosition: artifactCloseIndex + CONSTANTS.ARTIFACT_TAG_CLOSE.length,
        shouldBreak: false,
      };
    } else {
      return { found: true, output: '', newPosition: chunk.length, shouldBreak: true };
    }
  }

  /**
   * Process artifact opening tag
   */
  #processArtifactOpen(
    messageId: string,
    chunk: string,
    state: MessageState,
    position: number,
    _globalOffset: number,
  ): { found: boolean; output: string; newPosition: number; shouldBreak: boolean } {
    const openTagEnd = chunk.indexOf('>', position);

    if (openTagEnd === -1) {
      return { found: true, output: '', newPosition: position, shouldBreak: true };
    }

    const artifactTag = chunk.slice(position, openTagEnd + 1);
    const attributes = this.#extractAttributes(artifactTag);

    const artifactTitle = attributes.title;
    const type = attributes.type;
    const artifactId = `${messageId}-${state.artifactCounter++}`;

    if (!artifactTitle) {
      logger.warn('Artifact title missing');
    }

    state.insideArtifact = true;

    const currentArtifact: BoltArtifactData = {
      id: artifactId,
      title: artifactTitle || '',
      type: type || '',
    };

    state.currentArtifact = currentArtifact;

    this.#options.callbacks?.onArtifactOpen?.({
      messageId,
      artifactId: currentArtifact.id,
      ...currentArtifact,
    });

    const artifactFactory = this.#options.artifactElement ?? this.#createArtifactElement;
    const output = artifactFactory({ messageId, artifactId });

    return {
      found: true,
      output,
      newPosition: openTagEnd + 1,
      shouldBreak: false,
    };
  }

  /**
   * Extract attributes from tag using cached regex patterns
   */
  #extractAttributes(tag: string): Record<string, string> {
    // Check cache first
    const cached = this.#attributeCache.get(tag);

    if (cached) {
      this.#performanceStats.cacheHits++;
      return Object.fromEntries(cached);
    }

    this.#performanceStats.cacheMisses++;

    const attributes = new Map<string, string>();

    // Reset regex state
    TAG_PATTERNS.attribute.lastIndex = 0;

    let match;

    while ((match = TAG_PATTERNS.attribute.exec(tag)) !== null) {
      attributes.set(match[1], match[2]);
    }

    // Cache result
    this.#attributeCache.set(tag, attributes);

    return Object.fromEntries(attributes);
  }

  /**
   * Parse action tag to extract action data
   */
  #parseActionTag(input: string, actionOpenIndex: number, actionEndIndex: number): BoltActionData {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);
    const attributes = this.#extractAttributes(actionTag);

    const actionType = attributes.type as ActionType;
    const actionAttributes: any = {
      type: actionType,
      content: '',
    };

    if (actionType === 'supabase') {
      const operation = attributes.operation;

      if (!operation || !['migration', 'query'].includes(operation)) {
        logger.warn(`Invalid or missing operation for Supabase action: ${operation}`);
        throw new Error(`Invalid Supabase operation: ${operation}`);
      }

      actionAttributes.operation = operation as 'migration' | 'query';

      if (operation === 'migration') {
        const filePath = attributes.filePath;

        if (!filePath) {
          logger.warn('Migration requires a filePath');
          throw new Error('Migration requires a filePath');
        }

        actionAttributes.filePath = filePath;
      }
    } else if (actionType === 'file') {
      const filePath = attributes.filePath;

      if (!filePath) {
        logger.debug('File path not specified');
      }

      actionAttributes.filePath = filePath || '';
    } else if (!['shell', 'start'].includes(actionType)) {
      logger.warn(`Unknown action type '${actionType}'`);
    }

    return actionAttributes as BoltActionData;
  }

  // Utility methods
  #cleanoutMarkdownSyntax(content: string): string {
    const codeBlockRegex = /^\s*```\w*\n([\s\S]*?)\n\s*```\s*$/;
    const match = content.match(codeBlockRegex);

    return match ? match[1] : content;
  }

  #cleanEscapedTags(content: string): string {
    return content.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  #createArtifactElement = (props: { messageId: string; artifactId?: string }) => {
    const elementProps = [
      'class="__boltArtifact__"',
      ...Object.entries(props).map(([key, value]) => {
        return `data-${this.#camelToDashCase(key)}=${JSON.stringify(value)}`;
      }),
    ];
    return `<div ${elementProps.join(' ')}></div>`;
  };

  #createQuickActionElement(props: Record<string, string>, label: string): string {
    const elementProps = [
      'class="__boltQuickAction__"',
      'data-bolt-quick-action="true"',
      ...Object.entries(props).map(([key, value]) => `data-${this.#camelToDashCase(key)}=${JSON.stringify(value)}`),
    ];
    return `<button ${elementProps.join(' ')}>${label}</button>`;
  }

  #createQuickActionGroup(buttons: string[]): string {
    return `<div class="__boltQuickAction__" data-bolt-quick-action="true">${buttons.join('')}</div>`;
  }

  #camelToDashCase(input: string): string {
    return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  reset(): void {
    this.#messages.clear();
    this.#attributeCache.clear();
    this.#performanceStats = {
      totalParseTime: 0,
      totalChunksProcessed: 0,
      averageChunkTime: 0,
      cacheHitRate: 0,
      cacheHits: 0,
      cacheMisses: 0,
      largeContentProcessed: 0,
      binaryContentSkipped: 0,
    };
    this.#recentParsingTimes = [];
  }

  /**
   * Check if parsing should be skipped for performance reasons
   */
  #shouldSkipParsing(input: string): boolean {
    // Skip parsing for very large binary-like content
    if (input.length > PERFORMANCE_CONSTANTS.LARGE_CONTENT_THRESHOLD * 5) {
      return true;
    }

    // Skip if content looks like binary data (high percentage of non-printable characters)
    const nonPrintableChars = (input.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
    const nonPrintableRatio = nonPrintableChars / input.length;

    return nonPrintableRatio > 0.3; // Skip if more than 30% non-printable
  }

  /**
   * Process large content with optimized strategy
   */
  #processLargeContent(messageId: string, input: string, state: MessageState): string {
    // For very large content, use larger chunks and more aggressive caching
    const originalChunkSize = this.#adaptiveChunkSize;
    this.#adaptiveChunkSize = Math.min(PERFORMANCE_CONSTANTS.MAX_CHUNK_SIZE * 2, 4096);

    try {
      return this.#processInChunks(messageId, input, state);
    } finally {
      // Restore original chunk size
      this.#adaptiveChunkSize = originalChunkSize;
    }
  }

  /**
   * Update performance statistics
   */
  #updatePerformanceStats(parseTime: number): void {
    this.#performanceStats.totalParseTime += parseTime;

    // Update cache hit rate
    const totalCacheAccesses = this.#performanceStats.cacheHits + this.#performanceStats.cacheMisses;

    if (totalCacheAccesses > 0) {
      this.#performanceStats.cacheHitRate = this.#performanceStats.cacheHits / totalCacheAccesses;
    }

    // Track recent parsing times for adaptive optimization
    this.#recentParsingTimes.push(parseTime);

    if (this.#recentParsingTimes.length > this.#maxPerformanceHistory) {
      this.#recentParsingTimes.shift();
    }

    // Adjust chunk size based on performance
    this.#adjustAdaptiveChunkSize();
  }

  /**
   * Update chunk processing performance and adapt chunk size
   */
  #updateChunkPerformance(chunkTime: number): void {
    const alpha = 0.2; // Exponential moving average factor
    this.#performanceStats.averageChunkTime = this.#performanceStats.averageChunkTime * (1 - alpha) + chunkTime * alpha;
  }

  /**
   * Adjust adaptive chunk size based on performance metrics
   */
  #adjustAdaptiveChunkSize(): void {
    if (this.#recentParsingTimes.length < 3) {
      return; // Need some data first
    }

    const avgTime = this.#recentParsingTimes.reduce((sum, time) => sum + time, 0) / this.#recentParsingTimes.length;

    // If parsing is taking too long, reduce chunk size
    if (avgTime > 50) {
      // 50ms threshold
      this.#adaptiveChunkSize = Math.max(PERFORMANCE_CONSTANTS.MIN_CHUNK_SIZE, this.#adaptiveChunkSize * 0.8);
    }
    // If parsing is fast, increase chunk size for better throughput
    else if (avgTime < 10) {
      // 10ms threshold
      this.#adaptiveChunkSize = Math.min(PERFORMANCE_CONSTANTS.MAX_CHUNK_SIZE, this.#adaptiveChunkSize * 1.2);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.#performanceStats,
      adaptiveChunkSize: this.#adaptiveChunkSize,
      averageParseTime: this.#performanceStats.totalParseTime / Math.max(1, this.#recentParsingTimes.length),
      cacheSize: this.#attributeCache.size,
      messagesTracked: this.#messages.size,
    };
  }

  /**
   * Force garbage collection of caches to free memory
   */
  optimizeMemoryUsage(): void {
    // Clear old cache entries
    if (this.#attributeCache.size > 100) {
      this.#attributeCache.clear();
      logger.debug('Cleared attribute cache for memory optimization');
    }

    // Clear old message states (keep only recent ones)
    if (this.#messages.size > 10) {
      const keys = Array.from(this.#messages.keys());
      const oldKeys = keys.slice(0, -5); // Keep last 5
      oldKeys.forEach((key) => this.#messages.delete(key));
      logger.debug(`Cleared ${oldKeys.length} old message states`);
    }
  }

  /**
   * Enable/disable debug mode for performance analysis
   */
  setDebugMode(enabled: boolean): void {
    if (enabled) {
      logger.debug('Performance stats:', this.getPerformanceStats());
    }
  }
}
