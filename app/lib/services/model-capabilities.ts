/**
 * Model Capability Matrix for MCP Tool Calling
 *
 * This module defines tool calling capabilities for different LLM providers and models.
 * Used to recommend optimal model-server pairings and validate compatibility.
 */

export type ToolCallingCapability = 'excellent' | 'good' | 'limited' | 'poor';

export interface ModelCapabilityInfo {
  toolCalling: ToolCallingCapability;
  multiStepWorkflows: boolean;
  complexParameters: boolean;
  reliability: number; // 0-100 percentage
  costEfficiency: 'high' | 'medium' | 'low';
  specialties: string[]; // Areas where this model excels
  limitations: string[]; // Known limitations for tool calling
}

export interface ProviderCapabilities {
  [modelName: string]: ModelCapabilityInfo;
}

/**
 * Comprehensive model capability matrix based on real-world performance
 * and documented capabilities from providers
 */
export const MODEL_CAPABILITIES: Record<string, ProviderCapabilities> = {
  OpenAI: {
    'gpt-4o': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 95,
      costEfficiency: 'medium',
      specialties: ['code analysis', 'file operations', 'complex reasoning'],
      limitations: [],
    },
    'gpt-4o-mini': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 92,
      costEfficiency: 'high',
      specialties: ['simple operations', 'fast responses'],
      limitations: ['less context awareness'],
    },
    'gpt-4-turbo': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 93,
      costEfficiency: 'medium',
      specialties: ['comprehensive analysis', 'detailed operations'],
      limitations: ['higher latency'],
    },
    'o1-preview': {
      toolCalling: 'good',
      multiStepWorkflows: false,
      complexParameters: true,
      reliability: 88,
      costEfficiency: 'low',
      specialties: ['complex reasoning', 'problem solving'],
      limitations: ['no streaming', 'limited tool chaining'],
    },
    'o1-mini': {
      toolCalling: 'good',
      multiStepWorkflows: false,
      complexParameters: true,
      reliability: 85,
      costEfficiency: 'medium',
      specialties: ['reasoning', 'analysis'],
      limitations: ['no streaming', 'limited tool chaining'],
    },
  },

  Anthropic: {
    'claude-3-5-sonnet-20241022': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 94,
      costEfficiency: 'medium',
      specialties: ['file operations', 'code analysis', 'structured data'],
      limitations: [],
    },
    'claude-3-5-sonnet-20240620': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 92,
      costEfficiency: 'medium',
      specialties: ['general purpose', 'reliable execution'],
      limitations: [],
    },
    'claude-3-opus-20240229': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 96,
      costEfficiency: 'low',
      specialties: ['complex workflows', 'high accuracy'],
      limitations: ['expensive', 'slower'],
    },
    'claude-3-haiku-20240307': {
      toolCalling: 'good',
      multiStepWorkflows: true,
      complexParameters: false,
      reliability: 88,
      costEfficiency: 'high',
      specialties: ['fast operations', 'simple tools'],
      limitations: ['simpler reasoning'],
    },
  },

  Google: {
    'gemini-1.5-pro-latest': {
      toolCalling: 'good',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 89,
      costEfficiency: 'medium',
      specialties: ['multimodal analysis', 'large context'],
      limitations: ['inconsistent formatting'],
    },
    'gemini-1.5-flash-latest': {
      toolCalling: 'good',
      multiStepWorkflows: true,
      complexParameters: false,
      reliability: 86,
      costEfficiency: 'high',
      specialties: ['fast responses', 'simple operations'],
      limitations: ['limited complex reasoning'],
    },
  },

  xAI: {
    'grok-4': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 93,
      costEfficiency: 'medium',
      specialties: ['native tool use', 'code analysis', 'real-time search'],
      limitations: [],
    },
    'grok-4-07-09': {
      toolCalling: 'excellent',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 91,
      costEfficiency: 'medium',
      specialties: ['advanced reasoning', 'tool integration'],
      limitations: [],
    },
    'grok-3-beta': {
      toolCalling: 'good',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 87,
      costEfficiency: 'medium',
      specialties: ['general purpose', 'conversational'],
      limitations: ['beta stability'],
    },
    'grok-3-mini-beta': {
      toolCalling: 'good',
      multiStepWorkflows: false,
      complexParameters: false,
      reliability: 83,
      costEfficiency: 'high',
      specialties: ['simple operations'],
      limitations: ['limited capabilities', 'beta stability'],
    },
  },

  Deepseek: {
    'deepseek-coder': {
      toolCalling: 'good',
      multiStepWorkflows: false,
      complexParameters: true,
      reliability: 85,
      costEfficiency: 'high',
      specialties: ['code operations', 'git workflows', 'filesystem'],
      limitations: ['single-turn tool calling', 'limited multi-step'],
    },
    'deepseek-chat': {
      toolCalling: 'good',
      multiStepWorkflows: false,
      complexParameters: false,
      reliability: 82,
      costEfficiency: 'high',
      specialties: ['simple operations', 'cost effective'],
      limitations: ['single-turn tool calling', 'limited reasoning'],
    },
    'deepseek-reasoner': {
      toolCalling: 'good',
      multiStepWorkflows: false,
      complexParameters: true,
      reliability: 87,
      costEfficiency: 'high',
      specialties: ['reasoning tasks', 'analysis'],
      limitations: ['single-turn tool calling'],
    },
  },

  Mistral: {
    'mistral-large-latest': {
      toolCalling: 'good',
      multiStepWorkflows: true,
      complexParameters: true,
      reliability: 88,
      costEfficiency: 'medium',
      specialties: ['european compliance', 'general purpose'],
      limitations: ['less specialized'],
    },
    'mistral-medium-latest': {
      toolCalling: 'good',
      multiStepWorkflows: true,
      complexParameters: false,
      reliability: 84,
      costEfficiency: 'medium',
      specialties: ['balanced performance'],
      limitations: ['limited complex operations'],
    },
  },

  Groq: {
    'llama-3.1-70b-versatile': {
      toolCalling: 'limited',
      multiStepWorkflows: false,
      complexParameters: false,
      reliability: 75,
      costEfficiency: 'high',
      specialties: ['fast responses'],
      limitations: ['basic tool calling', 'formatting issues'],
    },
    'llama-3.1-8b-instant': {
      toolCalling: 'limited',
      multiStepWorkflows: false,
      complexParameters: false,
      reliability: 68,
      costEfficiency: 'high',
      specialties: ['ultra fast'],
      limitations: ['very basic tool calling', 'unreliable'],
    },
  },
};

/**
 * Default model recommendations for specific MCP server types
 */
export const MCP_SERVER_MODEL_RECOMMENDATIONS = {
  github: {
    excellent: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'grok-4'],
    good: ['gpt-4o-mini', 'grok-3-beta', 'deepseek-coder'],
    budget: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'deepseek-coder'],
  },
  filesystem: {
    excellent: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'grok-4'],
    good: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'deepseek-coder'],
    budget: ['gpt-4o-mini', 'deepseek-coder', 'claude-3-haiku-20240307'],
  },
  git: {
    excellent: ['deepseek-coder', 'gpt-4o', 'claude-3-5-sonnet-20241022'],
    good: ['grok-4', 'gpt-4o-mini', 'mistral-large-latest'],
    budget: ['deepseek-coder', 'gpt-4o-mini', 'deepseek-chat'],
  },
  shell: {
    excellent: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'grok-4'],
    good: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'mistral-large-latest'],
    budget: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'deepseek-coder'],
  },
  sqlite: {
    excellent: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'o1-preview'],
    good: ['gpt-4o-mini', 'grok-4', 'mistral-large-latest'],
    budget: ['gpt-4o-mini', 'deepseek-reasoner', 'claude-3-haiku-20240307'],
  },
  everything: {
    excellent: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'grok-4'],
    good: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'mistral-large-latest'],
    budget: ['gpt-4o-mini', 'deepseek-chat', 'claude-3-haiku-20240307'],
  },
};

/**
 * Get model capability information
 */
export function getModelCapability(provider: string, model: string): ModelCapabilityInfo | null {
  return MODEL_CAPABILITIES[provider]?.[model] || null;
}

/**
 * Get recommended models for a specific MCP server type
 */
export function getRecommendedModelsForServer(
  serverName: string,
  preference: 'excellent' | 'good' | 'budget' = 'good',
): string[] {
  // Extract server type from server name (e.g., "my-github" -> "github")
  const serverType = Object.keys(MCP_SERVER_MODEL_RECOMMENDATIONS).find((type) =>
    serverName.toLowerCase().includes(type),
  ) as keyof typeof MCP_SERVER_MODEL_RECOMMENDATIONS;

  if (serverType) {
    return MCP_SERVER_MODEL_RECOMMENDATIONS[serverType][preference] || [];
  }

  // Default recommendations for unknown server types
  return MCP_SERVER_MODEL_RECOMMENDATIONS.everything[preference] || [];
}

/**
 * Validate if a model is suitable for tool calling
 */
export function validateModelForToolCalling(
  provider: string,
  model: string,
): {
  isSupported: boolean;
  capability: ToolCallingCapability;
  warnings: string[];
  recommendations: string[];
} {
  const capability = getModelCapability(provider, model);

  if (!capability) {
    return {
      isSupported: false,
      capability: 'poor',
      warnings: ['Model not found in capability matrix - tool calling support unknown'],
      recommendations: ['Consider using a well-tested model for reliable tool calling'],
    };
  }

  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Add capability-based warnings
  if (capability.toolCalling === 'poor') {
    warnings.push('This model has poor tool calling capabilities');
    recommendations.push('Consider switching to a model with better tool calling support');
  } else if (capability.toolCalling === 'limited') {
    warnings.push('This model has limited tool calling capabilities');
    recommendations.push('May work for simple operations but avoid complex workflows');
  }

  // Add specific limitation warnings
  capability.limitations.forEach((limitation) => {
    warnings.push(limitation);
  });

  // Add workflow-specific warnings
  if (!capability.multiStepWorkflows) {
    warnings.push('Model may struggle with multi-step tool workflows');
    recommendations.push('Best suited for single-step operations');
  }

  if (!capability.complexParameters) {
    warnings.push('Model may have difficulty with complex tool parameters');
    recommendations.push('Ensure tool schemas are simple and well-documented');
  }

  return {
    isSupported: capability.toolCalling !== 'poor',
    capability: capability.toolCalling,
    warnings,
    recommendations,
  };
}

/**
 * Get the best model from a list of available models for tool calling
 */
export function getBestModelForToolCalling(
  availableModels: Array<{ provider: string; model: string }>,
): { provider: string; model: string } | null {
  let bestModel = null;
  let bestScore = 0;

  for (const { provider, model } of availableModels) {
    const capability = getModelCapability(provider, model);

    if (!capability) {
      continue;
    }

    // Score based on capability level
    let score = 0;

    switch (capability.toolCalling) {
      case 'excellent':
        score += 100;
        break;
      case 'good':
        score += 75;
        break;
      case 'limited':
        score += 50;
        break;
      case 'poor':
        score += 0;
        break;
    }

    // Bonus for multi-step workflows
    if (capability.multiStepWorkflows) {
      score += 20;
    }

    // Bonus for complex parameters
    if (capability.complexParameters) {
      score += 15;
    }

    // Bonus for reliability
    score += capability.reliability * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestModel = { provider, model };
    }
  }

  return bestModel;
}

/**
 * Get capability summary for UI display
 */
export function getCapabilitySummary(
  provider: string,
  model: string,
): {
  level: ToolCallingCapability;
  score: number;
  badge: 'success' | 'warning' | 'error' | 'neutral';
  summary: string;
} {
  const capability = getModelCapability(provider, model);

  if (!capability) {
    return {
      level: 'poor',
      score: 0,
      badge: 'error',
      summary: 'Unknown tool calling support',
    };
  }

  const score = capability.reliability;
  let badge: 'success' | 'warning' | 'error' | 'neutral' = 'neutral';
  let summary = '';

  switch (capability.toolCalling) {
    case 'excellent':
      badge = 'success';
      summary = 'Excellent tool calling support';
      break;
    case 'good':
      badge = 'success';
      summary = 'Good tool calling support';
      break;
    case 'limited':
      badge = 'warning';
      summary = 'Limited tool calling support';
      break;
    case 'poor':
      badge = 'error';
      summary = 'Poor tool calling support';
      break;
  }

  return { level: capability.toolCalling, score, badge, summary };
}
