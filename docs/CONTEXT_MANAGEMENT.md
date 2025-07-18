# Context Management System

This document describes the comprehensive context management system implemented to handle token limits and prevent context overflow errors.

## Overview

The context management system automatically handles situations where conversations exceed the model's context window, preventing errors like:

```
This model's maximum context length is 65536 tokens. However, you requested 119952 tokens (111952 in the messages, 8000 in the completion). Please reduce the length of the messages or completion.
```

## Components

### 1. Token Counter (`token-counter.ts`)

Provides accurate token counting using the `tiktoken` library:

- **`countTokens(text, model)`**: Count tokens in a text string
- **`countMessageTokens(message, model)`**: Count tokens in a single message
- **`countMessagesTokens(messages, model)`**: Count tokens in an array of messages
- **`getModelContextWindow(model)`**: Get the context window size for a model
- **`calculateAvailableTokens(...)`**: Calculate available tokens for messages

### 2. Context Manager (`context-manager.ts`)

Handles message optimization and truncation:

- **Sliding Window**: Removes oldest messages while preserving important ones
- **Aggressive Truncation**: More aggressive removal when needed
- **Emergency Truncation**: Last resort - keeps only essential messages
- **Message Preservation**: Always preserves the last user message

### 3. Context Analyzer (`context-analyzer.ts`)

Provides detailed analysis and recommendations:

- **Usage Analysis**: Detailed breakdown of token usage
- **Recommendations**: Actionable suggestions for optimization
- **Message Breakdown**: Per-message token analysis
- **Optimization Suggestions**: Prioritized optimization strategies

## Usage

### Basic Integration

The system is automatically integrated into the chat API and stream-text functionality:

```typescript
import { ContextManager } from '~/lib/.server/llm/context-manager';

const contextManager = new ContextManager({
  model: 'gpt-4',
  maxContextTokens: 8192,
  completionTokens: 4000,
});

const result = await contextManager.optimizeMessages(messages, systemPrompt);
```

### Analysis and Monitoring

```typescript
import { ContextAnalyzer } from '~/lib/.server/llm/context-analyzer';

const analyzer = new ContextAnalyzer('gpt-4');
const analysis = analyzer.analyzeContext(messages, systemPrompt);

console.log(analyzer.getUsageSummary(analysis));
console.log('Recommendations:', analysis.recommendations);
```

## Optimization Strategies

### 1. Sliding Window (Default)

- Removes oldest messages first
- Preserves the last user message and its response
- Maintains conversation context as much as possible

### 2. Aggressive Truncation

- Keeps only the last few message pairs
- Used when sliding window isn't sufficient
- Maintains minimal context for continuation

### 3. Emergency Truncation

- Keeps only the last user message
- Truncates message content if still too large
- Last resort to prevent complete failure

## Model Support

The system supports various models with different context windows:

| Model | Context Window | Notes |
|-------|----------------|-------|
| GPT-4 | 8,192 tokens | Standard GPT-4 |
| GPT-4 Turbo | 128,000 tokens | Large context window |
| Claude 3 Sonnet | 200,000 tokens | Very large context |
| Gemini 1.5 Pro | 1,048,576 tokens | Extremely large context |

## Configuration

### Environment Variables

```env
# Optional: Override default context optimization settings
CONTEXT_OPTIMIZATION_ENABLED=true
DEFAULT_COMPLETION_TOKENS=4000
CONTEXT_BUFFER_TOKENS=2000
```

### Runtime Configuration

```typescript
const contextManager = new ContextManager({
  model: 'gpt-4',
  maxContextTokens: 8192,        // Override model default
  completionTokens: 4000,        // Tokens reserved for completion
  bufferTokens: 1000,           // Safety buffer
  preserveLastUserMessage: true, // Always preserve last user message
  summarizationThreshold: 10,    // Messages before summarization
});
```

## Error Handling

### Client-Side

The chat component now handles context errors gracefully:

```typescript
onError: (e) => {
  if (e.message?.includes('context length')) {
    toast.error('Conversation too long! Please start a new chat or enable context optimization.');
    return;
  }
  // Handle other errors...
}
```

### Server-Side

The API returns specific error codes for context issues:

```json
{
  "error": true,
  "message": "The conversation is too long for the current model. Please start a new conversation or try enabling context optimization.",
  "statusCode": 413,
  "isRetryable": true,
  "contextError": true
}
```

## Best Practices

### For Users

1. **Enable Context Optimization**: Turn on automatic context management in settings
2. **Start New Conversations**: Begin fresh chats for new topics
3. **Break Up Long Messages**: Split very long requests into smaller parts
4. **Use Larger Models**: Choose models with bigger context windows for complex tasks

### For Developers

1. **Monitor Token Usage**: Use the ContextAnalyzer to track usage
2. **Implement Graceful Degradation**: Handle context overflow gracefully
3. **Provide User Feedback**: Show context usage indicators
4. **Test Edge Cases**: Test with very long conversations

## Testing

Run the test suite to verify functionality:

```bash
npm test -- app/lib/.server/llm/__tests__/context-manager.test.ts
npm test -- app/lib/.server/llm/__tests__/integration.test.ts
```

## Troubleshooting

### Common Issues

1. **Still Getting Context Errors**
   - Check if context optimization is enabled
   - Verify model context window settings
   - Ensure tiktoken is properly installed

2. **Messages Being Truncated Too Aggressively**
   - Increase buffer tokens
   - Adjust preservation settings
   - Use a model with larger context window

3. **Performance Issues**
   - Token counting can be CPU intensive
   - Consider caching token counts
   - Use approximate counting for UI updates

### Debug Logging

Enable debug logging to see context management in action:

```typescript
import { createScopedLogger } from '~/utils/logger';
const logger = createScopedLogger('context-debug');
logger.info('Context optimization result:', result);
```

## Future Enhancements

1. **Intelligent Summarization**: Automatically summarize old messages
2. **Semantic Chunking**: Preserve semantically important messages
3. **User Preferences**: Allow users to configure optimization behavior
4. **Real-time Monitoring**: Live context usage indicators in the UI
5. **Model-Specific Optimization**: Tailor strategies to specific models
