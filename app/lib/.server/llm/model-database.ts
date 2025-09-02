/**
 * Comprehensive Model Capability Database
 *
 * Manually curated, accurate token limits for major AI models across all providers.
 * This serves as the authoritative source when provider APIs are unavailable or incorrect.
 *
 * Sources: Official documentation, provider APIs, empirical testing
 * Last updated: 2025-01-01
 */

export interface ModelCapabilityEntry {
  name: string;
  provider: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  contextWindow: number;
  supportsSystemPrompt: boolean;
  supportsTools: boolean;
  isReasoning: boolean;
  notes?: string;
  lastVerified: string; // ISO date string
}

export const MODEL_CAPABILITY_DATABASE: Record<string, ModelCapabilityEntry> = {
  // ANTHROPIC MODELS
  'claude-3-haiku-20240307': {
    name: 'claude-3-haiku-20240307',
    provider: 'Anthropic',
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    contextWindow: 200000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Fastest Claude model, cost-effective',
    lastVerified: '2025-01-01',
  },

  'claude-3-5-haiku-20241022': {
    name: 'claude-3-5-haiku-20241022',
    provider: 'Anthropic',
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    contextWindow: 200000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Improved version with 8K output',
    lastVerified: '2025-01-01',
  },

  'claude-3-5-sonnet-20241022': {
    name: 'claude-3-5-sonnet-20241022',
    provider: 'Anthropic',
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    contextWindow: 200000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Best balance of capability and speed',
    lastVerified: '2025-01-01',
  },

  'claude-3-opus-20240229': {
    name: 'claude-3-opus-20240229',
    provider: 'Anthropic',
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    contextWindow: 200000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Most capable Claude 3 model',
    lastVerified: '2025-01-01',
  },

  // OPENAI MODELS
  'gpt-4o': {
    name: 'gpt-4o',
    provider: 'OpenAI',
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    contextWindow: 128000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Standard GPT-4o, supports up to 16K output tokens',
    lastVerified: '2025-01-01',
  },

  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    provider: 'OpenAI',
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    contextWindow: 128000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Cost-effective alternative to GPT-4o',
    lastVerified: '2025-01-01',
  },

  'o1-preview': {
    name: 'o1-preview',
    provider: 'OpenAI',
    maxInputTokens: 128000,
    maxOutputTokens: 32768,
    contextWindow: 128000,
    supportsSystemPrompt: false,
    supportsTools: false,
    isReasoning: true,
    notes: 'Reasoning model, temperature=1 required',
    lastVerified: '2025-01-01',
  },

  'o1-mini': {
    name: 'o1-mini',
    provider: 'OpenAI',
    maxInputTokens: 128000,
    maxOutputTokens: 65536,
    contextWindow: 128000,
    supportsSystemPrompt: false,
    supportsTools: false,
    isReasoning: true,
    notes: 'Faster reasoning model with higher output',
    lastVerified: '2025-01-01',
  },

  'gpt-4-turbo': {
    name: 'gpt-4-turbo',
    provider: 'OpenAI',
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    contextWindow: 128000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Previous generation turbo model',
    lastVerified: '2025-01-01',
  },

  'gpt-3.5-turbo': {
    name: 'gpt-3.5-turbo',
    provider: 'OpenAI',
    maxInputTokens: 16385,
    maxOutputTokens: 4096,
    contextWindow: 16385,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Legacy model, cost-effective',
    lastVerified: '2025-01-01',
  },

  // GOOGLE MODELS
  'gemini-1.5-pro': {
    name: 'gemini-1.5-pro',
    provider: 'Google',
    maxInputTokens: 2000000,
    maxOutputTokens: 8192,
    contextWindow: 2000000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: '2M context window, multimodal',
    lastVerified: '2025-01-01',
  },

  'gemini-1.5-flash': {
    name: 'gemini-1.5-flash',
    provider: 'Google',
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    contextWindow: 1000000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Faster, more cost-effective version',
    lastVerified: '2025-01-01',
  },

  'gemini-2.0-flash-exp': {
    name: 'gemini-2.0-flash-exp',
    provider: 'Google',
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    contextWindow: 1000000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Experimental next-generation model',
    lastVerified: '2025-01-01',
  },

  // XAI MODELS (GROK)
  'grok-code-fast-1': {
    name: 'grok-code-fast-1',
    provider: 'xAI',
    maxInputTokens: 256000,
    maxOutputTokens: 4096,
    contextWindow: 256000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Specialized coding model, 4x faster, optimized for agentic tasks',
    lastVerified: '2025-01-01',
  },

  'grok-4': {
    name: 'grok-4',
    provider: 'xAI',
    maxInputTokens: 256000,
    maxOutputTokens: 8192,
    contextWindow: 256000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Latest Grok model, high capability',
    lastVerified: '2025-01-01',
  },

  'grok-4-0709': {
    name: 'grok-4-0709',
    provider: 'xAI',
    maxInputTokens: 256000,
    maxOutputTokens: 8192,
    contextWindow: 256000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Grok 4 variant from July 2024',
    lastVerified: '2025-01-01',
  },

  'grok-3': {
    name: 'grok-3',
    provider: 'xAI',
    maxInputTokens: 131072,
    maxOutputTokens: 4096,
    contextWindow: 131072,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Stable Grok 3 model',
    lastVerified: '2025-01-01',
  },

  'grok-3-mini': {
    name: 'grok-3-mini',
    provider: 'xAI',
    maxInputTokens: 131072,
    maxOutputTokens: 4096,
    contextWindow: 131072,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Faster, cost-effective Grok 3 variant',
    lastVerified: '2025-01-01',
  },

  'grok-2-image-1212': {
    name: 'grok-2-image-1212',
    provider: 'xAI',
    maxInputTokens: 32000,
    maxOutputTokens: 2048,
    contextWindow: 32000,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Image generation model',
    lastVerified: '2025-01-01',
  },

  // COMMON OPEN SOURCE MODELS (via multiple providers)
  'llama-3.1-405b': {
    name: 'llama-3.1-405b',
    provider: 'Meta',
    maxInputTokens: 131072,
    maxOutputTokens: 8192,
    contextWindow: 131072,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Largest Llama model, 128K context',
    lastVerified: '2025-01-01',
  },

  'llama-3.1-70b': {
    name: 'llama-3.1-70b',
    provider: 'Meta',
    maxInputTokens: 131072,
    maxOutputTokens: 8192,
    contextWindow: 131072,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'High-performance open model',
    lastVerified: '2025-01-01',
  },

  'llama-3.1-8b': {
    name: 'llama-3.1-8b',
    provider: 'Meta',
    maxInputTokens: 131072,
    maxOutputTokens: 8192,
    contextWindow: 131072,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Efficient smaller model',
    lastVerified: '2025-01-01',
  },

  'mixtral-8x7b': {
    name: 'mixtral-8x7b',
    provider: 'Mistral',
    maxInputTokens: 32768,
    maxOutputTokens: 8192,
    contextWindow: 32768,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Mixture of experts model',
    lastVerified: '2025-01-01',
  },

  'mixtral-8x22b': {
    name: 'mixtral-8x22b',
    provider: 'Mistral',
    maxInputTokens: 65536,
    maxOutputTokens: 8192,
    contextWindow: 65536,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'Larger mixture of experts model',
    lastVerified: '2025-01-01',
  },

  'qwen2.5-72b': {
    name: 'qwen2.5-72b',
    provider: 'Alibaba',
    maxInputTokens: 131072,
    maxOutputTokens: 32768,
    contextWindow: 131072,
    supportsSystemPrompt: true,
    supportsTools: true,
    isReasoning: false,
    notes: 'High-performance Chinese model with good English',
    lastVerified: '2025-01-01',
  },
};

/**
 * Get model capabilities from database
 */
export function getModelCapabilityFromDatabase(modelName: string): ModelCapabilityEntry | null {
  // Direct lookup first
  if (MODEL_CAPABILITY_DATABASE[modelName]) {
    return MODEL_CAPABILITY_DATABASE[modelName];
  }

  // Pattern matching for model variants
  for (const [dbModelName, entry] of Object.entries(MODEL_CAPABILITY_DATABASE)) {
    // Check if the model name matches any known patterns
    if (modelName.includes(dbModelName.split('-')[0]) && modelName.includes(dbModelName.split('-')[1])) {
      return entry;
    }
  }

  return null;
}

/**
 * Get all models for a specific provider
 */
export function getModelsForProvider(provider: string): ModelCapabilityEntry[] {
  return Object.values(MODEL_CAPABILITY_DATABASE).filter(
    (model) => model.provider.toLowerCase() === provider.toLowerCase(),
  );
}

/**
 * Check if model capabilities are stale and need updating
 */
export function areCapabilitiesStale(entry: ModelCapabilityEntry, maxAgeHours: number = 168): boolean {
  // 1 week default
  const lastVerified = new Date(entry.lastVerified);
  const now = new Date();
  const ageHours = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}

/**
 * Get provider-specific model patterns for fuzzy matching
 */
export function getProviderModelPatterns(): Record<string, string[]> {
  return {
    Anthropic: ['claude-3', 'claude-3.5', 'claude-4'],
    OpenAI: ['gpt-3.5', 'gpt-4', 'gpt-4o', 'o1'],
    Google: ['gemini-1.5', 'gemini-2.0', 'bison', 'unicorn'],
    Meta: ['llama-3', 'llama-3.1', 'llama-3.2'],
    Mistral: ['mixtral', 'mistral-7b', 'mistral-nemo'],
    Alibaba: ['qwen', 'qwen2', 'qwen2.5'],
    xAI: ['grok-2', 'grok-3', 'grok-4', 'grok-code'],
  };
}
