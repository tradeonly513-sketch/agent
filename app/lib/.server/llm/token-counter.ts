import { encoding_for_model, get_encoding } from 'tiktoken';
import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('token-counter');

// Cache for encoders to avoid recreating them
const encoderCache = new Map<string, any>();

/**
 * Get the appropriate encoder for a model
 */
function getEncoder(model: string) {
  if (encoderCache.has(model)) {
    return encoderCache.get(model);
  }

  let encoder;
  try {
    // Try to get model-specific encoder first
    encoder = encoding_for_model(model as any);
  } catch (error) {
    // Fallback to cl100k_base for most modern models (GPT-4, Claude, etc.)
    logger.warn(`No specific encoder for model ${model}, using cl100k_base`);
    encoder = get_encoding('cl100k_base');
  }

  encoderCache.set(model, encoder);
  return encoder;
}

/**
 * Count tokens in a text string
 */
export function countTokens(text: string, model: string = 'gpt-4'): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  try {
    const encoder = getEncoder(model);
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    logger.error('Error counting tokens:', error);
    // Fallback: rough estimation (1 token ≈ 4 characters for English)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in a message
 */
export function countMessageTokens(message: Message, model: string = 'gpt-4'): number {
  let totalTokens = 0;

  // Count content tokens
  if (typeof message.content === 'string') {
    totalTokens += countTokens(message.content, model);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'text' && part.text) {
        totalTokens += countTokens(part.text, model);
      }
      // For image parts, add a fixed token count (images typically use ~85-170 tokens)
      else if (part.type === 'image' || part.type === 'image_url') {
        totalTokens += 150; // Conservative estimate for image tokens
      }
    }
  }

  // Add overhead for message formatting (role, etc.)
  // OpenAI format adds ~4 tokens per message for formatting
  totalTokens += 4;

  return totalTokens;
}

/**
 * Count tokens in an array of messages
 */
export function countMessagesTokens(messages: Message[], model: string = 'gpt-4'): number {
  let totalTokens = 0;

  for (const message of messages) {
    totalTokens += countMessageTokens(message, model);
  }

  // Add overhead for conversation formatting
  totalTokens += 2; // For conversation start/end

  return totalTokens;
}

/**
 * Estimate tokens for system prompt and context
 */
export function countSystemTokens(systemPrompt: string, contextFiles?: string, model: string = 'gpt-4'): number {
  let totalTokens = 0;

  if (systemPrompt) {
    totalTokens += countTokens(systemPrompt, model);
  }

  if (contextFiles) {
    totalTokens += countTokens(contextFiles, model);
  }

  return totalTokens;
}

/**
 * Get the maximum context window for a model
 */
export function getModelContextWindow(model: string): number {
  // Common model context windows
  const contextWindows: Record<string, number> = {
    // OpenAI models
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-4-turbo-preview': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385,

    // Anthropic models
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-5-haiku-20241022': 200000,

    // Google models
    'gemini-pro': 32768,
    'gemini-1.5-pro': 1048576,
    'gemini-1.5-flash': 1048576,

    // Other models
    'llama-2-70b-chat': 4096,
    'llama-3-70b-instruct': 8192,
    'mixtral-8x7b-instruct': 32768,

    // Deepseek models
    'deepseek-chat': 65536,
    'deepseek-coder': 65536,
    'deepseek-v2': 65536,

    // Additional popular models
    'claude-instant-1': 100000,
    'claude-2': 100000,
    'claude-2.1': 200000,
    'gpt-3.5-turbo-1106': 16385,
    'gpt-4-1106-preview': 128000,
    'gpt-4-vision-preview': 128000,
  };

  // Check for exact match first
  if (contextWindows[model]) {
    return contextWindows[model];
  }

  // Check for partial matches (case insensitive)
  const lowerModel = model.toLowerCase();
  for (const [modelName, contextWindow] of Object.entries(contextWindows)) {
    const lowerModelName = modelName.toLowerCase();
    if (lowerModel.includes(lowerModelName) || lowerModelName.includes(lowerModel)) {
      logger.info(`Found partial match for model ${model} -> ${modelName} with context window ${contextWindow}`);
      return contextWindow;
    }
  }

  // Default fallback - use a conservative estimate
  logger.warn(`Unknown model ${model}, using default context window of 32768`);
  return 32768;
}

/**
 * Calculate available tokens for messages given system prompt and completion requirements
 */
export function calculateAvailableTokens(
  model: string,
  systemPromptTokens: number,
  completionTokens: number = 4000,
  bufferTokens: number = 1000
): number {
  const maxContextTokens = getModelContextWindow(model);
  const availableTokens = maxContextTokens - systemPromptTokens - completionTokens - bufferTokens;
  
  return Math.max(0, availableTokens);
}

/**
 * Clean up encoders to free memory
 */
export function cleanupEncoders(): void {
  for (const encoder of encoderCache.values()) {
    try {
      encoder.free?.();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  encoderCache.clear();
}
