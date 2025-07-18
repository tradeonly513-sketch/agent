import { describe, it, expect, beforeEach } from 'vitest';
import type { Message } from 'ai';
import { ContextManager } from '../context-manager';
import { countMessagesTokens } from '../token-counter';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  
  beforeEach(() => {
    contextManager = new ContextManager({
      model: 'gpt-4',
      maxContextTokens: 8192,
      completionTokens: 2000,
      bufferTokens: 500,
    });
  });

  const createTestMessages = (count: number): Message[] => {
    const messages: Message[] = [];
    for (let i = 0; i < count; i++) {
      messages.push({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `This is test message ${i}. `.repeat(50), // Make it longer to test token limits
      });
    }
    return messages;
  };

  it('should not truncate messages when within token limit', async () => {
    const messages = createTestMessages(3);
    const systemPrompt = 'You are a helpful assistant.';
    
    const result = await contextManager.optimizeMessages(messages, systemPrompt);
    
    expect(result.truncated).toBe(false);
    expect(result.messages).toHaveLength(3);
    expect(result.strategy).toBe('none');
    expect(result.removedMessages).toBe(0);
  });

  it('should apply sliding window when messages exceed token limit', async () => {
    const messages = createTestMessages(20); // Create many messages to exceed limit
    const systemPrompt = 'You are a helpful assistant.';
    
    const result = await contextManager.optimizeMessages(messages, systemPrompt);
    
    expect(result.truncated).toBe(true);
    expect(result.messages.length).toBeLessThan(20);
    expect(result.strategy).toBe('sliding-window');
    expect(result.removedMessages).toBeGreaterThan(0);
  });

  it('should preserve the last user message', async () => {
    const messages = createTestMessages(20);
    const systemPrompt = 'You are a helpful assistant.';
    
    const result = await contextManager.optimizeMessages(messages, systemPrompt);
    
    // Find the last user message in original messages
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    // Check if it's preserved in the result
    const preservedUserMessages = result.messages.filter(m => m.role === 'user');
    expect(preservedUserMessages.some(m => m.content === lastUserMessage?.content)).toBe(true);
  });

  it('should handle emergency truncation when aggressive truncation is not enough', async () => {
    // Create messages with very long content
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Very long message. '.repeat(2000), // Very long message
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Very long response. '.repeat(2000),
      },
    ];
    
    const systemPrompt = 'You are a helpful assistant.';
    
    const result = await contextManager.optimizeMessages(messages, systemPrompt);
    
    expect(result.truncated).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(5692); // Available tokens for this test setup
  });

  it('should calculate available tokens correctly', async () => {
    const messages = createTestMessages(5);
    const systemPrompt = 'You are a helpful assistant.';
    
    const result = await contextManager.optimizeMessages(messages, systemPrompt);
    
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(typeof result.totalTokens).toBe('number');
  });

  it('should handle empty messages array', async () => {
    const messages: Message[] = [];
    const systemPrompt = 'You are a helpful assistant.';
    
    const result = await contextManager.optimizeMessages(messages, systemPrompt);
    
    expect(result.messages).toHaveLength(0);
    expect(result.truncated).toBe(false);
    expect(result.strategy).toBe('none');
  });

  it('should handle messages with non-string content', async () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ...' } }
        ],
      },
    ];
    const systemPrompt = 'You are a helpful assistant.';

    const result = await contextManager.optimizeMessages(messages, systemPrompt);

    expect(result.messages).toHaveLength(1);
    expect(result.totalTokens).toBeGreaterThan(0);
  });


});

describe('Token counting integration', () => {
  it('should count tokens for various message types', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, how are you?',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'I am doing well, thank you for asking!',
      },
    ];

    const tokenCount = countMessagesTokens(messages, 'gpt-4');
    expect(tokenCount).toBeGreaterThan(0);
    expect(typeof tokenCount).toBe('number');
  });

  it('should handle different models', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
      },
    ];

    const gpt4Tokens = countMessagesTokens(messages, 'gpt-4');
    const claudeTokens = countMessagesTokens(messages, 'claude-3-sonnet-20240229');
    const deepseekTokens = countMessagesTokens(messages, 'deepseek-chat');

    expect(gpt4Tokens).toBeGreaterThan(0);
    expect(claudeTokens).toBeGreaterThan(0);
    expect(deepseekTokens).toBeGreaterThan(0);
  });


});
