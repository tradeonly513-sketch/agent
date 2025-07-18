import { describe, it, expect } from 'vitest';
import type { Message } from 'ai';
import { ContextManager } from '../context-manager';
import { ContextAnalyzer } from '../context-analyzer';
import { countMessagesTokens, getModelContextWindow } from '../token-counter';

describe('Context Management Integration', () => {
  it('should handle a realistic chat scenario with context overflow', async () => {
    // Simulate a long conversation that would exceed context limits
    const messages: Message[] = [];
    
    // Create a conversation with many back-and-forth messages
    for (let i = 0; i < 30; i++) {
      messages.push({
        id: `user-${i}`,
        role: 'user',
        content: `This is user message ${i}. I'm asking about a complex coding problem that requires detailed explanation. Please help me understand how to implement a sophisticated algorithm with multiple steps and considerations. `.repeat(10),
      });
      
      messages.push({
        id: `assistant-${i}`,
        role: 'assistant',
        content: `This is assistant response ${i}. Here's a detailed explanation of the algorithm you requested. Let me break it down into multiple steps with code examples and explanations for each part. `.repeat(15),
      });
    }

    const model = 'gpt-4';
    const systemPrompt = 'You are a helpful coding assistant. You provide detailed explanations and code examples.';
    const contextWindow = getModelContextWindow(model);
    
    console.log(`Model: ${model}, Context Window: ${contextWindow}`);
    console.log(`Original message count: ${messages.length}`);
    
    // Analyze the context before optimization
    const analyzer = new ContextAnalyzer(model);
    const initialAnalysis = analyzer.analyzeContext(messages, systemPrompt);
    
    console.log('Initial Analysis:');
    console.log(analyzer.getUsageSummary(initialAnalysis));
    console.log('Recommendations:', initialAnalysis.recommendations);
    
    expect(initialAnalysis.isOverLimit).toBe(true);
    expect(initialAnalysis.totalTokens).toBeGreaterThan(contextWindow);
    
    // Apply context management
    const contextManager = new ContextManager({
      model,
      maxContextTokens: contextWindow,
      completionTokens: 4000,
    });
    
    const optimizationResult = await contextManager.optimizeMessages(messages, systemPrompt);
    
    console.log('\nOptimization Result:');
    console.log(`Strategy: ${optimizationResult.strategy}`);
    console.log(`Truncated: ${optimizationResult.truncated}`);
    console.log(`Removed messages: ${optimizationResult.removedMessages}`);
    console.log(`Final message count: ${optimizationResult.messages.length}`);
    console.log(`Final token count: ${optimizationResult.totalTokens}`);
    
    // Verify optimization worked
    expect(optimizationResult.truncated).toBe(true);
    expect(optimizationResult.messages.length).toBeLessThan(messages.length);
    expect(optimizationResult.removedMessages).toBeGreaterThan(0);
    
    // Analyze after optimization
    const finalAnalysis = analyzer.analyzeContext(optimizationResult.messages, systemPrompt);
    
    console.log('\nFinal Analysis:');
    console.log(analyzer.getUsageSummary(finalAnalysis));
    
    // The optimized conversation should fit within limits
    const totalTokensWithCompletion = finalAnalysis.totalTokens + 4000; // completion tokens
    expect(totalTokensWithCompletion).toBeLessThanOrEqual(contextWindow);
    expect(finalAnalysis.isOverLimit).toBe(false);
  });

  it('should preserve important messages during optimization', async () => {
    const messages: Message[] = [
      {
        id: 'old-1',
        role: 'user',
        content: 'Old message that should be removed. '.repeat(100),
      },
      {
        id: 'old-2',
        role: 'assistant',
        content: 'Old response that should be removed. '.repeat(100),
      },
      {
        id: 'important-user',
        role: 'user',
        content: 'This is the most recent user message and should be preserved. '.repeat(50),
      },
      {
        id: 'important-assistant',
        role: 'assistant',
        content: 'This is the response to the recent user message. '.repeat(50),
      },
    ];

    const contextManager = new ContextManager({
      model: 'gpt-4',
      maxContextTokens: 2000, // Very small limit to force truncation
      completionTokens: 500,
    });

    const result = await contextManager.optimizeMessages(messages, 'System prompt');

    // Should preserve the last user message
    const lastUserMessage = result.messages.find(m => m.id === 'important-user');
    expect(lastUserMessage).toBeDefined();
    expect(lastUserMessage?.content).toContain('most recent user message');
  });

  it('should handle different model context windows correctly', () => {
    const models = [
      'gpt-4',
      'gpt-4-turbo',
      'claude-3-sonnet-20240229',
      'gemini-1.5-pro',
      'unknown-model',
    ];

    models.forEach(model => {
      const contextWindow = getModelContextWindow(model);
      expect(contextWindow).toBeGreaterThan(0);
      expect(typeof contextWindow).toBe('number');
      
      console.log(`${model}: ${contextWindow.toLocaleString()} tokens`);
    });
  });

  it('should provide useful recommendations for context optimization', () => {
    const messages: Message[] = [
      {
        id: 'large-1',
        role: 'user',
        content: 'Very large message. '.repeat(500), // Large message
      },
      {
        id: 'normal-1',
        role: 'assistant',
        content: 'Normal response.',
      },
    ];

    const analyzer = new ContextAnalyzer('gpt-4');
    const analysis = analyzer.analyzeContext(messages, 'System prompt');

    expect(analysis.recommendations).toBeDefined();
    expect(Array.isArray(analysis.recommendations)).toBe(true);
    expect(analysis.messageBreakdown).toBeDefined();
    expect(analysis.messageBreakdown.length).toBe(2);

    // Should identify large messages
    const largeMessage = analysis.messageBreakdown.find(m => m.messageId === 'large-1');
    expect(largeMessage?.isLarge).toBe(true);
  });
});
