import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';

const logger = createScopedLogger('model-mapper');

/**
 * Common model name mappings to help users find equivalent models
 * in configured providers
 */
const MODEL_MAPPINGS: Record<string, string[]> = {
  // OpenAI models -> alternatives
  'gpt-4o': ['claude-3-5-sonnet-20241022', 'gpt-4o-mini', 'gemini-1.5-pro', 'llama-3.1-70b-versatile'],
  'gpt-4o-mini': ['claude-3-haiku-20240307', 'gemini-1.5-flash', 'llama-3.1-8b-instant'],
  'gpt-4': ['claude-3-opus-20240229', 'gemini-1.5-pro', 'llama-3.1-70b-versatile'],
  'gpt-3.5-turbo': ['claude-3-haiku-20240307', 'gemini-1.5-flash', 'llama-3.1-8b-instant'],

  // Claude models -> alternatives
  'claude-3-5-sonnet-20241022': ['gpt-4o', 'gemini-1.5-pro', 'llama-3.1-70b-versatile'],
  'claude-3-opus-20240229': ['gpt-4', 'gemini-1.5-pro', 'llama-3.1-70b-versatile'],
  'claude-3-haiku-20240307': ['gpt-4o-mini', 'gemini-1.5-flash', 'llama-3.1-8b-instant'],

  // Google models -> alternatives
  'gemini-1.5-pro': ['gpt-4o', 'claude-3-5-sonnet-20241022', 'llama-3.1-70b-versatile'],
  'gemini-1.5-flash': ['gpt-4o-mini', 'claude-3-haiku-20240307', 'llama-3.1-8b-instant'],

  // Meta models -> alternatives
  'llama-3.1-70b-versatile': ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro'],
  'llama-3.1-8b-instant': ['gpt-4o-mini', 'claude-3-haiku-20240307', 'gemini-1.5-flash'],
};

/**
 * Provider-specific model preferences for common use cases
 */
const PROVIDER_PREFERENCES: Record<string, { coding: string[]; chat: string[]; fast: string[] }> = {
  Moonshot: {
    coding: ['moonshot-v1-32k', 'moonshot-v1-8k'],
    chat: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    fast: ['moonshot-v1-8k'],
  },
  Ollama: {
    coding: ['llama3.1:70b', 'codellama:34b', 'llama3.1:8b'],
    chat: ['llama3.1:8b', 'llama3.1:70b'],
    fast: ['llama3.1:8b', 'phi3:mini'],
  },
  LMStudio: {
    coding: ['llama-3.1-70b', 'codellama-34b', 'llama-3.1-8b'],
    chat: ['llama-3.1-8b', 'llama-3.1-70b'],
    fast: ['llama-3.1-8b', 'phi-3-mini'],
  },
};

export interface ModelMappingResult {
  provider: BaseProvider;
  model: ModelInfo;
  isExactMatch: boolean;
  isMapped: boolean;
  originalModel: string;
}

/**
 * Smart model mapper that finds the best available model in configured providers
 */
export class ModelMapper {
  private llmManager: LLMManager;

  constructor() {
    this.llmManager = LLMManager.getInstance();
  }

  /**
   * Find the best available model for the requested model name
   */
  async findBestModel(
    requestedModel: string,
    configuredProviders: BaseProvider[],
    context: 'coding' | 'chat' | 'fast' = 'chat',
  ): Promise<ModelMappingResult | null> {
    logger.info(`Finding best model for: ${requestedModel} (context: ${context})`);

    // First, try exact match in configured providers
    for (const provider of configuredProviders) {
      const exactMatch = await this.findExactModel(requestedModel, provider);

      if (exactMatch) {
        logger.info(`Found exact match: ${requestedModel} in ${provider.name}`);
        return {
          provider,
          model: exactMatch,
          isExactMatch: true,
          isMapped: false,
          originalModel: requestedModel,
        };
      }
    }

    // Second, try mapped alternatives in configured providers
    const alternatives = MODEL_MAPPINGS[requestedModel] || [];

    for (const alternative of alternatives) {
      for (const provider of configuredProviders) {
        const mappedModel = await this.findExactModel(alternative, provider);

        if (mappedModel) {
          logger.info(`Found mapped alternative: ${alternative} in ${provider.name} for ${requestedModel}`);
          return {
            provider,
            model: mappedModel,
            isExactMatch: false,
            isMapped: true,
            originalModel: requestedModel,
          };
        }
      }
    }

    // Third, try provider-specific preferences
    for (const provider of configuredProviders) {
      const preferences = PROVIDER_PREFERENCES[provider.name];

      if (preferences) {
        const preferredModels = preferences[context] || preferences.chat;

        for (const preferredModel of preferredModels) {
          const model = await this.findExactModel(preferredModel, provider);

          if (model) {
            logger.info(`Found preferred model: ${preferredModel} in ${provider.name} for context ${context}`);
            return {
              provider,
              model,
              isExactMatch: false,
              isMapped: true,
              originalModel: requestedModel,
            };
          }
        }
      }
    }

    // Fourth, fallback to first available model in any configured provider
    for (const provider of configuredProviders) {
      const models = this.llmManager.getStaticModelListFromProvider(provider);

      if (models.length > 0) {
        logger.warn(`Fallback to first available model: ${models[0].name} in ${provider.name}`);
        return {
          provider,
          model: models[0],
          isExactMatch: false,
          isMapped: true,
          originalModel: requestedModel,
        };
      }
    }

    logger.error(`No suitable model found for: ${requestedModel}`);

    return null;
  }

  /**
   * Find exact model in a specific provider
   */
  private async findExactModel(modelName: string, provider: BaseProvider): Promise<ModelInfo | null> {
    try {
      const staticModels = this.llmManager.getStaticModelListFromProvider(provider);
      return staticModels.find((m) => m.name === modelName) || null;
    } catch (error) {
      logger.warn(`Error finding model ${modelName} in provider ${provider.name}:`, error);
      return null;
    }
  }

  /**
   * Get suggested alternatives for a model
   */
  getSuggestedAlternatives(modelName: string): string[] {
    return MODEL_MAPPINGS[modelName] || [];
  }

  /**
   * Get provider-specific recommendations
   */
  getProviderRecommendations(providerName: string, context: 'coding' | 'chat' | 'fast' = 'chat'): string[] {
    const preferences = PROVIDER_PREFERENCES[providerName];
    return preferences ? preferences[context] || preferences.chat : [];
  }
}
