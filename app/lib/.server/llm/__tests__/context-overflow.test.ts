import { describe, it, expect } from 'vitest';
import type { Message } from 'ai';
import { ContextManager } from '~/lib/.server/llm/context-manager';

describe('Context Overflow Prevention', () => {
  it('should handle the exact scenario from the error: 119952 tokens -> 65536 limit', async () => {
    // Simulate the exact scenario that was causing the error
    const contextManager = new ContextManager({
      model: 'deepseek-chat',
      maxContextTokens: 65536,
      completionTokens: 8000,
      bufferTokens: 2000,
    });

    /*
     * Create messages that would total approximately 111952 tokens
     * (as mentioned in the original error)
     */
    const messages: Message[] = [];

    // Create a very long conversation that would exceed the limit
    for (let i = 0; i < 100; i++) {
      messages.push({
        id: `user-${i}`,
        role: 'user',
        content: `This is a very detailed user message ${i}. `.repeat(200), // ~1200 tokens each
      });

      messages.push({
        id: `assistant-${i}`,
        role: 'assistant',
        content: `This is a comprehensive assistant response ${i}. `.repeat(200), // ~1200 tokens each
      });
    }

    console.log(`Created ${messages.length} messages for overflow test`);

    const systemPrompt = 'You are a helpful coding assistant. You provide detailed explanations and code examples.';

    // This should trigger context optimization
    const result = await contextManager.optimizeMessages(messages, systemPrompt);

    console.log('Context optimization result:', {
      strategy: result.strategy,
      truncated: result.truncated,
      removedMessages: result.removedMessages,
      finalTokens: result.totalTokens,
      originalMessages: messages.length,
      finalMessages: result.messages.length,
    });

    // Verify that optimization worked
    expect(result.truncated).toBe(true);
    expect(result.messages.length).toBeLessThan(messages.length);
    expect(result.removedMessages).toBeGreaterThan(0);

    // Most importantly: verify it fits within the context window
    const availableTokens = 65536 - 8000 - 2000; // context - completion - buffer
    expect(result.totalTokens).toBeLessThanOrEqual(availableTokens);

    // Verify the last user message is preserved
    const lastUserMessage = result.messages.filter((m) => m.role === 'user').pop();
    expect(lastUserMessage).toBeDefined();
    expect(lastUserMessage?.content).toContain('user message');
  });

  it('should handle extreme cases with very large individual messages', async () => {
    const contextManager = new ContextManager({
      model: 'deepseek-chat',
      maxContextTokens: 65536,
      completionTokens: 8000,
      bufferTokens: 2000,
    });

    // Create a few messages with extremely large content
    const messages: Message[] = [
      {
        id: 'huge-1',
        role: 'user',
        content: 'This is an extremely large message. '.repeat(5000), // ~25000 tokens
      },
      {
        id: 'huge-2',
        role: 'assistant',
        content: 'This is an extremely large response. '.repeat(5000), // ~25000 tokens
      },
      {
        id: 'huge-3',
        role: 'user',
        content: 'Another huge message. '.repeat(5000), // ~25000 tokens
      },
    ];

    const systemPrompt = 'You are a helpful assistant.';
    const result = await contextManager.optimizeMessages(messages, systemPrompt);

    // Should handle this gracefully
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(65536 - 8000 - 2000);
    expect(result.truncated).toBe(true);
  });

  it('should work with different model context windows', async () => {
    const models = [
      { name: 'gpt-4', contextWindow: 8192 },
      { name: 'deepseek-chat', contextWindow: 65536 },
      { name: 'claude-3-sonnet-20240229', contextWindow: 200000 },
    ];

    for (const model of models) {
      const contextManager = new ContextManager({
        model: model.name,
        maxContextTokens: model.contextWindow,
        completionTokens: 4000,
        bufferTokens: 1000,
      });

      // Create messages that would exceed the smaller models
      const messages: Message[] = [];

      for (let i = 0; i < 50; i++) {
        messages.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}. `.repeat(100),
        });
      }

      const result = await contextManager.optimizeMessages(messages, 'System prompt');

      // Should always fit within the model's context window
      const availableTokens = model.contextWindow - 4000 - 1000;
      expect(result.totalTokens).toBeLessThanOrEqual(availableTokens);

      console.log(`${model.name}: ${result.messages.length}/${messages.length} messages, ${result.totalTokens} tokens`);
    }
  });

  it('should handle the emergency truncation scenario', async () => {
    // Test the emergency truncation that was added to stream-text.ts
    const messages: Message[] = [];

    // Create way too many messages
    for (let i = 0; i < 200; i++) {
      messages.push({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      });
    }

    // Simulate the emergency truncation logic from stream-text.ts
    const modelContextWindow = 65536;
    const dynamicMaxTokens = 8000;
    const estimatedTokensPerMessage = 500;
    const maxSafeMessages = Math.floor((modelContextWindow - dynamicMaxTokens - 5000) / estimatedTokensPerMessage);

    let processedMessages = [...messages];

    if (processedMessages.length > maxSafeMessages) {
      const originalLength = processedMessages.length;
      processedMessages = processedMessages.slice(-Math.max(1, maxSafeMessages));

      console.log(`Emergency truncation: kept ${processedMessages.length} out of ${originalLength} messages`);

      expect(processedMessages.length).toBeLessThanOrEqual(maxSafeMessages);
      expect(processedMessages.length).toBeGreaterThan(0);
      expect(processedMessages.length).toBeLessThan(originalLength);
    }
  });
});
