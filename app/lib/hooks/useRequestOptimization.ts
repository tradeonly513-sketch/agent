import { useMemo } from 'react';
import type { Message } from 'ai';

interface RequestOptimizationOptions {
  maxRequestSizeKB: number;
  preserveRecentMessages: number;
  compressFileContent: boolean;
  removeRedundantArtifacts: boolean;
}

interface OptimizationResult {
  messages: Message[];
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  strategies: string[];
}

/**
 * Client-side request optimization hook
 * Reduces request body size before sending to API
 */
export function useRequestOptimization(options: Partial<RequestOptimizationOptions> = {}) {
  const config = useMemo(() => ({
    maxRequestSizeKB: 200, // 200KB max request size
    preserveRecentMessages: 3,
    compressFileContent: true,
    removeRedundantArtifacts: true,
    ...options,
  }), [options]);

  const optimizeRequest = useMemo(() => {
    return (messages: Message[], files?: any): OptimizationResult => {
      const originalSize = JSON.stringify({ messages, files }).length;
      let optimizedMessages = [...messages];
      const strategies: string[] = [];

      // Strategy 1: Remove redundant file content from older messages
      if (config.removeRedundantArtifacts && messages.length > config.preserveRecentMessages) {
        optimizedMessages = removeRedundantArtifacts(optimizedMessages, config.preserveRecentMessages);
        strategies.push('remove-redundant-artifacts');
      }

      // Strategy 2: Compress large file content
      if (config.compressFileContent) {
        optimizedMessages = compressFileContent(optimizedMessages, config.preserveRecentMessages);
        strategies.push('compress-file-content');
      }

      // Strategy 3: Remove excessive whitespace and formatting
      optimizedMessages = cleanupMessages(optimizedMessages);
      strategies.push('cleanup-formatting');

      const optimizedSize = JSON.stringify({ messages: optimizedMessages, files }).length;
      const compressionRatio = originalSize > 0 ? optimizedSize / originalSize : 1;

      console.log(
        `Request optimization: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB ` +
        `(${(compressionRatio * 100).toFixed(1)}%) using: ${strategies.join(', ')}`
      );

      return {
        messages: optimizedMessages,
        originalSize,
        optimizedSize,
        compressionRatio,
        strategies,
      };
    };
  }, [config]);

  return { optimizeRequest };
}

/**
 * Remove redundant boltArtifact content from older messages
 */
function removeRedundantArtifacts(messages: Message[], preserveCount: number): Message[] {
  if (messages.length <= preserveCount) return messages;

  const recentMessages = messages.slice(-preserveCount);
  const olderMessages = messages.slice(0, -preserveCount);

  // Extract file paths from recent messages
  const recentFilePaths = new Set<string>();
  recentMessages.forEach(msg => {
    if (typeof msg.content === 'string') {
      const filePathMatches = msg.content.match(/filePath="([^"]+)"/g);
      filePathMatches?.forEach(match => {
        const path = match.match(/filePath="([^"]+)"/)?.[1];
        if (path) recentFilePaths.add(path);
      });
    }
  });

  // Process older messages to remove redundant content
  const processedOlderMessages = olderMessages.map(msg => {
    if (typeof msg.content !== 'string') return msg;

    let content = msg.content;

    // Remove boltArtifacts for files that appear in recent messages
    recentFilePaths.forEach(filePath => {
      const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const artifactRegex = new RegExp(
        `<boltArtifact[^>]*>.*?<boltAction[^>]*filePath="${escapedPath}"[^>]*>.*?</boltAction>.*?</boltArtifact>`,
        'gs'
      );
      content = content.replace(artifactRegex, `[File ${filePath} - see recent messages]`);
    });

    return { ...msg, content };
  });

  return [...processedOlderMessages, ...recentMessages];
}

/**
 * Compress large file content in messages
 */
function compressFileContent(messages: Message[], preserveCount: number): Message[] {
  const recentMessages = messages.slice(-preserveCount);
  const olderMessages = messages.slice(0, -preserveCount);

  const processedOlderMessages = olderMessages.map(msg => {
    if (typeof msg.content !== 'string') return msg;

    let content = msg.content;

    // Compress package-lock.json and other large files
    content = content.replace(
      /<boltAction[^>]*filePath="[^"]*package-lock\.json"[^>]*>[\s\S]*?<\/boltAction>/g,
      '<boltAction type="file" filePath="package-lock.json">[package-lock.json compressed]</boltAction>'
    );

    // Compress other large file contents (> 2000 characters)
    content = content.replace(
      /<boltAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/boltAction>/g,
      (match, filePath, fileContent) => {
        if (fileContent.length > 2000) {
          const start = fileContent.substring(0, 300);
          const end = fileContent.substring(fileContent.length - 300);
          const compressed = `${start}\n\n[... ${fileContent.length - 600} chars compressed ...]\n\n${end}`;
          return `<boltAction type="file" filePath="${filePath}">${compressed}</boltAction>`;
        }
        return match;
      }
    );

    return { ...msg, content };
  });

  return [...processedOlderMessages, ...recentMessages];
}

/**
 * Clean up message formatting and remove excessive whitespace
 */
function cleanupMessages(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (typeof msg.content !== 'string') return msg;

    let content = msg.content;

    // Remove excessive whitespace
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    content = content.replace(/[ \t]+/g, ' ');

    // Remove verbose thinking sections from older messages
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '[thinking removed]');
    content = content.replace(/<div class="__boltThought__">[\s\S]*?<\/div>/g, '[thought removed]');

    // Compress repetitive model/provider info
    content = content.replace(
      /(\[Model: [^\]]+\]\s*\[Provider: [^\]]+\]\s*)+/g,
      '[Model/Provider info]'
    );

    return { ...msg, content: content.trim() };
  });
}

/**
 * Estimate request size in KB
 */
export function estimateRequestSize(messages: Message[], files?: any): number {
  return JSON.stringify({ messages, files }).length / 1024;
}

/**
 * Check if request needs optimization
 */
export function shouldOptimizeRequest(messages: Message[], files?: any, maxSizeKB: number = 200): boolean {
  return estimateRequestSize(messages, files) > maxSizeKB;
}
