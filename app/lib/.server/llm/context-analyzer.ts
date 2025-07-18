import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import {
  countMessagesTokens,
  countSystemTokens,
  getModelContextWindow,
  countMessageTokens,
} from './token-counter';

const logger = createScopedLogger('context-analyzer');

export interface ContextAnalysis {
  totalTokens: number;
  systemTokens: number;
  messageTokens: number;
  contextFilesTokens: number;
  availableTokens: number;
  utilizationPercentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  recommendations: string[];
  messageBreakdown: MessageTokenBreakdown[];
}

export interface MessageTokenBreakdown {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  tokens: number;
  contentPreview: string;
  isLarge: boolean;
}

/**
 * Analyzes context usage and provides recommendations
 */
export class ContextAnalyzer {
  private model: string;
  private maxContextTokens: number;
  private completionTokens: number;

  constructor(model: string, completionTokens: number = 4000) {
    this.model = model;
    this.maxContextTokens = getModelContextWindow(model);
    this.completionTokens = completionTokens;
  }

  /**
   * Analyze the current context usage
   */
  analyzeContext(
    messages: Message[],
    systemPrompt: string,
    contextFiles?: string
  ): ContextAnalysis {
    const systemTokens = countSystemTokens(systemPrompt, undefined, this.model);
    const contextFilesTokens = contextFiles ? countSystemTokens('', contextFiles, this.model) : 0;
    const messageTokens = countMessagesTokens(messages, this.model);
    const totalTokens = systemTokens + contextFilesTokens + messageTokens;
    
    const availableTokens = Math.max(0, this.maxContextTokens - totalTokens - this.completionTokens);
    const utilizationPercentage = (totalTokens / this.maxContextTokens) * 100;
    
    const isNearLimit = utilizationPercentage > 80;
    const isOverLimit = totalTokens + this.completionTokens > this.maxContextTokens;

    const messageBreakdown = this.analyzeMessages(messages);
    const recommendations = this.generateRecommendations(
      totalTokens,
      messageTokens,
      contextFilesTokens,
      messageBreakdown,
      isNearLimit,
      isOverLimit
    );

    return {
      totalTokens,
      systemTokens,
      messageTokens,
      contextFilesTokens,
      availableTokens,
      utilizationPercentage,
      isNearLimit,
      isOverLimit,
      recommendations,
      messageBreakdown,
    };
  }

  /**
   * Analyze individual messages
   */
  private analyzeMessages(messages: Message[]): MessageTokenBreakdown[] {
    return messages.map((message) => {
      const tokens = countMessageTokens(message, this.model);
      const contentPreview = this.getContentPreview(message.content);
      const isLarge = tokens > 500; // Consider messages over 500 tokens as large

      return {
        messageId: message.id || 'unknown',
        role: message.role,
        tokens,
        contentPreview,
        isLarge,
      };
    });
  }

  /**
   * Get a preview of message content
   */
  private getContentPreview(content: string | any[]): string {
    if (typeof content === 'string') {
      return content.length > 100 ? content.substring(0, 100) + '...' : content;
    } else if (Array.isArray(content)) {
      const textParts = content.filter(part => part.type === 'text').map(part => part.text);
      const preview = textParts.join(' ');
      return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }
    return '[Non-text content]';
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    totalTokens: number,
    messageTokens: number,
    contextFilesTokens: number,
    messageBreakdown: MessageTokenBreakdown[],
    isNearLimit: boolean,
    isOverLimit: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (isOverLimit) {
      recommendations.push('🚨 Context limit exceeded! The conversation will fail unless optimized.');
      recommendations.push('💡 Start a new conversation to reset the context.');
      recommendations.push('⚙️ Enable context optimization in settings to automatically manage long conversations.');
    } else if (isNearLimit) {
      recommendations.push('⚠️ Approaching context limit. Consider optimizing soon.');
    }

    // Analyze message distribution
    const largeMessages = messageBreakdown.filter(m => m.isLarge);
    if (largeMessages.length > 0) {
      recommendations.push(`📝 ${largeMessages.length} large messages detected. Consider breaking them into smaller parts.`);
    }

    // Context files recommendations
    if (contextFilesTokens > messageTokens) {
      recommendations.push('📁 Context files are using more tokens than messages. Consider reducing file context.');
    }

    // Conversation length recommendations
    if (messageBreakdown.length > 20) {
      recommendations.push('💬 Long conversation detected. Consider summarizing or starting fresh.');
    }

    // Model-specific recommendations
    if (this.maxContextTokens < 32000) {
      recommendations.push('🔄 Consider using a model with a larger context window for long conversations.');
    }

    // General optimization tips
    if (isNearLimit || isOverLimit) {
      recommendations.push('✂️ Remove unnecessary messages or files from context.');
      recommendations.push('📋 Use summarization to condense conversation history.');
      recommendations.push('🎯 Focus on the most recent and relevant messages.');
    }

    return recommendations;
  }

  /**
   * Get context usage summary as a formatted string
   */
  getUsageSummary(analysis: ContextAnalysis): string {
    const { totalTokens, availableTokens, utilizationPercentage, isOverLimit, isNearLimit } = analysis;
    
    let status = '✅ Normal';
    if (isOverLimit) {
      status = '🚨 Over Limit';
    } else if (isNearLimit) {
      status = '⚠️ Near Limit';
    }

    return `Context Usage: ${totalTokens.toLocaleString()} / ${this.maxContextTokens.toLocaleString()} tokens (${utilizationPercentage.toFixed(1)}%)
Available: ${availableTokens.toLocaleString()} tokens
Status: ${status}

Breakdown:
- System: ${analysis.systemTokens.toLocaleString()} tokens
- Messages: ${analysis.messageTokens.toLocaleString()} tokens
- Context Files: ${analysis.contextFilesTokens.toLocaleString()} tokens
- Reserved for Completion: ${this.completionTokens.toLocaleString()} tokens`;
  }

  /**
   * Get optimization suggestions based on current usage
   */
  getOptimizationSuggestions(analysis: ContextAnalysis): string[] {
    const suggestions: string[] = [];

    if (analysis.isOverLimit || analysis.isNearLimit) {
      // Prioritize suggestions based on what's using the most tokens
      const tokenSources = [
        { name: 'Messages', tokens: analysis.messageTokens },
        { name: 'Context Files', tokens: analysis.contextFilesTokens },
        { name: 'System Prompt', tokens: analysis.systemTokens },
      ].sort((a, b) => b.tokens - a.tokens);

      suggestions.push(`Primary optimization target: ${tokenSources[0].name} (${tokenSources[0].tokens.toLocaleString()} tokens)`);

      if (tokenSources[0].name === 'Messages') {
        suggestions.push('Consider enabling automatic message truncation');
        suggestions.push('Remove older messages that are no longer relevant');
        suggestions.push('Summarize long conversation threads');
      } else if (tokenSources[0].name === 'Context Files') {
        suggestions.push('Reduce the number of files in context');
        suggestions.push('Focus on only the most relevant files');
        suggestions.push('Use file summaries instead of full content');
      }
    }

    return suggestions;
  }
}
