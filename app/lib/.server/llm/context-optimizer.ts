import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { countMessagesTokens, countMessageTokens } from './token-counter';

const logger = createScopedLogger('context-optimizer');

export interface ContextOptimizationOptions {
  maxTokens: number;
  preserveRecentMessages: number;
  compressOldMessages: boolean;
  removeRedundantContent: boolean;
  summarizeFileContent: boolean;
}

export interface OptimizationResult {
  messages: Message[];
  originalTokens: number;
  optimizedTokens: number;
  compressionRatio: number;
  strategy: string[];
}

/**
 * Context Engineering Optimizer
 * Implements intelligent context compression based on content analysis
 */
export class ContextOptimizer {
  private options: ContextOptimizationOptions;

  constructor(options: Partial<ContextOptimizationOptions> = {}) {
    this.options = {
      maxTokens: 100000, // Default max tokens
      preserveRecentMessages: 3, // Always preserve last 3 messages
      compressOldMessages: true,
      removeRedundantContent: true,
      summarizeFileContent: true,
      ...options,
    };
  }

  /**
   * Optimize message context using multiple strategies
   */
  async optimizeContext(messages: Message[], model: string): Promise<OptimizationResult> {
    const originalTokens = countMessagesTokens(messages, model);
    let optimizedMessages = [...messages];
    const strategies: string[] = [];

    logger.info(`Starting context optimization: ${originalTokens} tokens`);

    // Strategy 1: Remove redundant boltArtifact content
    if (this.options.removeRedundantContent) {
      optimizedMessages = this.removeRedundantArtifacts(optimizedMessages);
      strategies.push('remove-redundant-artifacts');
    }

    // Strategy 2: Compress file content in older messages
    if (this.options.summarizeFileContent) {
      optimizedMessages = this.compressFileContent(optimizedMessages);
      strategies.push('compress-file-content');
    }

    // Strategy 3: Compress older messages while preserving recent ones
    if (this.options.compressOldMessages) {
      optimizedMessages = this.compressOldMessages(optimizedMessages);
      strategies.push('compress-old-messages');
    }

    // Strategy 4: Remove duplicate information
    optimizedMessages = this.removeDuplicateInformation(optimizedMessages);
    strategies.push('remove-duplicates');

    const optimizedTokens = countMessagesTokens(optimizedMessages, model);
    const compressionRatio = originalTokens > 0 ? optimizedTokens / originalTokens : 1;

    logger.info(
      `Context optimization complete: ${originalTokens} → ${optimizedTokens} tokens (${(compressionRatio * 100).toFixed(1)}%)`,
    );

    return {
      messages: optimizedMessages,
      originalTokens,
      optimizedTokens,
      compressionRatio,
      strategy: strategies,
    };
  }

  /**
   * Remove redundant boltArtifact content from older messages
   */
  private removeRedundantArtifacts(messages: Message[]): Message[] {
    const recentMessages = messages.slice(-this.options.preserveRecentMessages);
    const olderMessages = messages.slice(0, -this.options.preserveRecentMessages);

    // Extract file paths from recent messages to avoid removing them from older ones
    const recentFilePaths = new Set<string>();
    recentMessages.forEach((msg) => {
      if (typeof msg.content === 'string') {
        const filePathMatches = msg.content.match(/filePath="([^"]+)"/g);
        filePathMatches?.forEach((match) => {
          const path = match.match(/filePath="([^"]+)"/)?.[1];

          if (path) {
            recentFilePaths.add(path);
          }
        });
      }
    });

    // Process older messages
    const processedOlderMessages = olderMessages.map((msg) => {
      if (typeof msg.content !== 'string') {
        return msg;
      }

      let content = msg.content;

      // Remove boltArtifacts for files that appear in recent messages
      recentFilePaths.forEach((filePath) => {
        const artifactRegex = new RegExp(
          `<boltArtifact[^>]*>.*?<boltAction[^>]*filePath="${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>.*?</boltAction>.*?</boltArtifact>`,
          'gs',
        );
        content = content.replace(artifactRegex, `[File ${filePath} content removed - see recent messages]`);
      });

      // Compress large package-lock.json content
      content = content.replace(
        /<boltAction[^>]*filePath="[^"]*package-lock\.json"[^>]*>[\s\S]*?<\/boltAction>/g,
        '<boltAction type="file" filePath="package-lock.json">[package-lock.json content compressed]</boltAction>',
      );

      return { ...msg, content };
    });

    return [...processedOlderMessages, ...recentMessages];
  }

  /**
   * Compress file content in older messages
   */
  private compressFileContent(messages: Message[]): Message[] {
    const recentMessages = messages.slice(-this.options.preserveRecentMessages);
    const olderMessages = messages.slice(0, -this.options.preserveRecentMessages);

    const processedOlderMessages = olderMessages.map((msg) => {
      if (typeof msg.content !== 'string') {
        return msg;
      }

      let content = msg.content;

      // Compress large file contents (> 1000 characters)
      content = content.replace(
        /<boltAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/boltAction>/g,
        (match, filePath, fileContent) => {
          if (fileContent.length > 1000) {
            // Keep first and last 200 characters
            const start = fileContent.substring(0, 200);
            const end = fileContent.substring(fileContent.length - 200);
            const compressed = `${start}\n\n[... ${fileContent.length - 400} characters compressed ...]\n\n${end}`;

            return `<boltAction type="file" filePath="${filePath}">${compressed}</boltAction>`;
          }

          return match;
        },
      );

      return { ...msg, content };
    });

    return [...processedOlderMessages, ...recentMessages];
  }

  /**
   * Compress older messages by summarizing their content
   */
  private compressOldMessages(messages: Message[]): Message[] {
    if (messages.length <= this.options.preserveRecentMessages) {
      return messages;
    }

    const recentMessages = messages.slice(-this.options.preserveRecentMessages);
    const olderMessages = messages.slice(0, -this.options.preserveRecentMessages);

    // Group older messages and create summaries
    const compressedOlderMessages = olderMessages.map((msg) => {
      if (typeof msg.content !== 'string') {
        return msg;
      }

      let content = msg.content;

      // Remove verbose thinking sections
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '[thinking process removed]');
      content = content.replace(/<div class="__boltThought__">[\s\S]*?<\/div>/g, '[thought process removed]');

      // Compress repetitive patterns
      content = content.replace(/(\[Model: [^\]]+\]\s*\[Provider: [^\]]+\]\s*)+/g, '[Model/Provider info compressed]');

      // Remove excessive whitespace
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

      return { ...msg, content };
    });

    return [...compressedOlderMessages, ...recentMessages];
  }

  /**
   * Remove duplicate information across messages
   */
  private removeDuplicateInformation(messages: Message[]): Message[] {
    const seenContent = new Set<string>();

    return messages.map((msg) => {
      if (typeof msg.content !== 'string') {
        return msg;
      }

      let content = msg.content;

      // Extract and deduplicate boltActions
      const boltActions = content.match(/<boltAction[^>]*>[\s\S]*?<\/boltAction>/g) || [];
      const uniqueActions = new Map<string, string>();

      boltActions.forEach((action) => {
        const filePathMatch = action.match(/filePath="([^"]+)"/);

        if (filePathMatch) {
          const filePath = filePathMatch[1];

          // Keep the most recent version of each file
          uniqueActions.set(filePath, action);
        }
      });

      // Rebuild content with unique actions
      if (uniqueActions.size > 0) {
        // Remove all boltActions first
        content = content.replace(/<boltAction[^>]*>[\s\S]*?<\/boltAction>/g, '');

        // Add unique actions back
        const uniqueActionsStr = Array.from(uniqueActions.values()).join('\n');
        content = content.replace(
          /<boltArtifact([^>]*)>([\s\S]*?)<\/boltArtifact>/g,
          `<boltArtifact$1>$2\n${uniqueActionsStr}</boltArtifact>`,
        );
      }

      return { ...msg, content };
    });
  }
}
