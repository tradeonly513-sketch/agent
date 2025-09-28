import type { ModelInfo } from '~/lib/modules/llm/types';
import { isReasoningModel } from '~/lib/common/model-utils';

export type ProviderCategory =
  | 'high-context' // Google, Anthropic (2M-200K context)
  | 'reasoning' // o1, o3, Claude 4 (simplified prompts)
  | 'speed-optimized' // Groq, Cerebras (concise prompts)
  | 'local-models' // Ollama (simplified vocabulary)
  | 'coding-specialized' // DeepSeek Coder, xAI Grok Code (enhanced coding focus)
  | 'standard'; // OpenAI, others (balanced approach)

export interface ProviderCategoryConfig {
  category: ProviderCategory;
  name: string;
  description: string;
  characteristics: {
    contextWindow: { min: number; max: number };
    preferredPromptLength: 'ultra-concise' | 'concise' | 'balanced' | 'detailed' | 'comprehensive';
    supportsComplexInstructions: boolean;
    optimizedFor: string[];
    specialHandling?: string[];
  };
  promptOptimizations: {
    tokenReduction: number; // Percentage reduction compared to standard
    prioritizeSections: string[];
    excludeSections?: string[];
    simplifyLanguage: boolean;
    enhanceCodeGuidelines: boolean;
  };
}

export const PROVIDER_CATEGORIES: Record<ProviderCategory, ProviderCategoryConfig> = {
  'high-context': {
    category: 'high-context',
    name: 'High-Context Providers',
    description: 'Providers with massive context windows (400K-2M tokens) - 2025 updated',
    characteristics: {
      contextWindow: { min: 400000, max: 2000000 }, // Updated for GPT-5 400K, Kimi K3 2M
      preferredPromptLength: 'comprehensive',
      supportsComplexInstructions: true,
      optimizedFor: ['detailed examples', 'comprehensive guidelines', 'complex reasoning'],
    },
    promptOptimizations: {
      tokenReduction: -30, // Expand prompts by 30% for 2025 large context models
      prioritizeSections: ['code_quality_standards', 'project_structure_standards', 'design_instructions'],
      simplifyLanguage: false,
      enhanceCodeGuidelines: true,
    },
  },

  reasoning: {
    category: 'reasoning',
    name: 'Reasoning Models',
    description: 'Models with internal reasoning capabilities (o1, o3, Claude 4, DeepSeek R1, Kimi Thinking)',
    characteristics: {
      contextWindow: { min: 200000, max: 400000 }, // Updated for 2025 reasoning models
      preferredPromptLength: 'concise',
      supportsComplexInstructions: false, // They reason internally
      optimizedFor: ['clear objectives', 'direct instructions', 'minimal guidance'],
      specialHandling: ['filter unsupported parameters', 'use maxCompletionTokens'],
    },
    promptOptimizations: {
      tokenReduction: 45, // Increased reduction - 2025 reasoning models are more capable
      prioritizeSections: ['system_constraints', 'artifact_instructions'],
      excludeSections: ['message_formatting_info', 'running_shell_commands_info'],
      simplifyLanguage: true,
      enhanceCodeGuidelines: false,
    },
  },

  'speed-optimized': {
    category: 'speed-optimized',
    name: 'Speed-Optimized Providers',
    description: 'Ultra-fast inference providers (Groq, Cerebras)',
    characteristics: {
      contextWindow: { min: 8000, max: 128000 },
      preferredPromptLength: 'ultra-concise',
      supportsComplexInstructions: true,
      optimizedFor: ['fast inference', 'minimal latency', 'efficient processing'],
    },
    promptOptimizations: {
      tokenReduction: 60, // 60% reduction for speed
      prioritizeSections: ['code_fix_triage', 'system_constraints', 'technology_preferences'],
      excludeSections: ['design_instructions', 'mobile_app_instructions'],
      simplifyLanguage: true,
      enhanceCodeGuidelines: false,
    },
  },

  'local-models': {
    category: 'local-models',
    name: 'Local Models',
    description: 'Self-hosted models via Ollama',
    characteristics: {
      contextWindow: { min: 8000, max: 128000 },
      preferredPromptLength: 'concise',
      supportsComplexInstructions: false,
      optimizedFor: ['simple instructions', 'clear guidance', 'resource efficiency'],
    },
    promptOptimizations: {
      tokenReduction: 45, // 45% reduction for local models
      prioritizeSections: ['system_constraints', 'artifact_instructions'],
      excludeSections: ['design_instructions', 'supabase_instructions'],
      simplifyLanguage: true,
      enhanceCodeGuidelines: false,
    },
  },

  'coding-specialized': {
    category: 'coding-specialized',
    name: 'Coding-Specialized Models',
    description: 'Models optimized for code generation (DeepSeek V3.1, Grok 4, GPT-5 Codex)',
    characteristics: {
      contextWindow: { min: 128000, max: 400000 }, // Updated for 2025 coding models
      preferredPromptLength: 'detailed',
      supportsComplexInstructions: true,
      optimizedFor: ['code generation', 'software architecture', 'best practices'],
    },
    promptOptimizations: {
      tokenReduction: 5, // Even less reduction for advanced 2025 coding models
      prioritizeSections: ['code_quality_standards', 'project_structure_standards', 'artifact_instructions'],
      simplifyLanguage: false,
      enhanceCodeGuidelines: true,
    },
  },

  standard: {
    category: 'standard',
    name: 'Standard Providers',
    description: 'Balanced providers with standard capabilities - 2025 updated',
    characteristics: {
      contextWindow: { min: 32000, max: 256000 }, // Updated baseline for 2025
      preferredPromptLength: 'balanced',
      supportsComplexInstructions: true,
      optimizedFor: ['general purpose', 'balanced performance', 'versatility'],
    },
    promptOptimizations: {
      tokenReduction: 0, // No reduction - use standard prompt
      prioritizeSections: ['artifact_instructions', 'system_constraints', 'technology_preferences'],
      simplifyLanguage: false,
      enhanceCodeGuidelines: true,
    },
  },
};

// Provider to category mapping based on 2025 research analysis
export const PROVIDER_TO_CATEGORY: Record<string, ProviderCategory> = {
  // High-Context Providers (400K-2M tokens) - 2025 updated
  Google: 'high-context', // Gemini 2.5 has 1M+ context
  Anthropic: 'high-context', // Claude 4 has 200K+ context
  Moonshot: 'high-context', // Kimi K3 has 2M context

  // Reasoning Models (internal reasoning) - 2025 expanded
  'OpenAI-o1': 'reasoning', // Will be detected by model name
  'OpenAI-o3': 'reasoning', // Will be detected by model name
  'Anthropic-Claude-4': 'reasoning', // Will be detected by model name
  'DeepSeek-R1': 'reasoning', // Will be detected by model name
  'Kimi-Thinking': 'reasoning', // Will be detected by model name

  // Speed-Optimized (ultra-fast inference)
  Groq: 'speed-optimized',
  Cerebras: 'speed-optimized',
  Cloudflare: 'speed-optimized',

  // Local Models (Ollama)
  Ollama: 'local-models',

  // Coding-Specialized - 2025 updated
  Deepseek: 'coding-specialized', // V3.1 Terminus specialized for coding
  xAI: 'coding-specialized', // Grok 4 has strong coding capabilities
  Alibaba: 'coding-specialized', // Qwen3-Coder series specialized for coding

  // Standard Providers - many now have GPT-5 class models
  OpenAI: 'standard', // Even though GPT-5 is powerful, base provider is standard
  Github: 'standard',
  Cohere: 'standard',
  Mistral: 'standard',
  OpenRouter: 'standard',
  Perplexity: 'standard',
  Together: 'standard',
  LMStudio: 'standard',
  OpenAILike: 'standard',
  AmazonBedrock: 'standard',
  HuggingFace: 'standard',
  Hyperbolic: 'standard',
  ZAI: 'standard',
};

/**
 * Determines the provider category based on provider name and model details
 */
export function getProviderCategory(providerName: string, modelDetails?: ModelInfo): ProviderCategory {
  // Priority 1: Reasoning models (detected by model name)
  if (modelDetails?.name && isReasoningModel(modelDetails.name)) {
    return 'reasoning';
  }

  // Priority 2: Fast models (detected by model name patterns)
  if (modelDetails?.name) {
    const modelName = modelDetails.name.toLowerCase();

    if (/\b(fast|instant|flash|turbo)\b/i.test(modelName)) {
      return 'speed-optimized';
    }
  }

  // Priority 3: Provider-based mapping
  return PROVIDER_TO_CATEGORY[providerName] || 'standard';
}

/**
 * Gets the configuration for a specific provider category
 */
export function getCategoryConfig(category: ProviderCategory): ProviderCategoryConfig {
  return PROVIDER_CATEGORIES[category];
}

/**
 * Determines if a provider should use token-optimized prompts based on context window
 */
export function shouldOptimizeForTokens(modelDetails: ModelInfo): boolean {
  const contextWindow = modelDetails.maxTokenAllowed || 32000;

  // Optimize for models with smaller context windows
  return contextWindow < 64000;
}

/**
 * Gets token reduction percentage for a provider category
 */
export function getTokenReduction(category: ProviderCategory): number {
  return PROVIDER_CATEGORIES[category].promptOptimizations.tokenReduction;
}
